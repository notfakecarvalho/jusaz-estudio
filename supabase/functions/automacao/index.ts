// Automação do Estúdio JusAz: roda a cada 10 minutos (pg_cron) e quando o Erik clica em "Postar agora".
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

const IG = "https://graph.instagram.com/v23.0";
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
  const token = Deno.env.get("IG_ACCESS_TOKEN");
  const uid = Deno.env.get("IG_USER_ID");
  if (!token || !uid) return { erro: "Instagram ainda não conectado: faltam os segredos IG_ACCESS_TOKEN e IG_USER_ID." };

  const { data: v } = await admin.from("videos").select("*, scripts(*)").eq("id", videoId).maybeSingle();
  if (!v) return { erro: "Vídeo não encontrado." };
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
  return { ok: true, media_id: pj.id };
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
    .select("id, status, scheduled_for, scripts(status)")
    .lte("scheduled_for", limite)
    .in("status", ["na_fila", "pronto"])
    .order("scheduled_for");

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
    const horaPost = String(cfg.post_hour).slice(0, 5);
    const prontos = (videos ?? []).filter(
      (v) => v.status === "pronto" && seguro(v) && v.scheduled_for && v.scheduled_for <= hoje && (v.scheduled_for < hoje || hora >= horaPost),
    );
    for (const v of prontos.slice(0, 1)) {
      const r = await publicar(v.id);
      relatorio[`post_${v.id}`] = r;
      if ((r as { ok?: boolean }).ok) (relatorio.postados as string[]).push(v.id);
    }
  }
  return relatorio;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
  const quem = await autorizar(req);
  if (!quem) return json({ erro: "Não autorizado." }, 401);
  const body = await req.json().catch(() => ({}));
  try {
    if (body.acao === "diaria" && quem === "cron") return json(await diaria());
    if (body.acao === "postar" && quem === "admin" && typeof body.video_id === "string") return json(await publicar(body.video_id));
    return json({ erro: "Ação inválida." }, 400);
  } catch (e) {
    return json({ erro: (e as Error).message }, 500);
  }
});
