import { decidirIdeia, gerarIdeias } from "@/app/actions";
import { haQuanto } from "@/lib/format";
import { supabaseServer } from "@/lib/supabase/server";
import type { Idea } from "@/lib/types";

export default async function Ideias({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const { erro, ok } = await searchParams;
  const sb = await supabaseServer();
  const { data } = await sb.from("ideas").select("*").order("created_at", { ascending: false }).returns<Idea[]>();
  const todas = data ?? [];
  const novas = todas.filter((i) => i.status === "nova");
  const resto = todas.filter((i) => i.status !== "nova");

  return (
    <>
      <div className="head">
        <div>
          <span className="lbl">{novas.length} para decidir</span>
          <h1>Ideias de vídeo</h1>
        </div>
        <form action={gerarIdeias}>
          <button className="btn btn-p">Gerar ideias</button>
        </form>
      </div>
      {ok && <div className="toast t-ok" role="status">{ok}</div>}
      {erro && <div className="toast t-warn" role="alert">{erro}</div>}

      <p className="muted">As ideias levam em conta os roteiros que você já tem e os posts que mais engajaram. Aprovar uma ideia cria um rascunho em Roteiros, que só entra na fila depois que você escrever a história e conferir os fatos.</p>

      {novas.length === 0 ? (
        <div className="card muted">Nenhuma ideia esperando. Clique em Gerar ideias.</div>
      ) : (
        <div className="grid2">
          {novas.map((i) => (
            <section key={i.id} className="card stack">
              <div className="row wrap" style={{ justifyContent: "space-between" }}>
                <h3 style={{ fontSize: 19 }}>{i.title}</h3>
                {i.keyword && <span className="chip">{i.keyword}</span>}
              </div>
              {i.hook && <p><b>Gancho:</b> {i.hook}</p>}
              {i.angle && <p className="muted">{i.angle}</p>}
              <div className="row wrap">
                <form action={decidirIdeia}>
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="decisao" value="roteiro" />
                  <button className="btn btn-p btn-sm">Virar roteiro</button>
                </form>
                <form action={decidirIdeia}>
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="decisao" value="descartar" />
                  <button className="btn btn-s btn-sm">Descartar</button>
                </form>
                <span className="muted" style={{ fontSize: 12 }}>{haQuanto(i.created_at)}</span>
              </div>
            </section>
          ))}
        </div>
      )}

      {resto.length > 0 && (
        <section className="card stack">
          <h3 style={{ fontSize: 19 }}>Já decididas</h3>
          <div>
            {resto.map((i) => (
              <div key={i.id} className="meta">
                <span>{i.title}</span>
                <b>{i.status === "aprovada" ? "Virou roteiro" : "Descartada"}</b>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
