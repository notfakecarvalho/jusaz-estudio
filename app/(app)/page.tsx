import Link from "next/link";
import { Pipeline } from "@/components/Pipeline";
import { gerarVideo, postarAgora, marcarConferido, salvarLegenda } from "@/app/actions";
import { dataCurta, hojeMaceio, horaDoSlot, ROTULO_VIDEO, classeBadgeVideo, palavras, segundosEstimados } from "@/lib/format";
import { listarVideos, ultimoJob, urlPublica, configuracoes } from "@/lib/queries";
import { AVISO_OAB, textoFalado } from "@/lib/types";
import { supabaseServer } from "@/lib/supabase/server";
import type { Connection } from "@/lib/types";

export default async function Hoje() {
  const hoje = hojeMaceio();
  const [videos, regras] = await Promise.all([listarVideos(hoje), configuracoes()]);
  // A tela principal é a versão do Instagram; a do TikTok aparece ao lado, ligada ao mesmo roteiro.
  const igs = videos.filter((v) => v.platform === "instagram");
  const video =
    igs.find((v) => v.scheduled_for === hoje && v.status !== "postado") ??
    igs.find((v) => v.scheduled_for === hoje) ??
    igs.find((v) => v.status !== "postado") ??
    igs[0];
  const versaoTiktok = video ? videos.find((v) => v.script_id === video.script_id && v.platform === "tiktok") : undefined;
  const proximos = igs.filter((v) => v.id !== video?.id).slice(0, 6);

  if (!video || !video.scripts) {
    return (
      <>
        <div className="head"><h1>Vídeo de hoje</h1></div>
        <div className="card">Nenhum vídeo na fila. Crie um roteiro em Roteiros e ele aparece aqui.</div>
      </>
    );
  }

  const s = video.scripts;
  const sb = await supabaseServer();
  const [job, { data: ig }] = await Promise.all([
    ultimoJob(video.id),
    sb.from("connections").select("*").eq("kind", "instagram").maybeSingle<Connection>(),
  ]);
  const igOk = ig?.status === "conectado";
  const falado = textoFalado(s, "instagram");
  const horaPost = horaDoSlot(regras, video.slot);
  const legenda = video.caption ?? s.caption;
  const ativo = job && (job.status === "queued" || job.status === "running");

  const checklist = [
    { ok: s.status !== "conferir_fato", texto: s.status === "conferir_fato" ? `Conferir fato: ${s.fact_note ?? "revisar o roteiro"}` : "Fatos do roteiro conferidos" },
    { ok: true, texto: "Histórias ilustrativas, sem promessa de resultado" },
    { ok: !!video.final_path, texto: video.final_path ? "Vídeo final gerado" : "Vídeo ainda não foi gerado" },
    { ok: igOk, texto: igOk ? "Instagram conectado (@jusaz_br)" : "Instagram ainda não conectado" },
  ];
  const pronto = video.status === "pronto" || (video.status === "erro" && !!video.final_path);

  return (
    <>
      <div className="head">
        <div>
          <span className="lbl">{dataCurta(video.scheduled_for)} · posta às {horaPost}</span>
          <h1>Vídeo de hoje</h1>
        </div>
        <div className="row wrap">
          <form action={gerarVideo}>
            <input type="hidden" name="video_id" value={video.id} />
            <button className="btn btn-s" disabled={!!ativo || video.status === "postado"}>{ativo ? "Na fila de render" : "Gerar vídeo"}</button>
          </form>
          <form action={postarAgora}>
            <input type="hidden" name="video_id" value={video.id} />
            <button className="btn btn-p" disabled={!pronto || !igOk}>Postar agora</button>
          </form>
        </div>
      </div>

      <div className="grid-main">
        <div className="stack">
          <section className="card stack">
            <div className="row wrap" style={{ justifyContent: "space-between" }}>
              <div className="row wrap">
                <h2 style={{ fontSize: 24 }}>{s.title}</h2>
                <span className="chip">Comenta {s.keyword}</span>
              </div>
              <span className={`badge ${classeBadgeVideo(video.status)}`}>{ROTULO_VIDEO[video.status]}</span>
            </div>
            <p className="muted">{palavras(falado)} palavras · cerca de {Math.round(segundosEstimados(falado))} segundos falados</p>
            <Pipeline video={video} job={job} quando={`${dataCurta(video.scheduled_for)}, ${horaPost}`} />
            {video.error && <div className="toast t-warn" role="alert">{video.error}</div>}
          </section>

          <section className="card stack">
            <h3 style={{ fontSize: 19 }}>Legenda</h3>
            <form action={salvarLegenda} className="stack">
              <input type="hidden" name="video_id" value={video.id} />
              <textarea name="caption" className="inp" defaultValue={legenda} aria-label="Legenda" />
              <p className="muted" style={{ fontSize: 13 }}>{s.hashtags.join(" ")}</p>
              <p className="muted" style={{ fontSize: 12 }}>{AVISO_OAB}</p>
              <div><button className="btn btn-s btn-sm">Salvar legenda</button></div>
            </form>
          </section>
        </div>

        <aside className="stack">
          <section className="card stack">
            <h3 style={{ fontSize: 19 }}>Antes de postar</h3>
            <div>
              {checklist.map((c) => (
                <div key={c.texto} className="check">
                  <span className={`tick ${c.ok ? "y" : "n"}`} aria-hidden="true">{c.ok ? "✓" : "!"}</span>
                  <span>{c.texto}</span>
                </div>
              ))}
            </div>
            {s.status === "conferir_fato" && (
              <form action={marcarConferido}>
                <input type="hidden" name="id" value={s.id} />
                <button className="btn btn-s btn-sm">Já conferi o fato</button>
              </form>
            )}
            {s.status === "conferir_fato" && regras.hold_on_check && (
              <p className="muted" style={{ fontSize: 12 }}>Com a regra “segurar se tiver Conferir fato” ligada, este vídeo não posta sozinho.</p>
            )}
          </section>

          {versaoTiktok && (
            <section className="card stack">
              <h3 style={{ fontSize: 19 }}>Versão do TikTok</h3>
              <div>
                <div className="meta"><span>Vídeo</span><b><span className={`badge ${classeBadgeVideo(versaoTiktok.status)}`}>{ROTULO_VIDEO[versaoTiktok.status]}</span></b></div>
                <div className="meta"><span>Rascunho no TikTok</span><b>{versaoTiktok.tiktok_status === "postado" ? "Publicado" : versaoTiktok.tiktok_status === "enviado" ? "Na sua caixa de entrada" : versaoTiktok.tiktok_status === "erro" ? "Falhou" : "Ainda não enviado"}</b></div>
              </div>
              <p className="muted" style={{ fontSize: 13 }}>Mesma história, mas a última frase chama a pessoa no direct em vez de pedir comentário.</p>
              <div><Link className="btn btn-s btn-sm" href={`/videos/${versaoTiktok.id}`}>Abrir versão TikTok</Link></div>
            </section>
          )}

          <section className="card stack">
            <h3 style={{ fontSize: 19 }}>Prévia</h3>
            <div className="phone" style={{ alignSelf: "center" }}>
              {video.final_path ? (
                <video src={urlPublica(video.final_path) ?? undefined} controls playsInline preload="metadata" />
              ) : (
                <div className="ph-empty">{s.hook}</div>
              )}
            </div>
          </section>
        </aside>
      </div>

      {proximos.length > 0 && (
        <section className="stack">
          <h2 style={{ fontSize: 24 }}>Próximos dias</h2>
          <div className="cal" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
            {proximos.map((v) => (
              <Link key={v.id} href={`/videos/${v.id}`} className="day">
                <small>{dataCurta(v.scheduled_for)} · {horaDoSlot(regras, v.slot)}</small>
                <strong>{v.scripts?.keyword}</strong>
                <span className={`badge ${classeBadgeVideo(v.status)}`} style={{ alignSelf: "flex-start" }}>{ROTULO_VIDEO[v.status]}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
