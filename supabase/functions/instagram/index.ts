// Instagram do Estúdio JusAz: lê a conta, sincroniza posts, comentários e conversas,
// roda o funil de comentários e envia mensagens. Roda pelo cron e pelos botões da plataforma.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

const TOKEN = Deno.env.get("IG_ACCESS_TOKEN") ?? "";
const UID = Deno.env.get("IG_USER_ID") ?? "";
// Token EAA... vem do Login do Facebook; IGAA... do Login do Instagram.
const G = TOKEN.startsWith("EAA") ? "https://graph.facebook.com/v23.0" : "https://graph.instagram.com/v23.0";
const MAX_ENVIOS_POR_CICLO = 5;

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

type Resp = { ok: boolean; status: number; data: any };
async function ig(path: string, form?: Record<string, string>): Promise<Resp> {
  const sep = path.includes("?") ? "&" : "?";
  const r = form
    ? await fetch(`${G}/${path}`, { method: "POST", body: new URLSearchParams({ ...form, access_token: TOKEN }) })
    : await fetch(`${G}/${path}${sep}access_token=${TOKEN}`);
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok && !data?.error, status: r.status, data };
}
const msgErro = (r: Resp) => String(r.data?.error?.message ?? `erro ${r.status}`);

// ---------- texto ----------
export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export function casaPalavra(texto: string, palavra: string): boolean {
  const p = norm(palavra).trim();
  if (!p) return false;
  const esc = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(norm(texto));
}
export function montar(modelo: string, dados: { nome: string; link: string }): string {
  return modelo.replaceAll("{nome}", dados.nome || "").replaceAll("{link}", dados.link || "").trim();
}
function textoDm(f: { dm_text: string; link_url: string | null }, nome: string): string {
  const base = montar(f.dm_text, { nome, link: f.link_url ?? "" });
  return f.link_url && !f.dm_text.includes("{link}") ? `${base}\n\n${f.link_url}`.trim() : base;
}

async function marcarConexao(status: string, label: string | null, erro?: string) {
  await admin
    .from("connections")
    .update({ status, label, meta: erro ? { erro } : {}, checked_at: new Date().toISOString() })
    .eq("kind", "instagram");
}

// ---------- sincronização ----------
async function sincronizar() {
  if (!TOKEN || !UID) {
    await marcarConexao("desconectado", null, "Faltam os segredos IG_ACCESS_TOKEN e IG_USER_ID no Supabase.");
    return { erro: "Faltam os segredos IG_ACCESS_TOKEN e IG_USER_ID." };
  }
  const p = await ig(`${UID}?fields=username,name,profile_picture_url,followers_count,follows_count,media_count`);
  if (!p.ok) {
    const erro = `O Instagram recusou o token: ${msgErro(p)}`;
    await marcarConexao("atencao", null, erro);
    return { erro };
  }
  await admin
    .from("ig_account")
    .update({
      ig_user_id: UID,
      username: p.data.username,
      name: p.data.name ?? null,
      picture_url: p.data.profile_picture_url ?? null,
      followers: p.data.followers_count ?? null,
      follows: p.data.follows_count ?? null,
      media_count: p.data.media_count ?? null,
      synced_at: new Date().toISOString(),
    })
    .eq("id", true);
  await admin.from("ig_account_daily").upsert(
    { day: hojeMaceio(), followers: p.data.followers_count ?? null, follows: p.data.follows_count ?? null, media_count: p.data.media_count ?? null },
    { onConflict: "day" },
  );
  await marcarConexao("conectado", `@${p.data.username}`);

  const m = await ig(
    `${UID}/media?fields=id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count&limit=30`,
  );
  if (!m.ok) return { erro: `Não consegui ler os posts: ${msgErro(m)}` };
  const posts = (m.data.data ?? []) as any[];
  if (posts.length) {
    await admin.from("ig_posts").upsert(
      posts.map((x) => ({
        id: x.id,
        caption: x.caption ?? null,
        media_type: x.media_type ?? null,
        product_type: x.media_product_type ?? null,
        permalink: x.permalink ?? null,
        thumb_url: x.thumbnail_url ?? x.media_url ?? null,
        posted_at: x.timestamp ? new Date(x.timestamp).toISOString() : null,
        likes: x.like_count ?? 0,
        comments_count: x.comments_count ?? 0,
        synced_at: new Date().toISOString(),
      })),
      { onConflict: "id" },
    );
    // Liga o post ao vídeo que o estúdio publicou.
    const { data: vids } = await admin.from("videos").select("id, ig_media_id").in("ig_media_id", posts.map((x) => x.id));
    for (const v of vids ?? []) await admin.from("ig_posts").update({ video_id: v.id }).eq("id", v.ig_media_id);
  }

  // Comentários: só busca nos posts em que o número mudou.
  const { data: dbPosts } = await admin.from("ig_posts").select("id, comments_count, comments_fetched").order("posted_at", { ascending: false }).limit(30);
  let novos = 0;
  for (const post of (dbPosts ?? []).filter((x) => x.comments_count !== x.comments_fetched).slice(0, 10)) {
    const c = await ig(`${post.id}/comments?fields=id,text,username,timestamp,replies%7Bid,text,username,timestamp%7D&limit=50`);
    if (!c.ok) continue;
    const linhas: Record<string, unknown>[] = [];
    for (const x of (c.data.data ?? []) as any[]) {
      const meu = x.username === p.data.username;
      linhas.push({
        id: x.id, post_id: post.id, username: x.username ?? null, text: x.text ?? "",
        commented_at: x.timestamp ? new Date(x.timestamp).toISOString() : null,
        status: meu ? "ignorado" : "novo",
      });
      for (const r of (x.replies?.data ?? []) as any[]) {
        linhas.push({
          id: r.id, post_id: post.id, username: r.username ?? null, text: r.text ?? "",
          commented_at: r.timestamp ? new Date(r.timestamp).toISOString() : null,
          parent_id: x.id, status: "ignorado",
        });
      }
    }
    if (linhas.length) {
      const { data: antes } = await admin.from("ig_comments").select("id").in("id", linhas.map((l) => l.id as string));
      const ja = new Set((antes ?? []).map((a) => a.id));
      novos += linhas.filter((l) => !ja.has(l.id as string)).length;
      await admin.from("ig_comments").upsert(linhas, { onConflict: "id", ignoreDuplicates: true });
    }
    await admin.from("ig_posts").update({ comments_fetched: post.comments_count }).eq("id", post.id);
  }
  return { ok: true, posts: posts.length, comentarios_novos: novos };
}

// ---------- funil ----------
type Fluxo = { id: string; name: string; keyword: string; post_id: string | null; reply_public: string; dm_text: string; link_url: string | null; active: boolean; activated_at: string | null; hits: number };

function acharFluxo(fluxos: Fluxo[], c: { text: string; post_id: string | null; commented_at: string | null }): Fluxo | null {
  return (
    fluxos.find(
      (f) =>
        f.active && f.activated_at && c.commented_at && c.commented_at >= f.activated_at &&
        (!f.post_id || f.post_id === c.post_id) && casaPalavra(c.text, f.keyword),
    ) ?? null
  );
}

async function funil() {
  if (!TOKEN || !UID) return { enviados: 0 };
  const { data: fluxos } = await admin.from("ig_flows").select("*").eq("active", true);
  if (!fluxos?.length) return { enviados: 0 };
  const { data: coments } = await admin
    .from("ig_comments").select("*").eq("status", "novo").is("parent_id", null).order("commented_at").limit(50);
  let enviados = 0;
  for (const c of coments ?? []) {
    const f = acharFluxo(fluxos as Fluxo[], c);
    if (!f) { await admin.from("ig_comments").update({ status: "ignorado" }).eq("id", c.id).eq("status", "novo"); continue; }
    if (enviados >= MAX_ENVIOS_POR_CICLO) break;
    // Reserva o comentário para não responder duas vezes.
    const { data: reservado } = await admin
      .from("ig_comments").update({ status: "enviando", flow_id: f.id }).eq("id", c.id).eq("status", "novo").select("id");
    if (!reservado?.length) continue;

    const dados = { nome: c.username ?? "", link: f.link_url ?? "" };
    const pub = await ig(`${c.id}/replies`, { message: montar(f.reply_public, dados) });
    const dm = await ig(`${UID}/messages`, {
      recipient: JSON.stringify({ comment_id: c.id }),
      message: JSON.stringify({ text: textoDm(f, c.username ?? "") }),
    });
    enviados++;
    if (dm.ok) {
      await admin.from("ig_comments").update({
        status: "respondido", dm_sent_at: new Date().toISOString(),
        reply_public_id: pub.ok ? pub.data.id ?? null : null,
        error: pub.ok ? null : `Resposta pública falhou: ${msgErro(pub)}`,
      }).eq("id", c.id);
      await admin.from("ig_flows").update({ hits: f.hits + 1 }).eq("id", f.id);
    } else {
      await admin.from("ig_comments").update({
        status: "erro", reply_public_id: pub.ok ? pub.data.id ?? null : null,
        error: `Mensagem privada falhou: ${msgErro(dm)}`,
      }).eq("id", c.id);
    }
  }
  return { enviados };
}

// ---------- mini chat ----------
async function conversas() {
  if (!TOKEN || !UID) return { conversas: 0 };
  const r = await ig(
    `${UID}/conversations?platform=instagram&fields=id,updated_time,participants,messages.limit(15)%7Bid,message,from,created_time%7D&limit=25`,
  );
  if (!r.ok) return { erro: msgErro(r) };
  const lista = (r.data.data ?? []) as any[];
  const { data: antigas } = await admin.from("ig_threads").select("id, last_message_at, unread");
  const mapa = new Map((antigas ?? []).map((t) => [t.id, t]));
  for (const conv of lista) {
    const outro = (conv.participants?.data ?? []).find((x: any) => x.id !== UID) ?? {};
    const msgs = ((conv.messages?.data ?? []) as any[]).sort((a, b) => +new Date(a.created_time) - +new Date(b.created_time));
    const ultima = msgs[msgs.length - 1];
    const quando = ultima ? new Date(ultima.created_time).toISOString() : null;
    const antiga = mapa.get(conv.id);
    const chegouNova = !!ultima && ultima.from?.id !== UID && (!antiga?.last_message_at || (quando ?? "") > antiga.last_message_at);
    await admin.from("ig_threads").upsert({
      id: conv.id, participant_id: outro.id ?? null, participant_username: outro.username ?? null,
      last_message_at: quando, last_text: ultima?.message ?? null,
      unread: chegouNova ? true : antiga?.unread ?? false,
    }, { onConflict: "id" });
    if (msgs.length) {
      await admin.from("ig_messages").upsert(
        msgs.map((x) => ({
          id: x.id, thread_id: conv.id, direction: x.from?.id === UID ? "out" : "in",
          text: x.message ?? "", created_at: new Date(x.created_time).toISOString(),
        })),
        { onConflict: "id", ignoreDuplicates: true },
      );
    }
  }
  return { conversas: lista.length };
}

async function enviar(threadId: string, texto: string) {
  if (!TOKEN || !UID) return { erro: "Instagram ainda não conectado." };
  const t = texto.trim();
  if (!t) return { erro: "Escreva uma mensagem." };
  const { data: th } = await admin.from("ig_threads").select("participant_id").eq("id", threadId).maybeSingle();
  if (!th?.participant_id) return { erro: "Conversa não encontrada." };
  const r = await ig(`${UID}/messages`, { recipient: JSON.stringify({ id: th.participant_id }), message: JSON.stringify({ text: t }) });
  if (!r.ok) return { erro: `O Instagram não deixou enviar: ${msgErro(r)}` };
  const agora = new Date().toISOString();
  await admin.from("ig_messages").upsert({ id: r.data.message_id ?? `out_${crypto.randomUUID()}`, thread_id: threadId, direction: "out", text: t, via: "manual", created_at: agora }, { onConflict: "id" });
  await admin.from("ig_threads").update({ last_message_at: agora, last_text: t, unread: false }).eq("id", threadId);
  return { ok: true };
}

// Mostra o que o funil faria com um comentário, sem enviar nada.
async function simular(texto: string, postId: string | null) {
  const { data: fluxos } = await admin.from("ig_flows").select("*");
  const alvo = (fluxos ?? []).find(
    (f) => (!f.post_id || f.post_id === postId) && casaPalavra(texto, f.keyword),
  ) as Fluxo | undefined;
  if (!alvo) return { casou: false };
  const dados = { nome: "maria", link: alvo.link_url ?? "" };
  return {
    casou: true, regra: alvo.name, ativa: alvo.active,
    resposta_publica: montar(alvo.reply_public, dados), mensagem_privada: textoDm(alvo, "maria"),
  };
}

const hojeMaceio = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);

// Lê as métricas de desempenho de cada post (alcance, visualizações, salvos, compartilhamentos,
// tempo assistido). Posts novos atualizam a cada hora, os antigos uma vez por dia.
async function insights(forcar = false) {
  if (!TOKEN || !UID) return { erro: "Faltam os segredos IG_ACCESS_TOKEN e IG_USER_ID." };
  const agora = Date.now();
  const { data: posts } = await admin.from("ig_posts").select("id, product_type, posted_at, insights_at, insights_erro").order("posted_at", { ascending: false }).limit(30);
  const devidos = (posts ?? []).filter((x) => {
    if (forcar || !x.insights_at) return true;
    const idade = agora - new Date(x.insights_at).getTime();
    if (x.insights_erro) return idade > 15 * 60e3; // com erro, tenta de novo logo (ex.: depois de trocar o token)
    const novo = x.posted_at && agora - new Date(x.posted_at).getTime() < 7 * 86400e3;
    return idade > (novo ? 55 * 60e3 : 23 * 3600e3);
  });
  let lidos = 0;
  const erros: string[] = [];
  for (const x of devidos) {
    const reel = x.product_type === "REELS";
    const base = "reach,saved,shares,total_interactions,views";
    // Se o Instagram recusar uma métrica, a chamada inteira falha: por isso cai para conjuntos menores.
    const conjuntos = reel
      ? [`${base},ig_reels_avg_watch_time,ig_reels_video_view_total_time`, base, "reach,saved,shares,total_interactions"]
      : [base, "reach,saved,shares,total_interactions"];
    let r: Resp | null = null;
    for (const c of conjuntos) {
      r = await ig(`${x.id}/insights?metric=${c}`);
      if (r.ok) break;
      // Falta de permissão ou token inválido: tentar com menos métricas não adianta.
      if ([10, 190, 200].includes(Number(r.data?.error?.code))) break;
    }
    if (!r || !r.ok) {
      const motivo = r ? msgErro(r) : "sem resposta";
      erros.push(motivo);
      await admin.from("ig_posts").update({ insights_at: new Date().toISOString(), insights_erro: motivo.slice(0, 300) }).eq("id", x.id);
      continue;
    }
    const v: Record<string, number> = {};
    for (const m of (r.data.data ?? []) as any[]) v[m.name] = Number(m.values?.[0]?.value ?? m.total_value?.value ?? 0);
    await admin.from("ig_posts").update({
      views: v.views ?? null,
      reach: v.reach ?? null,
      saves: v.saved ?? null,
      shares: v.shares ?? null,
      interactions: v.total_interactions ?? null,
      avg_watch_ms: v.ig_reels_avg_watch_time != null ? Math.round(v.ig_reels_avg_watch_time) : null,
      total_watch_ms: v.ig_reels_video_view_total_time != null ? Math.round(v.ig_reels_video_view_total_time) : null,
      insights_at: new Date().toISOString(),
      insights_erro: null,
    }).eq("id", x.id);
    lidos++;
  }

  // Alcance e visualizações da conta nos últimos 28 dias (melhor esforço), guardados no retrato de hoje.
  if (devidos.length || forcar) {
    const ate = Math.floor(agora / 1000);
    const a = await ig(`${UID}/insights?metric=reach,views&period=day&metric_type=total_value&since=${ate - 28 * 86400}&until=${ate}`);
    if (a.ok) {
      const t: Record<string, number> = {};
      for (const m of (a.data.data ?? []) as any[]) t[m.name] = Number(m.total_value?.value ?? 0);
      await admin.from("ig_account_daily").upsert({ day: hojeMaceio(), reach: t.reach ?? null, views: t.views ?? null }, { onConflict: "day" });
    } else erros.push(`conta: ${msgErro(a)}`);
  }
  return { lidos, tentados: devidos.length, erros: [...new Set(erros)].slice(0, 3) };
}

async function ciclo(forcarInsights = false) {
  const s = await sincronizar();
  if ((s as { erro?: string }).erro) return { sincronizacao: s };
  const f = await funil();
  const c = await conversas();
  const i = await insights(forcarInsights).catch((e) => ({ erro: (e as Error).message }));
  return { sincronizacao: s, funil: f, conversas: c, insights: i };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
  const quem = await autorizar(req);
  if (!quem) return json({ erro: "Não autorizado." }, 401);
  const b = await req.json().catch(() => ({}));
  try {
    if (b.acao === "ciclo") return json(await ciclo(b.forcar === true));
    if (b.acao === "insights") return json(await insights(true));
    if (quem === "admin") {
      if (b.acao === "enviar" && typeof b.thread_id === "string") return json(await enviar(b.thread_id, String(b.texto ?? "")));
      if (b.acao === "simular") return json(await simular(String(b.texto ?? ""), typeof b.post_id === "string" ? b.post_id : null));
    }
    return json({ erro: "Ação inválida." }, 400);
  } catch (e) {
    return json({ erro: (e as Error).message }, 500);
  }
});
