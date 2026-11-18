import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { atualizarTiktokMenu, conectarTiktok } from "@/app/actions";
import { dataCurta, haQuanto, numero } from "@/lib/format";
import { primeiraLinha } from "@/lib/insights";
import { supabaseServer } from "@/lib/supabase/server";
import type { Connection, TiktokConta, TiktokVideo } from "@/lib/types";

type Titulo = { title: string } | { title: string }[] | null;
type Linha = TiktokVideo & { videos: { scripts: Titulo } | { scripts: Titulo }[] | null };
type Envio = { id: string; tiktok_status: "enviado" | "postado" | "erro" | null; tiktok_sent_at: string | null; tiktok_error: string | null; scheduled_for: string | null; status: string; final_path: string | null; scripts: Titulo };

const um = <T,>(x: T | T[] | null): T | null => (Array.isArray(x) ? (x[0] ?? null) : x);
const ROTULO = { enviado: "Na sua caixa de entrada", postado: "Publicado", erro: "Falhou" } as const;
const CLASSE = { enviado: "b-run", postado: "b-ok", erro: "b-warn" } as const;

export default async function Tiktok({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const { erro, ok } = await searchParams;
  const sb = await supabaseServer();
  const [{ data: conta }, { data: linhas }, { data: envios }, { data: con }] = await Promise.all([
    sb.from("tiktok_account").select("*").eq("principal", true).maybeSingle<TiktokConta>(),
    sb.from("tiktok_videos").select("*, videos(scripts(title))").order("posted_at", { ascending: false }).limit(30).returns<Linha[]>(),
    sb.from("videos")
      .select("id, tiktok_status, tiktok_sent_at, tiktok_error, scheduled_for, status, final_path, scripts(title)")
      .eq("platform", "tiktok")
      .or("tiktok_status.not.is.null,and(status.eq.pronto,final_path.not.is.null)")
      .order("scheduled_for", { ascending: true })
      .order("slot", { ascending: true })
      .limit(20)
      .returns<Envio[]>(),
    sb.from("connections").select("*").eq("kind", "tiktok").maybeSingle<Connection>(),
  ]);

  const conectado = con?.status === "conectado";
  const videos = linhas ?? [];
  const tituloDe = (v: Linha) => {
    const lig = um(v.videos);
    return um(lig?.scripts ?? null)?.title ?? primeiraLinha(v.title);
  };
  const views = videos.some((v) => v.views != null) ? videos.reduce((n, v) => n + (v.views ?? 0), 0) : null;
  const enviados = (envios ?? []).filter((e) => e.tiktok_status);
  const proximos = (envios ?? []).filter((e) => !e.tiktok_status);

  return (
    <>
      <AutoRefresh segundos={60} />
      <div className="head">
        <div className="row" style={{ gap: 16 }}>
          {conta?.avatar_url ? <img className="avatar" src={conta.avatar_url} alt="" /> : <div className="avatar" />}
          <div>
            <span className="lbl">Atualizado {haQuanto(conta?.synced_at ?? null)}</span>
            <h1>{conta?.display_name ? `@${conta.display_name}` : "TikTok"}</h1>
          </div>
        </div>
        <div className="row wrap">
          <span className={`badge ${conectado ? "b-ok" : con?.status === "atencao" ? "b-warn" : "b-wait"}`}>
            {conectado ? "Conectado" : con?.status === "atencao" ? "Precisa de atenção" : "Não conectado"}
          </span>
          {conectado && <Link className="btn btn-s" href="/insights?r=tiktok">Ver insights</Link>}
          {conectado && (
            <form action={atualizarTiktokMenu}>
              <button className="btn btn-s">Atualizar agora</button>
            </form>
          )}
        </div>
      </div>

      {ok && <div className="toast t-ok" role="status">{ok}</div>}
      {erro && <div className="toast t-warn" role="alert">{erro}</div>}

      {!conectado ? (
        <div className="card stack" style={{ borderColor: "var(--yellow)" }}>
          <h3 style={{ fontSize: 19 }}>Falta ligar a conta do TikTok</h3>
          <p className="muted">{typeof con?.meta?.erro === "string" ? con.meta.erro : "Conecte a conta para ver os vídeos, as métricas e receber o rascunho do dia na caixa de entrada."}</p>
          <div className="row wrap">
            <form action={conectarTiktok}><button className="btn btn-p btn-sm">Conectar TikTok</button></form>
            <Link className="btn btn-s btn-sm" href="/conexoes">Ver conexões</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="stats">
            <div className="stat"><span className="lbl">Seguidores</span><b>{numero(conta?.followers)}</b></div>
            <div className="stat"><span className="lbl">Vídeos publicados</span><b>{numero(conta?.video_count)}</b></div>
            <div className="stat"><span className="lbl">Curtidas na conta</span><b>{numero(conta?.likes)}</b></div>
            <div className="stat"><span className="lbl">Visualizações nos últimos {videos.length}</span><b>{numero(views)}</b></div>
          </div>

          <div className="grid-main">
            <section className="stack">
              <h2 style={{ fontSize: 24 }}>Publicações</h2>
              {videos.length === 0 ? (
                <div className="card muted">Nenhum vídeo no TikTok ainda. Publique o rascunho que chegar na sua caixa de entrada e clique em Atualizar agora.</div>
              ) : (
                <div className="postgrid">
                  {videos.map((v) => (
                    <a key={v.id} className="post" href={v.share_url ?? "#"} target="_blank" rel="noreferrer">
                      {v.cover_url ? <img className="thumb" src={v.cover_url} alt="" loading="lazy" /> : <div className="thumb" />}
                      <div className="body">
                        <div className="row wrap" style={{ gap: 6 }}>
                          <span className="badge b-wait">Vídeo</span>
                          {v.video_id && <span className="badge b-run">Feito no estúdio</span>}
                        </div>
                        <b style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{tituloDe(v)}</b>
                        <span className="muted">▶ {numero(v.views)} · ♥ {numero(v.likes)} · 💬 {numero(v.comments)} · ↗ {numero(v.shares)}</span>
                        <span className="muted">{v.posted_at ? dataCurta(v.posted_at.slice(0, 10)) : ""}</span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </section>

            <aside className="card stack">
              <h3 style={{ fontSize: 19 }}>Rascunhos do estúdio</h3>
              <p className="muted" style={{ fontSize: 13 }}>O vídeo pronto vai para a sua caixa de entrada no horário da postagem. Abra o TikTok, cole a legenda e publique.</p>
              {enviados.length === 0 && proximos.length === 0 && <p className="muted">Nenhum vídeo pronto para enviar. Quando um vídeo ficar pronto, ele entra aqui.</p>}
              <div>
                {enviados.map((e) => {
                  const st = e.tiktok_status!;
                  return (
                    <div key={e.id} className="cm">
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <Link href={`/videos/${e.id}`}><b>{um(e.scripts)?.title ?? "Vídeo"}</b></Link>
                        <span className={`badge ${CLASSE[st]}`}>{ROTULO[st]}</span>
                      </div>
                      <span className="muted" style={{ fontSize: 12 }}>
                        {e.tiktok_sent_at ? `Enviado ${haQuanto(e.tiktok_sent_at)}` : ""}
                      </span>
                      {st === "erro" && e.tiktok_error && <span className="muted" style={{ fontSize: 12, color: "var(--warn-ink)" }}>{e.tiktok_error}</span>}
                    </div>
                  );
                })}
                {proximos.map((e) => (
                  <div key={e.id} className="cm">
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <Link href={`/videos/${e.id}`}><b>{um(e.scripts)?.title ?? "Vídeo"}</b></Link>
                      <span className="badge b-wait">Vai {e.scheduled_for ? dataCurta(e.scheduled_for) : "em breve"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </>
      )}
    </>
  );
}
