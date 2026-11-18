import { supabaseServer } from "@/lib/supabase/server";
import type { IgAccount, IgComment, IgDia, IgPost, RenderJob, Script, Settings, Video } from "@/lib/types";

export async function listarVideos(desde?: string) {
  const sb = await supabaseServer();
  let q = sb.from("videos").select("*, scripts(*)").order("scheduled_for", { ascending: true });
  if (desde) q = q.gte("scheduled_for", desde);
  const { data } = await q.returns<Video[]>();
  return data ?? [];
}

export async function ultimoJob(videoId: string) {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("render_jobs")
    .select("*")
    .eq("video_id", videoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<RenderJob>();
  return data;
}

export async function listarRoteiros() {
  const sb = await supabaseServer();
  const { data } = await sb.from("scripts").select("*").order("position").returns<Script[]>();
  return data ?? [];
}

export async function configuracoes() {
  const sb = await supabaseServer();
  const { data } = await sb.from("settings").select("*").eq("id", true).single<Settings>();
  return data!;
}

export function urlPublica(path: string | null) {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/videos/${path}`;
}

export async function contaInstagram() {
  const sb = await supabaseServer();
  const { data } = await sb.from("ig_account").select("*").eq("id", true).maybeSingle<IgAccount>();
  return data;
}

export async function postsInstagram(limite = 30) {
  const sb = await supabaseServer();
  const { data } = await sb.from("ig_posts").select("*").order("posted_at", { ascending: false }).limit(limite).returns<IgPost[]>();
  return data ?? [];
}

export async function comentariosRecentes(limite = 25) {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("ig_comments")
    .select("*")
    .is("parent_id", null)
    .order("commented_at", { ascending: false })
    .limit(limite)
    .returns<IgComment[]>();
  return data ?? [];
}

export async function retratosConta(dias = 60) {
  const sb = await supabaseServer();
  const { data } = await sb.from("ig_account_daily").select("*").order("day", { ascending: false }).limit(dias).returns<IgDia[]>();
  return (data ?? []).reverse();
}
