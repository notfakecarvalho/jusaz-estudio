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

export type Plataforma = "instagram" | "tiktok";

export type Video = {
  id: string;
  script_id: string;
  platform: Plataforma;
  slot: 1 | 2;
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
  tiktok_status: "enviado" | "postado" | "erro" | null;
  tiktok_publish_id: string | null;
  tiktok_sent_at: string | null;
  tiktok_error: string | null;
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
  post_hour_2: string;
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
  kind: "elevenlabs" | "instagram" | "manychat" | "supabase" | "render_worker" | "tiktok";
  status: "conectado" | "desconectado" | "atencao";
  label: string | null;
  meta: Record<string, unknown>;
  checked_at: string | null;
};

// Fecho padrão do JusAz: igual em todos os vídeos. Só a ligação com o caso e a palavra mudam,
// e a última frase muda por plataforma (no Instagram comenta; no TikTok chama no direct).
export const FECHO_BASE =
  "o JusAz te ajuda a descobrir seus direitos: você faz sua pergunta de graça e advogados verificados pela OAB, de todo o Brasil, respondem.";

export const CTA_ANTES: Record<Plataforma, string> = {
  instagram: "Comenta",
  tiktok: "Me chama no direct e manda",
};
export const CTA_DEPOIS = " que eu te mando o link.";

export const ROTULO_PLATAFORMA: Record<Plataforma, string> = { instagram: "Instagram", tiktok: "TikTok" };

export function ctaFalado(keyword: string, plataforma: Plataforma = "instagram") {
  return `${CTA_ANTES[plataforma]} ${keyword}${CTA_DEPOIS}`;
}

export function fechoPadrao(keyword: string, plataforma: Plataforma = "instagram") {
  return `${FECHO_BASE} ${ctaFalado(keyword, plataforma)}`;
}

export function textoFalado(s: Pick<Script, "story" | "closing_lead" | "keyword">, plataforma: Plataforma = "instagram") {
  return `${s.story} ${s.closing_lead} ${fechoPadrao(s.keyword, plataforma)}`;
}

// Legenda de partida da versão: a do roteiro, com o convite da plataforma.
export function legendaPadrao(s: Pick<Script, "caption" | "keyword">, plataforma: Plataforma) {
  if (plataforma !== "tiktok") return s.caption;
  return s.caption.replace(`${CTA_ANTES.instagram} ${s.keyword}`, `${CTA_ANTES.tiktok} ${s.keyword}`);
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

export type TiktokConta = {
  open_id: string;
  display_name: string | null;
  avatar_url: string | null;
  followers: number | null;
  following: number | null;
  likes: number | null;
  video_count: number | null;
  principal: boolean;
  synced_at: string | null;
};

export type TiktokVideo = {
  id: string;
  title: string | null;
  cover_url: string | null;
  share_url: string | null;
  duration_s: number | null;
  posted_at: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  video_id: string | null;
  synced_at: string | null;
};

export type TiktokDia = { day: string; followers: number | null; likes: number | null; video_count: number | null };
