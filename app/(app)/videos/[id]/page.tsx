import Link from "next/link";
import { notFound } from "next/navigation";
import { Pipeline } from "@/components/Pipeline";
import { gerarVideo, postarAgora, reagendar, salvarLegenda } from "@/app/actions";
import { ROTULO_VIDEO, classeBadgeVideo, dataCurta } from "@/lib/format";
import { configuracoes, ultimoJob, urlPublica } from "@/lib/queries";
import { AVISO_OAB } from "@/lib/types";
import type { Video } from "@/lib/types";
import { supabaseServer } from "@/lib/supabase/server";

export default async function VideoPagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await supabaseServer();
  const { data: video } = await sb.from("videos").select("*, scripts(*)").eq("id", id).maybeSingle<Video>();
  if (!video || !video.scripts) notFound();
  const s = video.scripts;
  const [job, regras] = await Promise.all([ultimoJob(video.id), configuracoes()]);
  const ativo = job && (job.status === "queued" || job.status === "running");
  const url = urlPublica(video.final_path);

  return (
    <>
      <div className="head">
        <div>
          <Link href="/videos" className="lbl" style={{ textDecoration: "none" }}>← Vídeos</Link>
          <h1>{s.title}</h1>
        </div>
        <div className="row wrap">
          <span className={`badge ${classeBadgeVideo(video.status)}`}>{ROTULO_VIDEO[video.status]}</span>
          <form action={gerarVideo}>
            <input type="hidden" name="video_id" value={video.id} />
            <button className="btn btn-s" disabled={!!ativo || video.status === "postado"}>{ativo ? "Na fila de render" : video.final_path ? "Gerar de novo" : "Gerar vídeo"}</button>
          </form>
          <form action={postarAgora}>
            <input type="hidden" name="video_id" value={video.id} />
            <button className="btn btn-p" disabled={!(video.status === "pronto" || (video.status === "erro" && !!video.final_path))}>Postar agora</button>
          </form>
        </div>
      </div>

      <div className="grid-main" style={{ gridTemplateColumns: "240px minmax(0,1fr)" }}>
        <div className="stack" style={{ alignItems: "center" }}>
          <div className="phone">
            {url ? <video src={url} controls playsInline preload="metadata" /> : <div className="ph-empty">{s.hook}</div>}
          </div>
          {url && <a className="btn btn-s btn-sm" href={url} download>Baixar MP4</a>}
        </div>

        <div className="stack">
          <section className="card stack">
            <h3 style={{ fontSize: 19 }}>Etapas</h3>
            <Pipeline video={video} job={job} quando={`${dataCurta(video.scheduled_for)}, ${regras.post_hour.slice(0, 5)}`} />
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
              <textarea name="caption" className="inp" defaultValue={video.caption ?? s.caption} aria-label="Legenda" />
              <p className="muted" style={{ fontSize: 13 }}>{s.hashtags.join(" ")}</p>
              <p className="muted" style={{ fontSize: 12 }}>{AVISO_OAB}</p>
              <div><button className="btn btn-s btn-sm">Salvar legenda</button></div>
            </form>
          </section>

          <section className="card stack">
            <h3 style={{ fontSize: 19 }}>Publicação</h3>
            <div>
              <div className="meta"><span>Conta</span><b>@jusaz_br</b></div>
              <div className="meta"><span>Tipo</span><b>Reel</b></div>
              <div className="meta"><span>ManyChat</span><b>Palavra {s.keyword}</b></div>
              <div className="meta"><span>Postado em</span><b>{video.posted_at ? new Date(video.posted_at).toLocaleString("pt-BR", { timeZone: "America/Maceio" }) : "—"}</b></div>
            </div>
            <form action={reagendar} className="row wrap" style={{ alignItems: "flex-end" }}>
              <input type="hidden" name="video_id" value={video.id} />
              <div className="fld">
                <label htmlFor="scheduled_for">Data</label>
                <input id="scheduled_for" name="scheduled_for" type="date" className="inp" defaultValue={video.scheduled_for ?? ""} />
              </div>
              <button className="btn btn-s">Mudar data</button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
