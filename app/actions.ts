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
  const hora = String(formData.get("post_hour") ?? "09:00");
  const hora2 = String(formData.get("post_hour_2") ?? "18:00");
  const lead = Math.max(0, Math.min(14, Number(formData.get("lead_days") ?? 2)));
  const valida = (h: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h);
  if (!valida(hora) || !valida(hora2)) return;
  const { error } = await sb.from("settings").update({ post_hour: hora, post_hour_2: hora2, lead_days: lead }).eq("id", true);
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
  const slot = Number(formData.get("slot")) === 2 ? 2 : 1;
  const { data: v } = await sb.from("videos").select("script_id").eq("id", String(formData.get("video_id"))).maybeSingle();
  if (!v) return;
  // As duas versões do roteiro (Instagram e TikTok) andam juntas.
  const { error } = await sb.from("videos").update({ scheduled_for: data, slot }).eq("script_id", v.script_id);
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

// Vídeo renderizado fora da plataforma (ex.: pelo Claude): o arquivo já foi enviado ao Storage pelo navegador;
// aqui ele vira o vídeo oficial do dia e entra na agenda (posta na data e hora combinadas).
export async function anexarVideo(videoId: string, caminho: string, duracao: number | null) {
  const sb = await supabaseServer();
  if (!/^[0-9a-f-]{36}\/reel-\d+\.mp4$/.test(caminho) || !caminho.startsWith(`${videoId}/`)) throw new Error("Caminho de arquivo inválido.");
  const { data: v } = await sb.from("videos").select("status").eq("id", videoId).maybeSingle();
  if (!v) throw new Error("Vídeo não encontrado.");
  if (v.status === "postado") throw new Error("Este vídeo já foi postado.");
  const { error } = await sb
    .from("videos")
    .update({
      final_path: caminho,
      status: "pronto",
      progress: 100,
      duration_s: duracao && duracao > 0 && duracao < 600 ? Math.round(duracao * 10) / 10 : null,
      ig_container_id: null,
      error: null,
    })
    .eq("id", videoId);
  if (error) throw new Error(error.message);
  await sb
    .from("render_jobs")
    .update({ status: "done", finished_at: new Date().toISOString(), log: "Vídeo enviado direto pelo estúdio." })
    .eq("video_id", videoId)
    .in("status", ["queued", "running"]);
  revalidatePath("/", "layout");
}

export async function testarInstagram() {
  const sb = await supabaseServer();
  const { error } = await sb.functions.invoke("automacao", { body: { acao: "instagram" } });
  if (error) throw new Error(error.message);
  revalidatePath("/conexoes");
}

// ---------- Instagram, funil, mensagens, ideias ----------
function volta(caminho: string, erro?: string, ok?: string): never {
  const q = new URLSearchParams();
  if (erro) q.set("erro", erro);
  if (ok) q.set("ok", ok);
  redirect(q.size ? `${caminho}${caminho.includes("?") ? "&" : "?"}${q}` : caminho);
}

export async function atualizarInstagram() {
  const sb = await supabaseServer();
  const { data, error } = await sb.functions.invoke("instagram", { body: { acao: "ciclo", forcar: true } });
  revalidatePath("/", "layout");
  const erro = error?.message ?? data?.sincronizacao?.erro;
  if (erro) volta("/instagram", String(erro));
  volta("/instagram", undefined, "Instagram atualizado.");
}

export async function atualizarInsights() {
  const sb = await supabaseServer();
  const { data, error } = await sb.functions.invoke("instagram", { body: { acao: "ciclo", forcar: true } });
  revalidatePath("/", "layout");
  const erro = error?.message ?? data?.sincronizacao?.erro;
  if (erro) volta("/insights", String(erro));
  const i = data?.insights as { lidos?: number; erros?: string[] } | undefined;
  if (i && !i.lidos && i.erros?.length) volta("/insights", `O Instagram não liberou as métricas: ${i.erros[0]}`);
  volta("/insights", undefined, "Métricas atualizadas.");
}

export async function tentarDeNovo(formData: FormData) {
  const sb = await supabaseServer();
  await sb.from("ig_comments").update({ status: "novo", error: null }).eq("id", String(formData.get("id")));
  revalidatePath("/instagram");
}

const limpaPalavra = (v: FormDataEntryValue | null) => String(v ?? "").trim().toUpperCase().replace(/\s+/g, "");

export async function salvarFluxo(formData: FormData) {
  const sb = await supabaseServer();
  const id = String(formData.get("id") ?? "");
  const link = String(formData.get("link_url") ?? "").trim();
  const campos = {
    name: String(formData.get("name") ?? "").trim() || "Regra",
    keyword: limpaPalavra(formData.get("keyword")),
    post_id: String(formData.get("post_id") ?? "") || null,
    reply_public: String(formData.get("reply_public") ?? "").trim(),
    dm_text: String(formData.get("dm_text") ?? "").trim(),
    link_url: link || null,
  };
  if (!campos.keyword) volta("/funil", "Escolha a palavra que o comentário precisa ter.");
  if (link && !/^https:\/\//i.test(link)) volta("/funil", "O link precisa começar com https://");
  if (id) {
    const { error } = await sb.from("ig_flows").update(campos).eq("id", id);
    if (error) volta("/funil", error.message);
  } else {
    const { error } = await sb.from("ig_flows").insert(campos);
    if (error) volta("/funil", error.message);
  }
  revalidatePath("/funil");
  volta("/funil", undefined, "Regra salva.");
}

export async function alternarFluxo(formData: FormData) {
  const sb = await supabaseServer();
  const id = String(formData.get("id"));
  const ligar = String(formData.get("ligar")) === "true";
  if (ligar) {
    const { data: f } = await sb.from("ig_flows").select("link_url, dm_text").eq("id", id).maybeSingle();
    if (!f?.link_url || !f.dm_text) volta("/funil", "Preencha a mensagem privada e o link antes de ligar a regra.");
  }
  await sb.from("ig_flows").update({ active: ligar }).eq("id", id);
  revalidatePath("/funil");
  volta("/funil", undefined, ligar ? "Regra ligada. Só vale para comentários feitos daqui para frente." : "Regra desligada.");
}

export async function excluirFluxo(formData: FormData) {
  const sb = await supabaseServer();
  await sb.from("ig_flows").delete().eq("id", String(formData.get("id")));
  revalidatePath("/funil");
  volta("/funil", undefined, "Regra apagada.");
}

export async function enviarMensagem(formData: FormData) {
  const thread = String(formData.get("thread_id"));
  const sb = await supabaseServer();
  const { data, error } = await sb.functions.invoke("instagram", {
    body: { acao: "enviar", thread_id: thread, texto: String(formData.get("texto") ?? "") },
  });
  revalidatePath("/mensagens");
  const erro = error?.message ?? data?.erro;
  if (erro) volta(`/mensagens?c=${thread}`, String(erro));
  volta(`/mensagens?c=${thread}`);
}

export async function gerarIdeias() {
  const sb = await supabaseServer();
  const { data, error } = await sb.functions.invoke("ideias", { body: { acao: "gerar" } });
  revalidatePath("/ideias");
  const erro = error?.message ?? data?.erro;
  if (erro) volta("/ideias", String(erro));
  volta("/ideias", undefined, `${data?.criadas ?? 0} ideias novas.`);
}

export async function decidirIdeia(formData: FormData) {
  const sb = await supabaseServer();
  const id = String(formData.get("id"));
  const decisao = String(formData.get("decisao"));
  if (decisao === "roteiro") {
    const { data: i } = await sb.from("ideas").select("*").eq("id", id).maybeSingle();
    if (!i) volta("/ideias", "Ideia não encontrada.");
    const { data: ult } = await sb.from("scripts").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
    const slug = String(i.title).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    const { error } = await sb.from("scripts").insert({
      position: (ult?.position ?? 0) + 1,
      slug: `${slug}-${Date.now().toString(36)}`,
      title: i.title,
      keyword: String(i.keyword ?? "AJUDA").toUpperCase(),
      hook: i.hook ?? "",
      story: i.angle ?? "",
      status: "rascunho",
    });
    if (error) volta("/ideias", error.message);
    await sb.from("ideas").update({ status: "aprovada" }).eq("id", id);
    revalidatePath("/ideias");
    volta("/ideias", undefined, "Virou rascunho em Roteiros. Falta escrever a história e conferir os fatos.");
  }
  await sb.from("ideas").update({ status: decisao === "descartar" ? "descartada" : "nova" }).eq("id", id);
  revalidatePath("/ideias");
}

// ---------- TikTok ----------
export async function conectarTiktok() {
  const sb = await supabaseServer();
  const { data, error } = await sb.functions.invoke("tiktok", { body: { acao: "url" } });
  if (error || !data?.url) volta("/conexoes", error?.message ?? data?.erro ?? "Não consegui abrir o login do TikTok.");
  redirect(String(data.url));
}

export async function desconectarTiktok() {
  const sb = await supabaseServer();
  const { error } = await sb.functions.invoke("tiktok", { body: { acao: "desconectar" } });
  revalidatePath("/", "layout");
  if (error) volta("/conexoes", error.message);
  volta("/conexoes", undefined, "TikTok desconectado.");
}

async function sincronizarTiktok(destino: string): Promise<never> {
  const sb = await supabaseServer();
  const { data, error } = await sb.functions.invoke("tiktok", { body: { acao: "sincronizar" } });
  revalidatePath("/", "layout");
  const primeiro = (data?.metricas as { erro?: string; aviso?: string }[] | undefined)?.[0];
  const erro = error?.message ?? primeiro?.erro;
  if (erro) volta(destino, String(erro));
  if (primeiro?.aviso) volta(destino, primeiro.aviso);
  volta(destino, undefined, "TikTok atualizado.");
}

export async function atualizarTiktok() {
  return sincronizarTiktok("/insights?r=tiktok");
}

export async function atualizarTiktokMenu() {
  return sincronizarTiktok("/tiktok");
}

export async function enviarTiktok(formData: FormData) {
  const id = String(formData.get("video_id"));
  const sb = await supabaseServer();
  const { data, error } = await sb.functions.invoke("tiktok", { body: { acao: "enviar", video_id: id } });
  revalidatePath(`/videos/${id}`);
  const erro = error?.message ?? data?.erro;
  if (erro) volta(`/videos/${id}`, String(erro));
  volta(`/videos/${id}`, undefined, "Rascunho enviado. Abra o TikTok, toque na notificação e publique.");
}
