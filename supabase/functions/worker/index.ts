// API do worker de render: pega trabalhos, gera a voz, recebe o progresso e o vídeo pronto.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

const FECHO =
  "o JusAz te ajuda a descobrir seus direitos: você faz sua pergunta de graça e advogados verificados pela OAB, de todo o Brasil, respondem.";

async function autorizado(req: Request) {
  const t = req.headers.get("x-worker-token");
  if (!t) return false;
  const { data } = await admin.rpc("segredo_ok", { nome: "worker_token", valor: t });
  return data === true;
}

async function pegar(worker: string) {
  const { data: fila } = await admin.from("render_jobs").select("id").eq("status", "queued").order("created_at").limit(1);
  if (!fila?.length) return { job: null };
  const { data: job } = await admin
    .from("render_jobs")
    .update({ status: "running", started_at: new Date().toISOString(), worker })
    .eq("id", fila[0].id)
    .eq("status", "queued")
    .select()
    .maybeSingle();
  if (!job) return { job: null };
  const { data: video } = await admin.from("videos").select("*, scripts(*)").eq("id", job.video_id).single();
  await admin.from("videos").update({ status: "voz", progress: 5, error: null }).eq("id", job.video_id);
  const s = video.scripts;
  const { data: cfg } = await admin.from("settings").select("*").eq("id", true).single();
  return {
    job,
    video: { id: video.id, scheduled_for: video.scheduled_for, plataforma: video.platform },
    roteiro: { slug: s.slug, titulo: s.title, palavra: s.keyword, gancho: s.hook },
    texto: `${s.story} ${s.closing_lead} ${FECHO} ${video.platform === "tiktok" ? "Entra no link da bio, ou acessa jusaz ponto com, e fala com os advogados." : `Comenta ${s.keyword} que eu te mando o link.`}`,
    config: { voz_id: cfg.voice_id, velocidade: cfg.voice_speed, musica_db: cfg.music_db },
  };
}

// Junta o alinhamento por caractere do ElevenLabs em palavras com início e fim.
function emPalavras(al: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] }) {
  const out: { w: string; start: number; end: number }[] = [];
  let atual = "";
  let ini = 0;
  let fim = 0;
  al.characters.forEach((c, i) => {
    if (/\s/.test(c)) {
      if (atual) out.push({ w: atual, start: ini, end: fim });
      atual = "";
    } else {
      if (!atual) ini = al.character_start_times_seconds[i];
      atual += c;
      fim = al.character_end_times_seconds[i];
    }
  });
  if (atual) out.push({ w: atual, start: ini, end: fim });
  return out;
}

async function voz(jobId: string, texto: string, vozId: string) {
  const key = Deno.env.get("ELEVENLABS_API_KEY");
  if (!key) return { erro: "Falta o segredo ELEVENLABS_API_KEY." };
  const { data: job } = await admin.from("render_jobs").select("video_id").eq("id", jobId).single();
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vozId}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: texto,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
    }),
  });
  if (!r.ok) return { erro: `ElevenLabs respondeu ${r.status}: ${(await r.text()).slice(0, 200)}` };
  const j = await r.json();
  const bytes = Uint8Array.from(atob(j.audio_base64), (c) => c.charCodeAt(0));
  const path = `${job!.video_id}/locucao-${Date.now()}.mp3`;
  const up = await admin.storage.from("audio").upload(path, bytes, { contentType: "audio/mpeg", upsert: true });
  if (up.error) return { erro: up.error.message };
  await admin.from("videos").update({ voice_path: path }).eq("id", job!.video_id);
  const { data: signed } = await admin.storage.from("audio").createSignedUrl(path, 3600);
  return { audio_url: signed?.signedUrl, audio_path: path, palavras: emPalavras(j.alignment ?? j.normalized_alignment) };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
  if (!(await autorizado(req))) return json({ erro: "Não autorizado." }, 401);
  const b = await req.json().catch(() => ({}));
  try {
    switch (b.acao) {
      case "batimento": {
        await admin
          .from("connections")
          .update({ status: "conectado", label: b.worker ?? "worker", checked_at: new Date().toISOString() })
          .eq("kind", "render_worker");
        return json({ ok: true });
      }
      case "pegar":
        return json(await pegar(String(b.worker ?? "worker")));
      case "voz":
        return json(await voz(String(b.job_id), String(b.texto), String(b.voz_id)));
      case "progresso": {
        const { data: job } = await admin
          .from("render_jobs")
          .update({ frame: b.frame ?? 0, total_frames: b.total_frames ?? 0 })
          .eq("id", b.job_id)
          .select("video_id")
          .single();
        const etapa = ["voz", "render", "mixagem"].includes(b.etapa) ? b.etapa : "render";
        await admin.from("videos").update({ status: etapa, progress: Math.max(0, Math.min(99, Number(b.progress ?? 0))) }).eq("id", job!.video_id);
        return json({ ok: true });
      }
      case "enviar": {
        const { data: job } = await admin.from("render_jobs").select("video_id").eq("id", b.job_id).single();
        const path = `${job!.video_id}/reel-${Date.now()}.mp4`;
        const { data, error } = await admin.storage.from("videos").createSignedUploadUrl(path);
        if (error) return json({ erro: error.message }, 500);
        return json({ url: data.signedUrl, path });
      }
      case "concluir": {
        const { data: job } = await admin
          .from("render_jobs")
          .update({ status: "done", finished_at: new Date().toISOString() })
          .eq("id", b.job_id)
          .select("video_id")
          .single();
        await admin
          .from("videos")
          .update({
            status: "pronto",
            progress: 100,
            final_path: b.final_path,
            duration_s: b.duration_s ?? null,
            loudness_lufs: b.loudness_lufs ?? null,
            ig_container_id: null,
            error: null,
          })
          .eq("id", job!.video_id);
        return json({ ok: true });
      }
      case "falhar": {
        const { data: job } = await admin
          .from("render_jobs")
          .update({ status: "failed", finished_at: new Date().toISOString(), log: String(b.erro ?? "").slice(0, 4000) })
          .eq("id", b.job_id)
          .select("video_id")
          .single();
        await admin.from("videos").update({ status: "erro", error: String(b.erro ?? "Falha no render").slice(0, 300) }).eq("id", job!.video_id);
        return json({ ok: true });
      }
      default:
        return json({ erro: "Ação inválida." }, 400);
    }
  } catch (e) {
    return json({ erro: (e as Error).message }, 500);
  }
});
