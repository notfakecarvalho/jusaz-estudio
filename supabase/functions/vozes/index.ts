// Locução dos vídeos feita no servidor com a chave do ElevenLabs salva em Conexões.
// Serve o render na máquina do Erik: guarda o áudio e o tempo de cada palavra no Storage
// e devolve links temporários. A chave nunca sai daqui. Chamada só pelo cron/automação (x-cron-secret).
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

async function segredo(nome: string): Promise<string> {
  const { data } = await admin.rpc("segredo_ler", { nome });
  return (typeof data === "string" && data.trim()) || Deno.env.get(nome) || "";
}

const FECHO =
  "o JusAz te ajuda a descobrir seus direitos: você faz sua pergunta de graça e advogados verificados pela OAB, de todo o Brasil, respondem.";
const CTA_TIKTOK = "Entra no link da bio, ou acessa jusaz ponto com, e fala com os advogados.";

async function autorizado(req: Request) {
  const t = req.headers.get("x-cron-secret");
  if (!t) return false;
  const { data } = await admin.rpc("segredo_ok", { nome: "cron_secret", valor: t });
  return data === true;
}

async function uso() {
  const key = await segredo("ELEVENLABS_API_KEY");
  if (!key) return { erro: "Sem chave do ElevenLabs salva." };
  const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": key } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { erro: `ElevenLabs respondeu ${r.status}: ${String(j?.detail?.message ?? j?.detail ?? "").slice(0, 160)}` };
  return {
    plano: j.tier, usados: j.character_count, limite: j.character_limit,
    restam: Number(j.character_limit) - Number(j.character_count), renova_em: j.next_character_count_reset_unix,
  };
}

function emPalavras(al: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] }) {
  const out: { text: string; type: string; start: number; end: number }[] = [];
  let atual = "", ini = 0, fim = 0;
  al.characters.forEach((c, i) => {
    if (/\s/.test(c)) {
      if (atual) out.push({ text: atual, type: "word", start: ini, end: fim });
      atual = "";
    } else {
      if (!atual) ini = al.character_start_times_seconds[i];
      atual += c;
      fim = al.character_end_times_seconds[i];
    }
  });
  if (atual) out.push({ text: atual, type: "word", start: ini, end: fim });
  return out;
}

async function links(base: string) {
  const a = await admin.storage.from("audio").createSignedUrl(`${base}/voz.mp3`, 7200);
  const w = await admin.storage.from("audio").createSignedUrl(`${base}/words.json`, 7200);
  return { audio_url: a.data?.signedUrl ?? null, words_url: w.data?.signedUrl ?? null };
}

async function gerar(videoId: string, forcar: boolean) {
  const { data: v } = await admin.from("videos").select("id, platform, scripts(slug, story, closing_lead, keyword)").eq("id", videoId).maybeSingle();
  if (!v) return { erro: "Vídeo não encontrado." };
  const s = (Array.isArray(v.scripts) ? v.scripts[0] : v.scripts) as { slug: string; story: string; closing_lead: string; keyword: string };
  const base = `${v.id}/local`;
  if (!forcar) {
    const { data: ja } = await admin.storage.from("audio").list(base);
    if ((ja ?? []).some((f) => f.name === "voz.mp3") && (ja ?? []).some((f) => f.name === "words.json")) {
      return { ok: true, reaproveitado: true, slug: s.slug, plataforma: v.platform, ...(await links(base)) };
    }
  }
  const key = await segredo("ELEVENLABS_API_KEY");
  if (!key) return { erro: "Sem chave do ElevenLabs salva." };
  const { data: cfg } = await admin.from("settings").select("voice_id").eq("id", true).single();
  const cta = v.platform === "tiktok" ? CTA_TIKTOK : `Comenta ${s.keyword} que eu te mando o link.`;
  const texto = `${s.story} ${s.closing_lead} ${FECHO} ${cta}`;
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${cfg!.voice_id}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: texto,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    return { erro: `ElevenLabs respondeu ${r.status}: ${t.slice(0, 200)}`, slug: s.slug, plataforma: v.platform };
  }
  const j = await r.json();
  const bytes = Uint8Array.from(atob(j.audio_base64), (c) => c.charCodeAt(0));
  const palavras = emPalavras(j.alignment ?? j.normalized_alignment);
  // Primeiro o tempo das palavras (se falhar aqui, o áudio não fica órfão); depois o áudio.
  const up2 = await admin.storage.from("audio").upload(`${base}/words.json`, new TextEncoder().encode(JSON.stringify({ words: palavras })), { contentType: "application/json", upsert: true });
  if (up2.error) return { erro: `Voz gerada, mas não consegui guardar o tempo das palavras: ${up2.error.message}` };
  const up1 = await admin.storage.from("audio").upload(`${base}/voz.mp3`, bytes, { contentType: "audio/mpeg", upsert: true });
  if (up1.error) return { erro: up1.error.message };
  return { ok: true, slug: s.slug, plataforma: v.platform, caracteres: texto.length, palavras: palavras.length, ...(await links(base)) };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
  if (!(await autorizado(req))) return json({ erro: "Não autorizado." }, 401);
  const b = await req.json().catch(() => ({}));
  try {
    if (b.acao === "uso") return json(await uso());
    if (b.acao === "gerar" && typeof b.video_id === "string") return json(await gerar(b.video_id, b.forcar === true));
    return json({ erro: "Ação inválida." }, 400);
  } catch (e) {
    return json({ erro: (e as Error).message }, 500);
  }
});
