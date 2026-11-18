// Automação do Estúdio JusAz: roda a cada 10 minutos (pg_cron) e quando o Erik clica em "Postar agora".
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

// Chave salva pela tela Conexões (Vault) vale mais que o segredo do servidor.
async function segredo(nome: string): Promise<string> {
  const { data } = await admin.rpc("segredo_ler", { nome });
  return (typeof data === "string" && data.trim()) || Deno.env.get(nome) || "";
}

// Token que começa com "EAA" vem do Login do Facebook (graph.facebook.com);
// o do Login do Instagram (IGAA...) usa graph.instagram.com.
const baseIg = (token: string) => (token.startsWith("EAA") ? "https://graph.facebook.com/v23.0" : "https://graph.instagram.com/v23.0");
let IG = baseIg("");
const AVISO = "Conteúdo informativo, não é aconselhamento jurídico. As histórias são ilustrativas.";
const FUSO = "America/Maceio";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

const dataMaceio = () => new Intl.DateTimeFormat("sv-SE", { timeZone: FUSO }).format(new Date());
const horaMaceio = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());

function somaDias(iso: string, dias: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

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

async function falha(videoId: string, erro: string) {
  await admin.from("videos").update({ status: "erro", error: erro, ig_container_id: null }).eq("id", videoId);
  return { erro };
}

async function publicar(videoId: string) {
  const token = await segredo("IG_ACCESS_TOKEN");
  const uid = await segredo("IG_USER_ID");
  IG = baseIg(token);
  if (!token || !uid) return { erro: "Instagram ainda não conectado: faltam o token e o ID da conta. Salve em Conexões." };

  const { data: v } = await admin.from("videos").select("*, scripts(*)").eq("id", videoId).maybeSingle();
  if (!v) return { erro: "Vídeo não encontrado." };
  if (v.platform === "tiktok") return { erro: "Esta é a versão do TikTok. Ela vai como rascunho pela aba TikTok." };
  if (v.status === "postado") return { ok: true, ja_postado: true };
  if (!v.final_path) return { erro: "O vídeo ainda não foi gerado." };

  const legenda = [v.caption ?? v.scripts.caption, AVISO, (v.scripts.hashtags as string[]).join(" ")].join("\n\n");
  let container: string | null = v.ig_container_id;

  if (!container) {
    const r = await fetch(`${IG}/${uid}/media`, {
      method: "POST",
      body: new URLSearchParams({
        media_type: "REELS",
        video_url: `${URL_}/storage/v1/object/public/videos/${v.final_path}`,
        caption: legenda,
        share_to_feed: "true",
        access_token: token,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.id) return await falha(videoId, `O Instagram recusou o vídeo: ${j?.error?.message ?? r.status}`);
    container = j.id as string;
    await admin.from("videos").update({ ig_container_id: container, error: null }).eq("id", videoId);
  }

  for (let i = 0; i < 16; i++) {
    const s = await (await fetch(`${IG}/${container}?fields=status_code&access_token=${token}`)).json().catch(() => ({}));
    if (s.status_code === "FINISHED") break;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED")
      return await falha(videoId, `O Instagram não conseguiu processar o vídeo (${s.status_code}).`);
    if (i === 15) return { pendente: true };
    await new Promise((res) => setTimeout(res, 5000));
  }

  const p = await fetch(`${IG}/${uid}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({ creation_id: container!, access_token: token }),
  });
  const pj = await p.json().catch(() => ({}));
  if (!p.ok || !pj.id) return await falha(videoId, `Não consegui publicar: ${pj?.error?.message ?? p.status}`);

  await admin
    .from("videos")
    .update({ status: "postado", ig_media_id: pj.id, posted_at: new Date().toISOString(), error: null })
    .eq("id", videoId);
  const funil = await ligarFunil(videoId, pj.id as string);
  return { ok: true, media_id: pj.id, funil };
}

// Funil comentário→mensagem do post: nasce LIGADO e amarrado ao post que acabou de sair
// (só responde comentários feitos nele, com a palavra do roteiro). Não derruba a publicação se falhar.
const FUNIL_RESPOSTA = "Te mandei os detalhes no direct! 💬";
const FUNIL_DM = "Oi {nome}! Aqui está o caminho para você ver seus direitos de graça, com advogados verificados pela OAB:";
const FUNIL_LINK = "https://jusaz.com";

async function ligarFunil(videoId: string, mediaId: string) {
  try {
    const { data: v } = await admin.from("videos").select("posted_at, scripts(slug, keyword)").eq("id", videoId).maybeSingle();
    const s = (Array.isArray(v?.scripts) ? v?.scripts[0] : v?.scripts) as { slug: string; keyword: string } | null;
    if (!s?.keyword) return { erro: "Roteiro sem palavra-chave." };
    // O funil aponta para o post; o post precisa existir na tabela (a leitura completa vem depois, a cada 2 minutos).
    const agora = new Date().toISOString();
    await admin.from("ig_posts").upsert(
      { id: mediaId, video_id: videoId, media_type: "VIDEO", product_type: "REELS", posted_at: v?.posted_at ?? agora },
      { onConflict: "id", ignoreDuplicates: true },
    );
    const { data: ja } = await admin.from("ig_flows").select("id").eq("post_id", mediaId).eq("keyword", s.keyword).maybeSingle();
    if (ja) {
      await admin.from("ig_flows").update({ active: true }).eq("id", ja.id);
      return { ok: true, regra: ja.id, reaproveitada: true };
    }
    const { data: nova, error } = await admin.from("ig_flows").insert({
      name: `Post · ${s.slug}`, keyword: s.keyword, post_id: mediaId, reply_public: FUNIL_RESPOSTA, dm_text: FUNIL_DM,
      link_url: FUNIL_LINK, active: true, activated_at: agora,
    }).select("id").single();
    if (error) return { erro: error.message };
    return { ok: true, regra: nova.id };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

// Rede de segurança: todo vídeo já postado no Instagram precisa ter seu funil ligado.
async function garantirFunis() {
  const { data: postados } = await admin.from("videos").select("id, ig_media_id").eq("platform", "instagram").eq("status", "postado").not("ig_media_id", "is", null).limit(100);
  if (!postados?.length) return { conferidos: 0, criados: 0 };
  const { data: regras } = await admin.from("ig_flows").select("post_id, active").in("post_id", postados.map((p) => p.ig_media_id));
  const com = new Map((regras ?? []).map((r) => [r.post_id, r.active]));
  let criados = 0;
  for (const p of postados) {
    if (com.get(p.ig_media_id) === true) continue;
    const r = await ligarFunil(p.id, p.ig_media_id as string);
    if ((r as { ok?: boolean }).ok) criados++;
  }
  return { conferidos: postados.length, criados };
}

// Confere se o token e a conta do Instagram funcionam, sem postar nada.
async function testarInstagram() {
  const token = await segredo("IG_ACCESS_TOKEN");
  const uid = await segredo("IG_USER_ID");
  IG = baseIg(token);
  const grava = (status: string, label: string | null, meta: Record<string, unknown>) =>
    admin.from("connections").update({ status, label, meta, checked_at: new Date().toISOString() }).eq("kind", "instagram");
  if (!token || !uid) {
    await grava("desconectado", null, { erro: "Faltam o token e o ID da conta do Instagram. Salve em Conexões." });
    return { erro: "Faltam o token e o ID da conta." };
  }
  const r = await fetch(`${IG}/${uid}?fields=username&access_token=${token}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.username) {
    const msg = `O Instagram recusou o token: ${j?.error?.message ?? r.status}`;
    await grava("atencao", null, { erro: msg });
    return { erro: msg };
  }
  await grava("conectado", `@${j.username}`, {});
  return { ok: true, conta: j.username };
}

async function diaria() {
  const { data: cfg } = await admin.from("settings").select("*").eq("id", true).single();
  if (!cfg) return { erro: "Sem configurações." };
  const hoje = dataMaceio();
  const hora = horaMaceio();
  const limite = somaDias(hoje, cfg.lead_days);
  const relatorio: Record<string, unknown> = { hoje, hora, enfileirados: [] as string[], postados: [] as string[] };

  const { data: videos } = await admin
    .from("videos")
    .select("id, status, scheduled_for, slot, platform, scripts(status)")
    .lte("scheduled_for", limite)
    .in("status", ["na_fila", "pronto"])
    .order("scheduled_for")
    .order("slot");

  const seguro = (v: { scripts: unknown }) => {
    const st = (v.scripts as { status: string } | null)?.status;
    if (st === "rascunho") return false;
    if (cfg.hold_on_check && st === "conferir_fato") return false;
    return true;
  };

  // 1) Gerar com antecedência: só entra na fila de render quem ainda não tem nenhum job.
  const naFila = (videos ?? []).filter((v) => v.status === "na_fila" && seguro(v));
  if (naFila.length) {
    const { data: jobs } = await admin.from("render_jobs").select("video_id").in("video_id", naFila.map((v) => v.id));
    const comJob = new Set((jobs ?? []).map((j) => j.video_id));
    for (const v of naFila) {
      if (comJob.has(v.id)) continue;
      await admin.from("render_jobs").insert({ video_id: v.id });
      (relatorio.enfileirados as string[]).push(v.id);
    }
  }

  // 2) Postar: pronto, no dia e na hora combinados.
  if (cfg.post_without_review) {
    // 1º vídeo do dia sai em post_hour, o 2º em post_hour_2.
    const horaDoSlot = (slot: number) => String(slot === 2 ? cfg.post_hour_2 : cfg.post_hour).slice(0, 5);
    const prontos = (videos ?? []).filter(
      (v) => v.platform === "instagram" && v.status === "pronto" && seguro(v) && v.scheduled_for && v.scheduled_for <= hoje && (v.scheduled_for < hoje || hora >= horaDoSlot(v.slot)),
    );
    for (const v of prontos.slice(0, 1)) {
      const r = await publicar(v.id);
      relatorio[`post_${v.id}`] = r;
      if ((r as { ok?: boolean }).ok) (relatorio.postados as string[]).push(v.id);
    }
  }
  relatorio.funis = await garantirFunis();
  return relatorio;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
  const quem = await autorizar(req);
  if (!quem) return json({ erro: "Não autorizado." }, 401);
  const body = await req.json().catch(() => ({}));
  try {
    if (body.acao === "diaria" && quem === "cron") return json(await diaria());
    if (body.acao === "instagram") return json(await testarInstagram());
    if (body.acao === "postar" && quem === "admin" && typeof body.video_id === "string") return json(await publicar(body.video_id));
    return json({ erro: "Ação inválida." }, 400);
  } catch (e) {
    return json({ erro: (e as Error).message }, 500);
  }
});
