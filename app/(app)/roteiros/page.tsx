import Link from "next/link";
import { salvarRoteiro, marcarConferido } from "@/app/actions";
import { listarRoteiros } from "@/lib/queries";
import { ROTULO_ROTEIRO, palavras, segundosEstimados } from "@/lib/format";
import { FECHO_ANTES, FECHO_DEPOIS, textoFalado } from "@/lib/types";

const cls = { pronto: "b-ok", rascunho: "b-wait", conferir_fato: "b-warn" } as const;

export default async function Roteiros({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const lista = await listarRoteiros();
  const atual = lista.find((r) => r.slug === s) ?? lista[0];

  return (
    <>
      <div className="head">
        <div>
          <span className="lbl">{lista.length} roteiros</span>
          <h1>Roteiros</h1>
        </div>
      </div>

      <div className="grid-main" style={{ gridTemplateColumns: "minmax(0,320px) minmax(0,1fr)" }}>
        <nav className="stack" style={{ gap: 10 }} aria-label="Lista de roteiros">
          {lista.map((r) => (
            <Link key={r.id} href={`/roteiros?s=${r.slug}`} className={`listitem ${r.id === atual?.id ? "on" : ""}`}>
              <span className="row" style={{ justifyContent: "space-between" }}>
                <strong>{r.title}</strong>
                <span className={`badge ${cls[r.status]}`}>{ROTULO_ROTEIRO[r.status]}</span>
              </span>
              <span className="muted" style={{ fontSize: 12 }}>Comenta {r.keyword}</span>
            </Link>
          ))}
        </nav>

        {atual && (
          <section className="card stack" key={atual.id}>
            <div className="row wrap" style={{ justifyContent: "space-between" }}>
              <div className="row wrap">
                <h2 style={{ fontSize: 24 }}>{atual.title}</h2>
                <span className="chip">Comenta {atual.keyword}</span>
              </div>
              <span className="muted">
                {palavras(textoFalado(atual))} palavras · cerca de {Math.round(segundosEstimados(textoFalado(atual)))} s
              </span>
            </div>

            <form action={salvarRoteiro} className="stack">
              <input type="hidden" name="id" value={atual.id} />
              <div className="fld">
                <label htmlFor="hook">Gancho (primeiros 2 segundos)</label>
                <textarea id="hook" name="hook" className="inp" style={{ minHeight: 64 }} defaultValue={atual.hook} />
              </div>
              <div className="fld">
                <label htmlFor="hook_alt">Gancho alternativo para testar</label>
                <textarea id="hook_alt" name="hook_alt" className="inp" style={{ minHeight: 64 }} defaultValue={atual.hook_alt} />
              </div>
              <div className="fld">
                <label htmlFor="story">História</label>
                <textarea id="story" name="story" className="inp" style={{ minHeight: 220 }} defaultValue={atual.story} />
              </div>
              <div className="fld">
                <label htmlFor="closing_lead">Ligação do caso com o JusAz</label>
                <input id="closing_lead" name="closing_lead" className="inp" defaultValue={atual.closing_lead} />
                <small>Frase curta que liga a história ao fecho. Muda em cada vídeo.</small>
              </div>
              <div className="fld">
                <label>Fecho padrão do JusAz</label>
                <div className="fecho">
                  <mark>{atual.closing_lead}</mark> {FECHO_ANTES}
                  <mark>{atual.keyword}</mark>
                  {FECHO_DEPOIS}
                </div>
                <small>O fecho é igual em todos os vídeos. Só a ligação e a palavra mudam.</small>
              </div>
              <div className="fld">
                <label htmlFor="caption">Legenda</label>
                <textarea id="caption" name="caption" className="inp" style={{ minHeight: 72 }} defaultValue={atual.caption} />
              </div>
              <div className="fld">
                <label htmlFor="hashtags">Hashtags (5)</label>
                <input id="hashtags" name="hashtags" className="inp" defaultValue={atual.hashtags.join(" ")} />
              </div>
              <div className="grid2">
                <div className="fld">
                  <label htmlFor="status">Situação</label>
                  <select id="status" name="status" className="inp" defaultValue={atual.status}>
                    <option value="rascunho">Rascunho</option>
                    <option value="pronto">Pronto</option>
                    <option value="conferir_fato">Conferir fato</option>
                  </select>
                </div>
                <div className="fld">
                  <label htmlFor="fact_note">O que conferir</label>
                  <input id="fact_note" name="fact_note" className="inp" defaultValue={atual.fact_note ?? ""} />
                </div>
              </div>
              <div className="row wrap">
                <button className="btn btn-p">Salvar roteiro</button>
              </div>
            </form>

            {atual.status === "conferir_fato" && (
              <form action={marcarConferido}>
                <input type="hidden" name="id" value={atual.id} />
                <button className="btn btn-s">Marcar fato como conferido</button>
              </form>
            )}
          </section>
        )}
      </div>
    </>
  );
}
