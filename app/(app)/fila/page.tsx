import Link from "next/link";
import { alternarRegra, salvarRegras } from "@/app/actions";
import { listarVideos, configuracoes } from "@/lib/queries";
import { ROTULO_VIDEO, classeBadgeVideo, dataCurta, hojeMaceio } from "@/lib/format";

function Regra({ campo, valor, titulo, texto }: { campo: string; valor: boolean; titulo: string; texto: string }) {
  return (
    <form action={alternarRegra} className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", padding: "12px 0", borderTop: "1px solid var(--line)" }}>
      <input type="hidden" name="campo" value={campo} />
      <input type="hidden" name="valor" value={String(!valor)} />
      <div>
        <div style={{ fontWeight: 600 }}>{titulo}</div>
        <div className="muted" style={{ fontSize: 13 }}>{texto}</div>
      </div>
      <button className={`tg ${valor ? "on" : ""}`} role="switch" aria-checked={valor} aria-label={titulo} />
    </form>
  );
}

export default async function Fila() {
  const [videos, regras] = await Promise.all([listarVideos(), configuracoes()]);
  const hoje = hojeMaceio();

  return (
    <>
      <div className="head">
        <div>
          <span className="lbl">{videos.length} vídeos agendados</span>
          <h1>Fila</h1>
        </div>
      </div>

      <div className="cal">
        {videos.map((v) => (
          <Link key={v.id} href={`/videos/${v.id}`} className={`day ${v.scheduled_for === hoje ? "today" : ""}`}>
            <small>{dataCurta(v.scheduled_for)}</small>
            <strong>{v.scripts?.keyword}</strong>
            <span style={{ fontSize: 13 }}>{v.scripts?.title}</span>
            <span className="row wrap" style={{ gap: 6 }}>
              <span className={`badge ${classeBadgeVideo(v.status)}`}>{ROTULO_VIDEO[v.status]}</span>
              {v.scripts?.status === "conferir_fato" && <span className="badge b-warn">Conferir fato</span>}
            </span>
          </Link>
        ))}
      </div>

      <section className="card stack">
        <h2 style={{ fontSize: 24 }}>Regras da automação</h2>
        <form action={salvarRegras} className="row wrap" style={{ alignItems: "flex-end" }}>
          <div className="fld" style={{ width: 160 }}>
            <label htmlFor="post_hour">Hora da postagem</label>
            <input id="post_hour" name="post_hour" type="time" className="inp" defaultValue={regras.post_hour.slice(0, 5)} />
          </div>
          <div className="fld" style={{ width: 200 }}>
            <label htmlFor="lead_days">Gerar com antecedência (dias)</label>
            <input id="lead_days" name="lead_days" type="number" min={0} max={14} className="inp" defaultValue={regras.lead_days} />
          </div>
          <button className="btn btn-s">Salvar</button>
          <span className="muted" style={{ fontSize: 13, paddingBottom: 12 }}>Fuso: Maceió (UTC−3)</span>
        </form>
        <div>
          <Regra campo="post_without_review" valor={regras.post_without_review} titulo="Postar sem revisão" texto="O vídeo pronto sobe no horário, sem esperar o seu aval." />
          <Regra campo="hold_on_check" valor={regras.hold_on_check} titulo="Segurar se tiver “Conferir fato”" texto="Roteiro marcado para conferência não posta sozinho." />
          <Regra campo="auto_generate" valor={regras.auto_generate} titulo="Criar roteiros novos sozinho" texto="Quando a fila acabar, o estúdio escreve novos roteiros. Desligado por padrão." />
        </div>
      </section>
    </>
  );
}
