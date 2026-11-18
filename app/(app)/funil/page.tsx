import { alternarFluxo, excluirFluxo, salvarFluxo } from "@/app/actions";
import { postsInstagram } from "@/lib/queries";
import { supabaseServer } from "@/lib/supabase/server";
import type { IgComment, IgFlow } from "@/lib/types";
import { haQuanto } from "@/lib/format";

type Sim = { casou: boolean; regra?: string; ativa?: boolean; resposta_publica?: string; mensagem_privada?: string; erro?: string };

function CamposRegra({ f, posts }: { f?: IgFlow; posts: { id: string; caption: string | null }[] }) {
  return (
    <>
      <div className="grid2" style={{ gap: 16 }}>
        <div className="fld">
          <label>Nome da regra</label>
          <input name="name" className="inp" defaultValue={f?.name ?? ""} placeholder="Ex.: Vídeo do INSS" />
        </div>
        <div className="fld">
          <label>Palavra no comentário</label>
          <input name="keyword" className="inp" defaultValue={f?.keyword ?? ""} placeholder="INSS" />
          <small>Não importa maiúscula nem acento.</small>
        </div>
      </div>
      <div className="fld">
        <label>Vale para</label>
        <select name="post_id" className="inp" defaultValue={f?.post_id ?? ""}>
          <option value="">Todas as publicações</option>
          {posts.map((p) => (
            <option key={p.id} value={p.id}>{(p.caption ?? "Sem legenda").replace(/\s+/g, " ").slice(0, 60)}</option>
          ))}
        </select>
      </div>
      <div className="fld">
        <label>Resposta pública no comentário</label>
        <input name="reply_public" className="inp" defaultValue={f?.reply_public ?? "Te mandei os detalhes no direct! 💬"} />
      </div>
      <div className="fld">
        <label>Mensagem privada (direct)</label>
        <textarea name="dm_text" className="inp" defaultValue={f?.dm_text ?? ""} placeholder="Oi {nome}! Aqui está o caminho para ver seus direitos com advogados verificados pela OAB." />
        <small>{"Use {nome} para o @ da pessoa e {link} para o link. Se não usar {link}, ele vai no fim."}</small>
      </div>
      <div className="fld">
        <label>Link</label>
        <input name="link_url" className="inp" defaultValue={f?.link_url ?? ""} placeholder="https://..." />
      </div>
    </>
  );
}

export default async function Funil({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string; t?: string; p?: string }> }) {
  const { erro, ok, t, p } = await searchParams;
  const sb = await supabaseServer();
  const [{ data: fluxos }, posts, { data: recentes }] = await Promise.all([
    sb.from("ig_flows").select("*").order("created_at").returns<IgFlow[]>(),
    postsInstagram(),
    sb.from("ig_comments").select("*").not("flow_id", "is", null).order("commented_at", { ascending: false }).limit(12).returns<IgComment[]>(),
  ]);
  let sim: Sim | null = null;
  if (t) {
    const { data, error } = await sb.functions.invoke("instagram", { body: { acao: "simular", texto: t, post_id: p || null } });
    sim = error ? { casou: false, erro: error.message } : data;
  }
  const lista = fluxos ?? [];
  const nomes = new Map(lista.map((f) => [f.id, f.name]));

  return (
    <>
      <div className="head">
        <div>
          <span className="lbl">{lista.filter((f) => f.active).length} de {lista.length} regras ligadas</span>
          <h1>Funil de comentários</h1>
        </div>
      </div>
      {ok && <div className="toast t-ok" role="status">{ok}</div>}
      {erro && <div className="toast t-warn" role="alert">{erro}</div>}

      <section className="card stack">
        <h3 style={{ fontSize: 19 }}>Como funciona</h3>
        <div className="steps">
          {[
            ["1", "Comentário", "A pessoa comenta a palavra no seu post."],
            ["2", "Resposta pública", "O estúdio responde no próprio comentário."],
            ["3", "Mensagem privada", "Chega no direct dela com o link."],
          ].map(([n, a, b], i) => (
            <div key={n} className={`st ${i < 2 ? "done" : ""}`}>
              <div className="dot">{n}</div>
              <b>{a}</b>
              <span>{b}</span>
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 13 }}>
          O Instagram permite uma única mensagem privada por comentário, até 7 dias depois dele. Regra nova só vale para comentários feitos depois que você liga.
        </p>
      </section>

      <div className="grid-main" style={{ gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)" }}>
        <section className="stack">
          {lista.map((f) => (
            <details key={f.id} className="card" open={false}>
              <summary style={{ cursor: "pointer", listStyle: "none" }}>
                <div className="row wrap" style={{ justifyContent: "space-between" }}>
                  <div className="row wrap">
                    <h3 style={{ fontSize: 18 }}>{f.name}</h3>
                    <span className="chip">{f.keyword}</span>
                  </div>
                  <div className="row">
                    <span className="muted" style={{ fontSize: 13 }}>{f.hits} respostas</span>
                    <span className={`badge ${f.active ? "b-ok" : "b-wait"}`}>{f.active ? "Ligada" : "Desligada"}</span>
                  </div>
                </div>
              </summary>
              <div className="stack" style={{ marginTop: 16 }}>
                <form action={salvarFluxo} className="stack">
                  <input type="hidden" name="id" value={f.id} />
                  <CamposRegra f={f} posts={posts} />
                  <div className="row wrap">
                    <button className="btn btn-p btn-sm">Salvar</button>
                  </div>
                </form>
                <div className="row wrap">
                  <form action={alternarFluxo}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="ligar" value={String(!f.active)} />
                    <button className="btn btn-s btn-sm">{f.active ? "Desligar" : "Ligar regra"}</button>
                  </form>
                  <form action={excluirFluxo}>
                    <input type="hidden" name="id" value={f.id} />
                    <button className="btn btn-s btn-sm">Apagar</button>
                  </form>
                </div>
              </div>
            </details>
          ))}

          <details className="card" open={lista.length === 0}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>+ Nova regra</summary>
            <form action={salvarFluxo} className="stack" style={{ marginTop: 16 }}>
              <CamposRegra posts={posts} />
              <div><button className="btn btn-p btn-sm">Criar regra</button></div>
            </form>
          </details>
        </section>

        <aside className="stack">
          <section className="card stack">
            <h3 style={{ fontSize: 19 }}>Testar sem enviar nada</h3>
            <form className="stack" method="get">
              <div className="fld">
                <label htmlFor="t">Comentário de exemplo</label>
                <input id="t" name="t" className="inp" defaultValue={t ?? ""} placeholder="Quero saber do INSS" />
              </div>
              <div className="fld">
                <label htmlFor="p">Em qual publicação</label>
                <select id="p" name="p" className="inp" defaultValue={p ?? ""}>
                  <option value="">Qualquer uma</option>
                  {posts.map((x) => (
                    <option key={x.id} value={x.id}>{(x.caption ?? "Sem legenda").replace(/\s+/g, " ").slice(0, 50)}</option>
                  ))}
                </select>
              </div>
              <div><button className="btn btn-s btn-sm">Ver o que aconteceria</button></div>
            </form>
            {sim && (
              <div className="fecho stack" style={{ gap: 8 }}>
                {sim.erro ? (
                  <span>{sim.erro}</span>
                ) : sim.casou ? (
                  <>
                    <b>Regra: {sim.regra}{sim.ativa ? "" : " (está desligada)"}</b>
                    <span><span className="lbl">Resposta pública</span><br />{sim.resposta_publica}</span>
                    <span style={{ whiteSpace: "pre-wrap" }}><span className="lbl">Mensagem privada</span><br />{sim.mensagem_privada}</span>
                  </>
                ) : (
                  <span>Nenhuma regra casa com esse comentário.</span>
                )}
              </div>
            )}
          </section>

          <section className="card stack">
            <h3 style={{ fontSize: 19 }}>Últimas respostas do funil</h3>
            {(recentes ?? []).length === 0 ? (
              <p className="muted">Nada ainda. Quando uma regra ligada pegar um comentário, ele aparece aqui.</p>
            ) : (
              <div>
                {(recentes ?? []).map((c) => (
                  <div key={c.id} className="cm">
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <b>@{c.username}</b>
                      <span className={`badge ${c.status === "respondido" ? "b-ok" : c.status === "erro" ? "b-warn" : "b-run"}`}>{c.status === "respondido" ? "Enviado" : c.status === "erro" ? "Erro" : "Enviando"}</span>
                    </div>
                    <span>{c.text}</span>
                    <span className="muted" style={{ fontSize: 12 }}>{nomes.get(c.flow_id ?? "")} · {haQuanto(c.commented_at)}</span>
                    {c.error && <span style={{ fontSize: 12, color: "var(--warn-ink)" }}>{c.error}</span>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
