export type ScriptStatus = "rascunho" | "pronto" | "conferir_fato";
export type VideoStatus = "na_fila" | "voz" | "render" | "mixagem" | "pronto" | "postado" | "erro";

export type Script = {
  id: string;
  position: number;
  slug: string;
  title: string;
  keyword: string;
  hook: string;
  hook_alt: string;
  story: string;
  closing_lead: string;
  caption: string;
  hashtags: string[];
  status: ScriptStatus;
  fact_note: string | null;
};

export type Video = {
  id: string;
  script_id: string;
  scheduled_for: string | null;
  status: VideoStatus;
  progress: number;
  voice_path: string | null;
  final_path: string | null;
  thumb_path: string | null;
  duration_s: number | null;
  loudness_lufs: number | null;
  caption: string | null;
  ig_media_id: string | null;
  posted_at: string | null;
  error: string | null;
  scripts?: Script | null;
};

export type RenderJob = {
  id: string;
  video_id: string;
  status: "queued" | "running" | "done" | "failed";
  frame: number;
  total_frames: number;
  worker: string | null;
  started_at: string | null;
  finished_at: string | null;
};

export type Settings = {
  post_hour: string;
  timezone: string;
  lead_days: number;
  post_without_review: boolean;
  hold_on_check: boolean;
  auto_generate: boolean;
  voice_id: string | null;
  voice_name: string;
  voice_speed: number;
  music_db: number;
};

export type Connection = {
  kind: "elevenlabs" | "instagram" | "manychat" | "supabase" | "render_worker";
  status: "conectado" | "desconectado" | "atencao";
  label: string | null;
  meta: Record<string, unknown>;
  checked_at: string | null;
};

// Fecho padrão do JusAz: a única parte que muda por vídeo é a frase de ligação e a palavra.
export const FECHO_ANTES =
  "o JusAz te ajuda a descobrir seus direitos: você faz sua pergunta de graça e advogados verificados pela OAB, de todo o Brasil, respondem. Comenta ";
export const FECHO_DEPOIS = " que eu te mando o link.";

export function fechoPadrao(keyword: string) {
  return `${FECHO_ANTES}${keyword}${FECHO_DEPOIS}`;
}

export function textoFalado(s: Pick<Script, "story" | "closing_lead" | "keyword">) {
  return `${s.story} ${s.closing_lead} ${fechoPadrao(s.keyword)}`;
}

export const AVISO_OAB =
  "Conteúdo informativo, não é aconselhamento jurídico. As histórias são ilustrativas.";

export type IgAccount = {
  ig_user_id: string | null; username: string | null; name: string | null; picture_url: string | null;
  followers: number | null; follows: number | null; media_count: number | null; synced_at: string | null;
};
export type IgPost = {
  id: string; caption: string | null; media_type: string | null; product_type: string | null; permalink: string | null;
  thumb_url: string | null; posted_at: string | null; likes: number; comments_count: number; video_id: string | null;
  views: number | null; reach: number | null; saves: number | null; shares: number | null; interactions: number | null;
  avg_watch_ms: number | null; total_watch_ms: number | null; insights_at: string | null; insights_erro: string | null;
};
export type IgDia = {
  day: string; followers: number | null; follows: number | null; media_count: number | null;
  reach: number | null; views: number | null;
};
export type IgFlow = {
  id: string; name: string; keyword: string; post_id: string | null; reply_public: string; dm_text: string;
  link_url: string | null; active: boolean; hits: number; activated_at: string | null;
};
export type IgComment = {
  id: string; post_id: string | null; username: string | null; text: string; commented_at: string | null;
  parent_id: string | null; flow_id: string | null; status: "novo" | "enviando" | "respondido" | "ignorado" | "erro";
  dm_sent_at: string | null; error: string | null;
};
export type IgThread = {
  id: string; participant_id: string | null; participant_username: string | null; last_message_at: string | null;
  last_text: string | null; unread: boolean;
};
export type IgMessage = { id: string; thread_id: string; direction: "in" | "out"; text: string; via: string; created_at: string };
export type Idea = {
  id: string; title: string; hook: string | null; angle: string | null; keyword: string | null;
  source: string; status: "nova" | "aprovada" | "descartada"; created_at: string;
};
