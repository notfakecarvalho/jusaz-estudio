import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { atualizarInstagram, tentarDeNovo } from "@/app/actions";
import { classeBadgeComentario, dataCurta, haQuanto, numero, ROTULO_COMENTARIO, ROTULO_MIDIA } from "@/lib/format";
import { comentariosRecentes, contaInstagram, postsInstagram } from "@/lib/queries";
import { supabaseServer } from "@/lib/supabase/server";
import type { Connection } from "@/lib/types";

export default async function Instagram({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const { erro, ok } = await searchParams;
  const sb = await supabaseServer();
  const [conta, posts, comentarios, { data: con }] = await Promise.all([
    contaInstagram(),
    postsInstagram(),
    comentariosRecentes(),
    sb.from("connections").select("*").eq("kind", "instagram").maybeSingle<Connection>(),
  ]);
  const conectado = con?.status === "conectado";
  const curtidas = posts.reduce((n, p) => n + p.likes, 0);
  const comentTotal = posts.reduce((n, p) => n + p.comments_count, 0);
  const porPost = new Map(posts.map((p) => [p.id, p]));

  return (
    <>
      <AutoRefresh segundos={45} />
      <div className="head">
        <div className="row" style={{ gap: 16 }}>
          {conta?.picture_url ? <img className="avatar" src={conta.picture_url} alt="" /> : <div className="avatar" />}
          <div>
            <span className="lbl">Atualizado {haQuanto(conta?.synced_at ?? null)}</span>
            <h1>{conta?.username ? `@${conta.username}` : "Instagram"}</h1>
          </div>
        </div>
        <div className="row wrap">
          <span className={`badge ${conectado ? "b-ok" : con?.status === "atencao" ? "b-warn" : "b-wait"}`}>
            {conectado ? "Conectado" : con?.status === "atencao" ? "Precisa de atenção" : "Não conectado"}
          </span>
          <form action={atualizarInstagram}>
            <button className="btn btn-s">Atualizar agora</button>
          </form>
        </div>
      </div>

      {ok && <div className="toast t-ok" role="status">{ok}</div>}
      {erro && <div className="toast t-warn" role="alert">{erro}</div>}
      {!conectado && (
        <div className="card stack">
          <h3 style={{ fontSize: 19 }}>Falta ligar a conta</h3>
          <p className="muted">{typeof con?.meta?.erro === "string" ? con.meta.erro : "Salve os segredos IG_ACCESS_TOKEN e IG_USER_ID no Supabase para o estúdio enxergar a conta."}</p>
          <div><Link className="btn btn-s btn-sm" href="/conexoes">Ver conexões</Link></div>
        </div>
      )}

      <div className="stats">
        <div className="stat"><span className="lbl">Seguidores</span><b>{numero(conta?.followers)}</b></div>
        <div className="stat"><span className="lbl">Publicações</span><b>{numero(conta?.media_count)}</b></div>
        <div className="stat"><span className="lbl">Curtidas nos últimos {posts.length}</span><b>{numero(curtidas)}</b></div>
        <div className="stat"><span className="lbl">Comentários nos últimos {posts.length}</span><b>{numero(comentTotal)}</b></div>
      </div>

      <div className="grid-main">
        <section className="stack">
          <h2 style={{ fontSize: 24 }}>Publicações</h2>
          {posts.length === 0 ? (
            <div className="card muted">Nada por aqui ainda. Clique em Atualizar agora depois de ligar a conta.</div>
          ) : (
            <div className="postgrid">
              {posts.map((p) => (
                <a key={p.id} className="post" href={p.permalink ?? "#"} target="_blank" rel="noreferrer">
                  {p.thumb_url ? <img className="thumb" src={p.thumb_url} alt="" loading="lazy" /> : <div className="thumb" />}
                  <div className="body">
                    <div className="row wrap" style={{ gap: 6 }}>
                      <span className="badge b-wait">{p.product_type === "REELS" ? "Reel" : ROTULO_MIDIA[p.media_type ?? ""] ?? "Post"}</span>
                      {p.video_id && <span className="badge b-run">Feito no estúdio</span>}
                    </div>
                    <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.caption ?? "Sem legenda"}</span>
                    <span className="muted">♥ {numero(p.likes)} · 💬 {numero(p.comments_count)} · {p.posted_at ? dataCurta(p.posted_at.slice(0, 10)) : ""}</span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        <aside className="card stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3 style={{ fontSize: 19 }}>Comentários</h3>
            <Link href="/funil" className="btn btn-s btn-sm">Funil</Link>
          </div>
          {comentarios.length === 0 ? (
            <p className="muted">Ainda não chegou nenhum comentário. Quando alguém comentar, aparece aqui em até 2 minutos.</p>
          ) : (
            <div>
              {comentarios.map((c) => (
                <div key={c.id} className="cm">
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <b>@{c.username ?? "alguém"}</b>
                    <span className={`badge ${classeBadgeComentario(c.status)}`}>{ROTULO_COMENTARIO[c.status]}</span>
                  </div>
                  <span>{c.text}</span>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {haQuanto(c.commented_at)} · {(porPost.get(c.post_id ?? "")?.caption ?? "").slice(0, 40) || "post"}
                  </span>
                  {c.status === "erro" && (
                    <>
                      <span className="muted" style={{ fontSize: 12, color: "var(--warn-ink)" }}>{c.error}</span>
                      <form action={tentarDeNovo}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="btn btn-s btn-sm">Tentar de novo</button>
                      </form>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
