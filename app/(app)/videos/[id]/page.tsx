import Link from "next/link";
import { notFound } from "next/navigation";
import { Pipeline } from "@/components/Pipeline";
import { EnviarVideo } from "@/components/EnviarVideo";
import { Copiar } from "@/components/Copiar";
import { enviarTiktok, gerarVideo, postarAgora, reagendar, salvarLegenda } from "@/app/actions";
import { ROTULO_VIDEO, classeBadgeVideo, dataCurta, horaDoSlot } from "@/lib/format";
import { configuracoes, ultimoJob, urlPublica } from "@/lib/queries";
import { AVISO_OAB, ROTULO_PLATAFORMA, legendaPadrao } from "@/lib/types";
import type { Video } from "@/lib/types";
import { supabaseServer } from "@/lib/supabase/server";

export default async function VideoPagina({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { id } = await params;
  const { ok, erro } = await searchParams;
  const sb = await supabaseServer();
  const { data: video } = await sb.from("videos").select("*, scripts(*)").eq("id", id).maybeSingle<Video>();
  if (!video || !video.scripts) notFound();
  const s = video.scripts;
  const [job, regras] = await Promise.all([ultimoJob(video.id), configuracoes()]);
  const ativo = job && (job.status === "queued" || job.status === "running");
  const url = urlPublica(video.final_path);
  const ehTiktok = video.platform === "tiktok";
  const legendaAtual = video.caption ?? legendaPadrao(s, video.platform);
  const legendaTiktok = [legendaAtual, s.hashtags.join(" ")].join("\n\n");
  const horaPost = horaDoSlot(regras, video.slot);
  const quando = `${dataCurta(video.scheduled_for)}, ${horaPost}`;
  const { data: irmao } = await sb
    .from("videos")
    .select("id")
    .eq("script_id", video.script_id)
    .neq("id", video.id)
    .maybeSingle<{ id: string }>();
  const { data: tiktokLigado } = await sb.from("connections").select("status").eq("kind", "tiktok").maybeSingle<{ status: string }>();
  const tiktokOn = tiktokLigado?.status === "conectado";
  const ROT_TIKTOK = { enviado: "Rascunho na sua caixa de entrada", postado: "Publicado no TikTok", erro: "Falhou" } as const;

  return (
    <>
      <div className="head">
        <div>
          <Link href="/videos" className="lbl" style={{ textDecoration: "none" }}>← Vídeos</Link>
          <h1>{s.title}</h1>
          <span className="lbl">Versão {ROTULO_PLATAFORMA[video.platform]} · {quando}</span>
        </div>
        <div className="row wrap">
          {irmao && <Link className="btn btn-s btn-sm" href={`/videos/${irmao.id}`}>Ver versão {ehTiktok ? "Instagram" : "TikTok"}</Link>}
          <span className={`badge ${classeBadgeVideo(video.status)}`}>{ROTULO_VIDEO[video.status]}</span>
          <form action={gerarVideo}>
            <input type="hidden" name="video_id" value={video.id} />
            <button className="btn btn-s" disabled={!!ativo || video.status === "postado"}>{ativo ? "Na fila de render" : video.final_path ? "Gerar de novo" : "Gerar vídeo"}</button>
          </form>
          {!ehTiktok && (
            <form action={postarAgora}>
              <input type="hidden" name="video_id" value={video.id} />
              <button className="btn btn-p" disabled={!(video.status === "pronto" || (video.status === "erro" && !!video.final_path))}>Postar agora</button>
            </form>
          )}
        </div>
      </div>

      {ok && <div className="toast t-ok" role="status">{ok}</div>}
      {erro && <div className="toast t-warn" role="alert">{erro}</div>}

      <div className="grid-main" style={{ gridTemplateColumns: "240px minmax(0,1fr)" }}>
        <div className="stack" style={{ alignItems: "center" }}>
          <div className="phone">
            {url ? <video src={url} controls playsInline preload="metadata" /> : <div className="ph-empty">{s.hook}</div>}
          </div>
          {url && <a className="btn btn-s btn-sm" href={url} download>Baixar MP4</a>}
        </div>

        <div className="stack">
          {video.status !== "postado" && (
            <section className="card stack">
              <h3 style={{ fontSize: 19 }}>Vídeo renderizado</h3>
              <EnviarVideo videoId={video.id} temVideo={!!video.final_path} quando={quando} />
            </section>
          )}

          <section className="card stack">
            <h3 style={{ fontSize: 19 }}>Etapas</h3>
            <Pipeline video={video} job={job} quando={quando} />
            {video.error && <div className="toast t-warn" role="alert">{video.error}</div>}
          </section>

          <section className="card">
            <h3 style={{ fontSize: 19, marginBottom: 8 }}>Arquivo</h3>
            <div className="meta"><span>Formato</span><b>1080×1920, 30 quadros</b></div>
            <div className="meta"><span>Duração</span><b>{video.duration_s ? `${String(video.duration_s).replace(".", ",")} s` : "—"}</b></div>
            <div className="meta"><span>Volume</span><b>{video.loudness_lufs ? `${String(video.loudness_lufs).replace(".", ",")} LUFS` : "—"}</b></div>
            <div className="meta"><span>Voz</span><b>{regras.voice_name} · {String(regras.voice_speed).replace(".", ",")}×</b></div>
            <div className="meta"><span>Música</span><b>{regras.music_db} dB abaixo da voz</b></div>
          </section>

          <section className="card stack">
            <h3 style={{ fontSize: 19 }}>Legenda</h3>
            <form action={salvarLegenda} className="stack">
              <input type="hidden" name="video_id" value={video.id} />
              <textarea name="caption" className="inp" defaultValue={legendaAtual} aria-label="Legenda" />
              <p className="muted" style={{ fontSize: 13 }}>{s.hashtags.join(" ")}</p>
              <p className="muted" style={{ fontSize: 12 }}>{AVISO_OAB}</p>
              <div><button className="btn btn-s btn-sm">Salvar legenda</button></div>
            </form>
          </section>

          {ehTiktok && (
          <section className="card stack">
            <h3 style={{ fontSize: 19 }}>TikTok</h3>
            <div>
              <div className="meta"><span>Situação</span><b>{video.tiktok_status ? ROT_TIKTOK[video.tiktok_status] : tiktokOn ? "Ainda não enviado" : "TikTok não conectado"}</b></div>
              <div className="meta"><span>Enviado em</span><b>{video.tiktok_sent_at ? new Date(video.tiktok_sent_at).toLocaleString("pt-BR", { timeZone: "America/Maceio" }) : "—"}</b></div>
            </div>
            {video.tiktok_error && <div className="toast t-warn" role="alert">{video.tiktok_error}</div>}
            {video.tiktok_status === "enviado" && <p className="muted" style={{ fontSize: 13 }}>Abra o TikTok, toque na notificação do rascunho, cole a legenda e publique. O TikTok só deixa publicar por lá, nesta conta de teste.</p>}
            <textarea className="inp" readOnly value={legendaTiktok} aria-label="Legenda para o TikTok" />
            <div className="row wrap">
              <Copiar texto={legendaTiktok} />
              {tiktokOn && !!video.final_path && video.tiktok_status !== "enviado" && video.tiktok_status !== "postado" && (
                <form action={enviarTiktok}>
                  <input type="hidden" name="video_id" value={video.id} />
                  <button className="btn btn-p btn-sm">{video.tiktok_status === "erro" ? "Enviar de novo ao TikTok" : "Enviar ao TikTok agora"}</button>
                </form>
              )}
            </div>
          </section>
          )}

          <section className="card stack">
            <h3 style={{ fontSize: 19 }}>Publicação</h3>
            <div>
              {ehTiktok ? (
                <>
                  <div className="meta"><span>Conta</span><b>TikTok conectado em Conexões</b></div>
                  <div className="meta"><span>Tipo</span><b>Rascunho na caixa de entrada</b></div>
                  <div className="meta"><span>Funil</span><b>Link da bio · jusaz.com</b></div>
                </>
              ) : (
                <>
                  <div className="meta"><span>Conta</span><b>@jusaz_br</b></div>
                  <div className="meta"><span>Tipo</span><b>Reel</b></div>
                  <div className="meta"><span>ManyChat</span><b>Palavra {s.keyword}</b></div>
                </>
              )}
              <div className="meta"><span>Postado em</span><b>{video.posted_at ? new Date(video.posted_at).toLocaleString("pt-BR", { timeZone: "America/Maceio" }) : "—"}</b></div>
            </div>
            <form action={reagendar} className="row wrap" style={{ alignItems: "flex-end" }}>
              <input type="hidden" name="video_id" value={video.id} />
              <div className="fld">
                <label htmlFor="scheduled_for">Data</label>
                <input id="scheduled_for" name="scheduled_for" type="date" className="inp" defaultValue={video.scheduled_for ?? ""} />
              </div>
              <div className="fld">
                <label htmlFor="slot">Horário</label>
                <select id="slot" name="slot" className="inp" defaultValue={String(video.slot)}>
                  <option value="1">{horaDoSlot(regras, 1)} (1º do dia)</option>
                  <option value="2">{horaDoSlot(regras, 2)} (2º do dia)</option>
                </select>
              </div>
              <button className="btn btn-s">Mudar data e horário</button>
            </form>
            <p className="muted" style={{ fontSize: 12 }}>A mudança vale para as duas versões deste roteiro.</p>
          </section>
        </div>
      </div>
    </>
  );
}
