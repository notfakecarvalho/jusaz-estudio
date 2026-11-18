"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export async function sair() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/login");
}

export async function salvarRoteiro(formData: FormData) {
  const sb = await supabaseServer();
  const id = String(formData.get("id"));
  const hashtags = String(formData.get("hashtags") ?? "")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .slice(0, 5);
  const { error } = await sb
    .from("scripts")
    .update({
      hook: String(formData.get("hook") ?? ""),
      hook_alt: String(formData.get("hook_alt") ?? ""),
      story: String(formData.get("story") ?? ""),
      closing_lead: String(formData.get("closing_lead") ?? ""),
      caption: String(formData.get("caption") ?? ""),
      hashtags,
      status: String(formData.get("status") ?? "pronto"),
      fact_note: String(formData.get("fact_note") ?? "") || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/roteiros");
  revalidatePath("/");
}

export async function marcarConferido(formData: FormData) {
  const sb = await supabaseServer();
  const { error } = await sb
    .from("scripts")
    .update({ status: "pronto", fact_note: null })
    .eq("id", String(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function alternarRegra(formData: FormData) {
  const sb = await supabaseServer();
  const campo = String(formData.get("campo"));
  const permitido = ["post_without_review", "hold_on_check", "auto_generate"];
  if (!permitido.includes(campo)) return;
  const valor = formData.get("valor") === "true";
  const { error } = await sb.from("settings").update({ [campo]: valor }).eq("id", true);
  if (error) throw new Error(error.message);
  revalidatePath("/fila");
}

export async function salvarRegras(formData: FormData) {
  const sb = await supabaseServer();
  const hora = String(formData.get("post_hour") ?? "12:00");
  const lead = Math.max(0, Math.min(14, Number(formData.get("lead_days") ?? 2)));
  const { error } = await sb.from("settings").update({ post_hour: hora, lead_days: lead }).eq("id", true);
  if (error) throw new Error(error.message);
  revalidatePath("/fila");
}

export async function gerarVideo(formData: FormData) {
  const sb = await supabaseServer();
  const videoId = String(formData.get("video_id"));
  const { data: ativo } = await sb
    .from("render_jobs")
    .select("id")
    .eq("video_id", videoId)
    .in("status", ["queued", "running"])
    .limit(1);
  if (!ativo?.length) {
    const { error } = await sb.from("render_jobs").insert({ video_id: videoId });
    if (error) throw new Error(error.message);
    await sb.from("videos").update({ status: "na_fila", progress: 0, error: null }).eq("id", videoId);
  }
  revalidatePath("/", "layout");
}

export async function salvarLegenda(formData: FormData) {
  const sb = await supabaseServer();
  const { error } = await sb
    .from("videos")
    .update({ caption: String(formData.get("caption") ?? "") })
    .eq("id", String(formData.get("video_id")));
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function reagendar(formData: FormData) {
  const sb = await supabaseServer();
  const data = String(formData.get("scheduled_for") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return;
  const { error } = await sb.from("videos").update({ scheduled_for: data }).eq("id", String(formData.get("video_id")));
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function postarAgora(formData: FormData) {
  const sb = await supabaseServer();
  const { data, error } = await sb.functions.invoke("automacao", {
    body: { acao: "postar", video_id: String(formData.get("video_id")) },
  });
  if (error) throw new Error(error.message);
  if (data?.erro) throw new Error(String(data.erro));
  revalidatePath("/", "layout");
}
