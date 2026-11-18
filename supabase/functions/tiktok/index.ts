// TikTok do Estúdio JusAz: login (OAuth), renovação do token, métricas e rascunho diário
// na caixa de entrada do TikTok. Roda pelo cron e pelos botões da plataforma.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

// A chave do cliente é pública (aparece na URL de login). O segredo só vem do cofre do Supabase.
const KEY = Deno.env.get("TIKTOK_CLIENT_KEY") ?? "sbaw9mgqdl834q0wbe";
const SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET") ?? "";
const REDIRECT = Deno.env.get("TIKTOK_REDIRECT_URI") ?? "https://jusaz-estudio.vercel.app/meta/tiktok";
const ESCOPOS = Deno.env.get("TIKTOK_SCOPES") ?? "user.info.basic,user.info.stats,video.list,video.upload";
const API = "https://open.tiktokapis.com";
const MAX_BYTES = 64 * 1024 * 1024; // um pedaço só; o TikTok aceita até 64 MB por pedaço

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

async function autorizar(req: Request): Promise<"cron" | "admin" | null> {
  const seg = req.headers.get("x-cron-secret");
  if (seg) {
    const { data } = await admin.rpc("segredo_ok", { nome: "cron_secret", valor: seg });
    return data === true ? "cron" : null;
  }
  const auth = req.headers.get("Authorization");
  if (!auth) return null;
  const sb = createClient(URL_, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: u } = await sb.auth.getUser();
  if (!u?.user) return null;
  const { data } = await sb.from("admins").select("user_id").maybeSingle();
  return data ? "admin" : null;
}

// ---------- chamadas ao TikTok ----------
type Tk = { ok: boolean; status: number; data: any; erro: string };
async function tk(path: string, token: string | null, corpo?: unknown): Promise<Tk> {
  const r = await fetch(`${API}${path}`, {
    method: corpo === undefined ? "GET" : "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json; charset=UTF-8" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const j = await r.json().catch(() => ({}));
  const code = j?.error?.code;
  const ok = r.ok && (!code || code === "ok");
  return { ok, status: r.status, data: j?.data ?? {}, erro: ok ? "" : `${code ?? r.status}: ${j?.error?.message ?? ""}`.trim() };
}

async function oauth(params: Record<string, string>) {
  const r = await fetch(`${API}/v2/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: KEY, client_secret: SECRET, ...params }),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok && !!j.access_token, data: j, erro: String(j.error_description ?? j.error ?? `erro ${r.status}`) };
}

async function marcarConexao(status: string, label: string | null, erro?: string) {
  await admin
    .from("connections")
    .update({ status, label, meta: erro ? { erro } : {}, checked_at: new Date().toISOString() })
    .eq("kind", "tiktok");
}

async function guardarTokens(openId: string, j: any) {
  const agora = Date.now();
  await admin.from("tiktok_tokens").upsert({
    open_id: openId,
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    access_expires_at: new Date(agora + Number(j.expires_in ?? 86400) * 1000).toISOString(),
    refresh_expires_at: new Date(agora + Number(j.refresh_expires_in ?? 31536000) * 1000).toISOString(),
    scope: j.scope ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "open_id" });
}

// Devolve um token de acesso válido, renovando quando faltam menos de 2 horas.
async function tokenDe(openId: string): Promise<{ token: string; scope: string } | null> {
  const { data: t } = await admin.from("tiktok_tokens").select("*").eq("open_id", openId).maybeSingle();
  if (!t) return null;
  if (new Date(t.refresh_expires_at).getTime() < Date.now()) {
    await marcarConexao("atencao", null, "O acesso ao TikTok venceu. Clique em Conectar TikTok de novo.");
    return null;
  }
  if (new Date(t.access_expires_at).getTime() - Date.now() > 2 * 3600e3) return { token: t.access_token, scope: t.scope ?? "" };
  if (!SECRET) return null;
  const r = await oauth({ grant_type: "refresh_token", refresh_token: t.refresh_token });
  if (!r.ok) {
    await marcarConexao("atencao", null, `O TikTok recusou renovar o acesso: ${r.erro}. Conecte de novo.`);
    return null;
  }
  // O TikTok pode devolver um refresh_token novo: sempre guardamos o que veio.
  await guardarTokens(openId, { ...r.data, refresh_token: r.data.refresh_token ?? t.refresh_token });
  return { token: r.data.access_token, scope: r.data.scope ?? t.scope ?? "" };
}

// ---------- login ----------
async function urlLogin() {
  await admin.from("tiktok_login_state").delete().lt("created_at", new Date(Date.now() - 3600e3).toISOString());
  const state = crypto.randomUUID();
  await admin.from("tiktok_login_state").insert({ state });
  const q = new URLSearchParams({ client_key: KEY, scope: ESCOPOS, response_type: "code", redirect_uri: REDIRECT, state });
  return { url: `https://www.tiktok.com/v2/auth/authorize/?${q}` };
}

async function trocar(code: string, state: string) {
  if (!SECRET) return { erro: "Falta salvar o segredo TIKTOK_CLIENT_SECRET no Supabase (Edge Functions, Secrets)." };
  const { data: st } = await admin.from("tiktok_login_state").select("state, created_at").eq("state", state).maybeSingle();
  if (!st || Date.now() - new Date(st.created_at).getTime() > 3600e3) return { erro: "O login expirou. Clique em Conectar TikTok de novo." };
  await admin.from("tiktok_login_state").delete().eq("state", state);

  const r = await oauth({ code, grant_type: "authorization_code", redirect_uri: REDIRECT });
  if (!r.ok) return { erro: `O TikTok recusou o login: ${r.erro}` };
  const openId = String(r.data.open_id ?? "");
  if (!openId) return { erro: "O TikTok não devolveu a conta." };
  await guardarTokens(openId, r.data);

  const { data: ja } = await admin.from("tiktok_account").select("open_id").eq("principal", true).maybeSingle();
  await admin.from("tiktok_account").upsert({ open_id: openId, principal: !ja || ja.open_id === openId, connected_at: new Date().toISOString() }, { onConflict: "open_id", ignoreDuplicates: false });
  const s = await sincronizarConta(openId);
  const { data: conta } = await admin.from("tiktok_account").select("display_name").eq("open_id", openId).maybeSingle();
  await marcarConexao("conectado", conta?.display_name ? `@${conta.display_name}` : "Conectado");
  return { ok: true, conta: conta?.display_name ?? null, escopos: r.data.scope ?? "", sincronizacao: s };
}

async function desconectar() {
  const { data: tokens } = await admin.from("tiktok_tokens").select("open_id, access_token");
  for (const t of tokens ?? []) {
    if (SECRET) {
      await fetch(`${API}/v2/oauth/revoke/`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_key: KEY, client_secret: SECRET, token: t.access_token }),
      }).catch(() => null);
    }
  }
  await admin.from("tiktok_tokens").delete().neq("open_id", "");
  await admin.from("tiktok_account").delete().neq("open_id", "");
  await marcarConexao("desconectado", null);
  return { ok: true };
}

// ---------- métricas ----------
async function sincronizarConta(openId: string) {
  const t = await tokenDe(openId);
  if (!t) return { erro: "Sem acesso válido ao TikTok." };

  let u = await tk("/v2/user/info/?fields=open_id,display_name,avatar_url,follower_count,following_count,likes_count,video_count", t.token);
  if (!u.ok) u = await tk("/v2/user/info/?fields=open_id,display_name,avatar_url", t.token); // sem a permissão de estatísticas
  if (!u.ok) return { erro: `Não consegui ler a conta: ${u.erro}` };
  const us = u.data.user ?? {};
  await admin.from("tiktok_account").update({
    display_name: us.display_name ?? null,
    avatar_url: us.avatar_url ?? null,
    followers: us.follower_count ?? null,
    following: us.following_count ?? null,
    likes: us.likes_count ?? null,
    video_count: us.video_count ?? null,
    synced_at: new Date().toISOString(),
  }).eq("open_id", openId);
  const dia = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  if (us.follower_count != null) {
    await admin.from("tiktok_account_daily").upsert(
      { open_id: openId, day: dia, followers: us.follower_count, likes: us.likes_count ?? null, video_count: us.video_count ?? null },
      { onConflict: "open_id,day" },
    );
  }

  // Vídeos: as duas últimas páginas de 20.
  const campos = "id,title,cover_image_url,share_url,duration,create_time,like_count,comment_count,share_count,view_count";
  let cursor: number | undefined;
  let lidos = 0;
  for (let pagina = 0; pagina < 2; pagina++) {
    const v = await tk(`/v2/video/list/?fields=${campos}`, t.token, { max_count: 20, ...(cursor ? { cursor } : {}) });
    if (!v.ok) return { ok: true, videos: lidos, aviso: `Vídeos: ${v.erro}` };
    const lista = (v.data.videos ?? []) as any[];
    if (lista.length) {
      await admin.from("tiktok_videos").upsert(
        lista.map((x) => ({
          id: String(x.id), open_id: openId, title: x.title ?? null, cover_url: x.cover_image_url ?? null,
          share_url: x.share_url ?? null, duration_s: x.duration ?? null,
          posted_at: x.create_time ? new Date(x.create_time * 1000).toISOString() : null,
          views: x.view_count ?? null, likes: x.like_count ?? null, comments: x.comment_count ?? null, shares: x.share_count ?? null,
          synced_at: new Date().toISOString(),
        })),
        { onConflict: "id" },
      );
      lidos += lista.length;
    }
    if (!v.data.has_more) break;
    cursor = v.data.cursor;
  }
  await ligarVideos(openId);
  return { ok: true, videos: lidos };
}

// Liga cada vídeo do TikTok ao vídeo do estúdio que foi enviado como rascunho (por horário e duração).
async function ligarVideos(openId: string) {
  const { data: soltos } = await admin.from("tiktok_videos").select("id, posted_at, duration_s").eq("open_id", openId).is("video_id", null);
  if (!soltos?.length) return;
  const { data: envios } = await admin
    .from("videos").select("id, tiktok_status, tiktok_sent_at, duration_s")
    .in("tiktok_status", ["enviado", "postado"]).not("tiktok_sent_at", "is", null);
  const { data: jaLigados } = await admin.from("tiktok_videos").select("video_id").not("video_id", "is", null);
  const usados = new Set((jaLigados ?? []).map((x) => x.video_id));
  for (const tv of soltos) {
    if (!tv.posted_at) continue;
    const alvo = (envios ?? [])
      .filter((e) => !usados.has(e.id) && e.tiktok_sent_at! <= tv.posted_at! && (e.duration_s == null || tv.duration_s == null || Math.abs(e.duration_s - tv.duration_s) <= 3))
      .sort((a, b) => (a.tiktok_sent_at! < b.tiktok_sent_at! ? 1 : -1))[0];
    if (!alvo) continue;
    usados.add(alvo.id);
    await admin.from("tiktok_videos").update({ video_id: alvo.id }).eq("id", tv.id);
    if (alvo.tiktok_status === "enviado") await admin.from("videos").update({ tiktok_status: "postado" }).eq("id", alvo.id);
  }
}

async function sincronizarTodas() {
  const { data: contas } = await admin.from("tiktok_account").select("open_id");
  const out: unknown[] = [];
  for (const c of contas ?? []) out.push(await sincronizarConta(c.open_id));
  return out;
}

// ---------- rascunho na caixa de entrada ----------
async function enviarRascunho(videoId: string) {
  const { data: conta } = await admin.from("tiktok_account").select("open_id").eq("principal", true).maybeSingle();
  if (!conta) return { erro: "Conecte uma conta do TikTok primeiro." };
  const t = await tokenDe(conta.open_id);
  if (!t) return { erro: "Sem acesso válido ao TikTok. Conecte de novo." };
  if (!t.scope.split(",").includes("video.upload")) return { erro: "A conta não deu a permissão de enviar vídeos (video.upload). Conecte de novo e aceite todas as permissões." };

  // Reserva o vídeo para não enviar duas vezes.
  const { data: reservado } = await admin
    .from("videos").update({ tiktok_status: "enviado", tiktok_sent_at: new Date().toISOString(), tiktok_error: null, tiktok_publish_id: null })
    .eq("id", videoId).or("tiktok_status.is.null,tiktok_status.eq.erro").select("id, final_path");
  const v = reservado?.[0];
  if (!v) return { erro: "Este vídeo já foi enviado ao TikTok." };
  const falhou = async (msg: string) => {
    await admin.from("videos").update({ tiktok_status: "erro", tiktok_error: msg.slice(0, 300) }).eq("id", videoId);
    return { erro: msg };
  };
  if (!v.final_path) return falhou("O vídeo ainda não foi gerado.");

  const arq = await admin.storage.from("videos").download(v.final_path);
  if (arq.error || !arq.data) return falhou(`Não consegui abrir o arquivo do vídeo: ${arq.error?.message ?? "vazio"}`);
  const buf = new Uint8Array(await arq.data.arrayBuffer());
  const tamanho = buf.byteLength;
  if (tamanho > MAX_BYTES) return falhou("O vídeo passa de 64 MB e não cabe em um envio só.");

  const ini = await tk("/v2/post/publish/inbox/video/init/", t.token, {
    source_info: { source: "FILE_UPLOAD", video_size: tamanho, chunk_size: tamanho, total_chunk_count: 1 },
  });
  if (!ini.ok) return falhou(`O TikTok recusou o envio: ${ini.erro}`);
  const publishId = String(ini.data.publish_id ?? "");
  const uploadUrl = String(ini.data.upload_url ?? "");
  if (!publishId || !uploadUrl) return falhou("O TikTok não devolveu o endereço de envio.");

  const up = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4", "Content-Range": `bytes 0-${tamanho - 1}/${tamanho}` },
    body: buf,
  });
  if (!up.ok && up.status !== 206) return falhou(`Falha ao subir o arquivo para o TikTok (erro ${up.status}).`);
  await admin.from("videos").update({ tiktok_publish_id: publishId }).eq("id", videoId);
  return { ok: true, publish_id: publishId };
}

async function horaCerta() {
  const { data: cfg } = await admin.from("settings").select("post_hour, timezone, post_without_review, hold_on_check").eq("id", true).maybeSingle();
  const tz = cfg?.timezone ?? "America/Maceio";
  const agora = new Date();
  const hoje = new Intl.DateTimeFormat("sv-SE", { timeZone: tz }).format(agora);
  const hora = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(agora);
  return { hoje, hora, cfg };
}

// Envia, no horário de postagem, o rascunho dos vídeos que já estão prontos.
async function enviarDevidos() {
  const { hoje, hora, cfg } = await horaCerta();
  if (!cfg?.post_without_review) return { enviados: 0 };
  const { data: conta } = await admin.from("tiktok_account").select("open_id").eq("principal", true).maybeSingle();
  if (!conta) return { enviados: 0 };
  const horaPost = String(cfg.post_hour).slice(0, 5);
  const { data: vids } = await admin
    .from("videos").select("id, status, scheduled_for, final_path, scripts(status)")
    .in("status", ["pronto", "postado"]).not("final_path", "is", null).is("tiktok_status", null)
    .lte("scheduled_for", hoje).order("scheduled_for");
  const devidos = (vids ?? []).filter((v: any) => {
    const st = Array.isArray(v.scripts) ? v.scripts[0]?.status : v.scripts?.status;
    if (cfg.hold_on_check && st === "conferir_fato") return false;
    return v.scheduled_for < hoje || hora >= horaPost;
  }).slice(0, 2);
  const resultados: unknown[] = [];
  for (const v of devidos) resultados.push(await enviarRascunho(v.id));
  return { enviados: resultados.filter((r: any) => r.ok).length, resultados };
}

// Acompanha o que aconteceu com cada rascunho (chegou na caixa, foi publicado, falhou).
async function acompanharEnvios() {
  const { data: conta } = await admin.from("tiktok_account").select("open_id").eq("principal", true).maybeSingle();
  if (!conta) return { checados: 0 };
  const t = await tokenDe(conta.open_id);
  if (!t) return { checados: 0 };
  const { data: vids } = await admin.from("videos").select("id, tiktok_publish_id").eq("tiktok_status", "enviado").not("tiktok_publish_id", "is", null).limit(10);
  let checados = 0;
  for (const v of vids ?? []) {
    const s = await tk("/v2/post/publish/status/fetch/", t.token, { publish_id: v.tiktok_publish_id });
    if (!s.ok) continue;
    checados++;
    const st = String(s.data.status ?? "");
    if (st === "PUBLISH_COMPLETE") await admin.from("videos").update({ tiktok_status: "postado" }).eq("id", v.id);
    else if (st === "FAILED") await admin.from("videos").update({ tiktok_status: "erro", tiktok_error: String(s.data.fail_reason ?? "O TikTok não conseguiu processar o vídeo.").slice(0, 300) }).eq("id", v.id);
  }
  return { checados };
}

async function ciclo() {
  const { data: tem } = await admin.from("tiktok_tokens").select("open_id").limit(1);
  if (!tem?.length) return { conectado: false };
  const envio = await enviarDevidos();
  const acompanhamento = await acompanharEnvios();
  const metricas = await sincronizarTodas();
  return { conectado: true, envio, acompanhamento, metricas };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
  const quem = await autorizar(req);
  if (!quem) return json({ erro: "Não autorizado." }, 401);
  const b = await req.json().catch(() => ({}));
  try {
    if (b.acao === "ciclo") return json(await ciclo());
    if (b.acao === "sincronizar") return json({ metricas: await sincronizarTodas() });
    if (quem === "admin") {
      if (b.acao === "url") return json(await urlLogin());
      if (b.acao === "trocar" && typeof b.code === "string" && typeof b.state === "string") return json(await trocar(b.code, b.state));
      if (b.acao === "desconectar") return json(await desconectar());
      if (b.acao === "enviar" && typeof b.video_id === "string") return json(await enviarRascunho(b.video_id));
    }
    return json({ erro: "Ação inválida." }, 400);
  } catch (e) {
    return json({ erro: (e as Error).message }, 500);
  }
});
