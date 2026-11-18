import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ColunasTempo, LinhaSimples, RankingBarras, type Item } from "@/components/charts";
import { FonteInsights } from "@/components/FonteInsights";
import { atualizarTiktok } from "@/app/actions";
import { haQuanto, numero } from "@/lib/format";
import { diaMes, METRICAS_TK, primeiraLinha, valorTk, type MetricaTk } from "@/lib/insights";
import { supabaseServer } from "@/lib/supabase/server";
import type { TiktokConta, TiktokDia, TiktokVideo } from "@/lib/types";

type Linha = TiktokVideo & { videos: { scripts: { title: string } | { title: string }[] | null } | { scripts: { title: string } | { title: string }[] | null }[] | null };

const soma = (xs: (number | null)[]) => xs.reduce<number>((n, x) => n + (x ?? 0), 0);
const temAlgum = (xs: (number | null)[]) => xs.some((x) => x != null);

export async function InsightsTiktok({ m, erro, ok }: { m?: string; erro?: string; ok?: string }) {
  const sb = await supabaseServer();
  const [{ data: conta }, { data: linhas }, { data: dias }, { data: cx }] = await Promise.all([
    sb.from("tiktok_account").select("*").eq("principal", true).maybeSingle<TiktokConta>(),
    sb.from("tiktok_videos").select("*, videos(scripts(title))").order("posted_at", { ascending: false }).limit(40).returns<Linha[]>(),
    sb.from("tiktok_account_daily").select("day, followers, likes, video_count").order("day", { ascending: false }).limit(60).returns<TiktokDia[]>(),
    sb.from("connections").select("status, meta").eq("kind", "tiktok").maybeSingle<{ status: string; meta: { erro?: string } | null }>(),
  ]);

  const videos = (linhas ?? []) as Linha[];
  const conectado = cx?.status === "conectado";
  const tituloDe = (v: Linha) => {
    const lig = Array.isArray(v.videos) ? v.videos[0] : v.videos;
    const sc = lig ? (Array.isArray(lig.scripts) ? lig.scripts[0] : lig.scripts) : null;
    return sc?.title ?? primeiraLinha(v.title);
  };

  const validas = METRICAS_TK.map((x) => x.id);
  const metrica: MetricaTk = validas.includes(m as MetricaTk) ? (m as MetricaTk) : "views";
  const info = METRICAS_TK.find((x) => x.id === metrica)!;
  const link = (id: string) => `/insights?${new URLSearchParams({ r: "tiktok", m: id })}`;

  const ordenados = [...videos].sort((a, b) => (valorTk(b, metrica) ?? -1) - (valorTk(a, metrica) ?? -1));
  const rank = ordenados.filter((v) => valorTk(v, metrica) != null).slice(0, 10);
  const melhor = rank[0] && (valorTk(rank[0], metrica) ?? 0) > 0 ? rank[0] : null;
  const cronologico = [...videos].filter((v) => v.posted_at).sort((a, b) => (a.posted_at! < b.posted_at! ? -1 : 1)).slice(-20);
  const semDado = videos.length > 0 && !temAlgum(videos.map((v) => valorTk(v, metrica)));

  const serie = [...(dias ?? [])].reverse().filter((d) => d.followers != null).map((d) => ({ dia: d.day, valor: d.followers as number }));
  const seguidores = conta?.followers ?? null;
  const base30 = serie.find((d) => Date.now() - new Date(d.dia + "T12:00:00").getTime() <= 30 * 86400e3);
  const deltaSeg = serie.length >= 2 && base30 && seguidores != null ? seguidores - base30.valor : null;
  const views = temAlgum(videos.map((v) => v.views)) ? soma(videos.map((v) => v.views)) : null;
  const interTotal = soma(videos.map((v) => valorTk(v, "engaj")));
  const interMedia = videos.length ? Math.round((interTotal / videos.length) * 10) / 10 : null;
  const taxa = views ? (interTotal / views) * 100 : null;
  const fmt1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

  const itens: Item[] = rank.map((v) => ({
    id: v.id,
    rotulo: tituloDe(v),
    sub: `Vídeo · ${diaMes(v.posted_at)}`,
    valor: valorTk(v, metrica),
    dica: `${tituloDe(v)} (${diaMes(v.posted_at)}): ${numero(valorTk(v, metrica))} ${info.rotulo.toLowerCase()}`,
    href: v.share_url,
  }));

  return (
    <>
      <AutoRefresh segundos={120} />
      <div className="head">
        <div>
          <span className="lbl">Métricas lidas {haQuanto(conta?.synced_at ?? null)}</span>
          <h1>Insights</h1>
        </div>
        <div className="row wrap">
          <FonteInsights atual="tiktok" />
          {conectado && <form action={atualizarTiktok}><button className="btn btn-s">Atualizar agora</button></form>}
        </div>
      </div>

      {ok && <div className="toast t-ok" role="status">{ok}</div>}
      {erro && <div className="toast t-warn" role="alert">{erro}</div>}

      {!conectado ? (
        <div className="card stack" style={{ borderColor: "var(--yellow)" }}>
          <h3 style={{ fontSize: 19 }}>O TikTok ainda não está conectado</h3>
          <p className="muted">{cx?.meta?.erro ?? "Conecte a conta em Conexões para ver visualizações, curtidas e o desempenho de cada vídeo aqui."}</p>
          <div><Link className="btn btn-p btn-sm" href="/conexoes">Ir para Conexões</Link></div>
        </div>
      ) : (
        <>
          <div className="row wrap" style={{ gap: 20 }}>
            <div className="seg" role="group" aria-label="Métrica">
              {METRICAS_TK.map((x) => (
                <Link key={x.id} href={link(x.id)} title={x.dica} className={metrica === x.id ? "on" : ""} aria-current={metrica === x.id ? "true" : undefined}>{x.rotulo}</Link>
              ))}
            </div>
          </div>

          <div className="stats">
            <div className="stat">
              <span className="lbl">Seguidores</span>
              <b>{numero(seguidores)}</b>
              <span className="muted" style={{ fontSize: 12 }}>{deltaSeg == null ? "Variação aparece a partir do 2º dia" : `${deltaSeg >= 0 ? "+" : ""}${numero(deltaSeg)} em 30 dias`}</span>
            </div>
            <div className="stat">
              <span className="lbl">Visualizações</span>
              <b>{numero(views)}</b>
              <span className="muted" style={{ fontSize: 12 }}>{views == null ? "O TikTok ainda não mandou" : `em ${videos.length} vídeos`}</span>
            </div>
            <div className="stat">
              <span className="lbl">Curtidas na conta</span>
              <b>{numero(conta?.likes ?? null)}</b>
              <span className="muted" style={{ fontSize: 12 }}>{conta?.video_count != null ? `${numero(conta.video_count)} vídeos publicados` : "total de todos os vídeos"}</span>
            </div>
            <div className="stat">
              <span className="lbl">Interações por vídeo</span>
              <b>{interMedia == null ? "—" : fmt1.format(interMedia)}</b>
              <span className="muted" style={{ fontSize: 12 }}>{taxa == null ? "curtidas, comentários e envios" : `${fmt1.format(taxa)}% das visualizações`}</span>
            </div>
          </div>

          {videos.length === 0 ? (
            <div className="card muted">Nenhum vídeo no TikTok ainda. Quando você publicar o primeiro rascunho, as métricas aparecem aqui.</div>
          ) : (
            <>
              {melhor && (
                <section className="card best">
                  {melhor.cover_url ? <img className="best-thumb" src={melhor.cover_url} alt="" /> : <div className="best-thumb" />}
                  <div className="stack" style={{ gap: 6 }}>
                    <span className="lbl">Melhor em {info.rotulo.toLowerCase()}</span>
                    <h2 style={{ fontSize: 24 }}>{tituloDe(melhor)}</h2>
                    <span className="muted">Vídeo · {diaMes(melhor.posted_at)}</span>
                    <div className="row wrap" style={{ gap: 20 }}>
                      <span><b>{numero(valorTk(melhor, metrica))}</b> <span className="muted">{info.rotulo.toLowerCase()}</span></span>
                      <span className="muted">♥ {numero(melhor.likes)} · 💬 {numero(melhor.comments)} · enviados {numero(melhor.shares)}</span>
                    </div>
                    {melhor.share_url && <div><a className="btn btn-s btn-sm" href={melhor.share_url} target="_blank" rel="noreferrer">Abrir no TikTok</a></div>}
                  </div>
                </section>
              )}

              <div className="grid2">
                <section className="card stack">
                  <div>
                    <h3 style={{ fontSize: 19 }}>Ranking por {info.rotulo.toLowerCase()}</h3>
                    <span className="muted" style={{ fontSize: 13 }}>Os 10 melhores. O primeiro fica em azul.</span>
                  </div>
                  {semDado ? <p className="muted">O TikTok ainda não mandou {info.rotulo.toLowerCase()}.</p> : <RankingBarras itens={itens} />}
                </section>

                <section className="card stack">
                  <div>
                    <h3 style={{ fontSize: 19 }}>{info.rotulo} por vídeo</h3>
                    <span className="muted" style={{ fontSize: 13 }}>Do mais antigo para o mais novo (até 20). O maior está em azul.</span>
                  </div>
                  {semDado ? (
                    <p className="muted">Sem dados dessa métrica ainda.</p>
                  ) : (
                    <ColunasTempo
                      pontos={cronologico.map((v) => ({
                        id: v.id,
                        data: v.posted_at,
                        valor: valorTk(v, metrica),
                        dica: `${tituloDe(v)} (${diaMes(v.posted_at)}): ${numero(valorTk(v, metrica))} ${info.rotulo.toLowerCase()}`,
                      }))}
                    />
                  )}
                </section>
              </div>

              <section className="card stack">
                <div>
                  <h3 style={{ fontSize: 19 }}>Seguidores por dia</h3>
                  <span className="muted" style={{ fontSize: 13 }}>Um retrato por dia, tirado automaticamente.</span>
                </div>
                {serie.length >= 2 ? <LinhaSimples pontos={serie} rotulo="Seguidores por dia no TikTok" /> : <p className="muted">O gráfico aparece a partir do segundo dia de dados. Hoje: {numero(seguidores)} seguidores.</p>}
              </section>

              <details className="card">
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>Ver como tabela</summary>
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead>
                      <tr><th>Vídeo</th><th>Data</th><th className="n">Views</th><th className="n">Curtidas</th><th className="n">Coment.</th><th className="n">Envios</th></tr>
                    </thead>
                    <tbody>
                      {ordenados.map((v) => (
                        <tr key={v.id}>
                          <td>{v.share_url ? <a href={v.share_url} target="_blank" rel="noreferrer">{tituloDe(v)}</a> : tituloDe(v)}</td>
                          <td>{diaMes(v.posted_at)}</td>
                          <td className="n">{numero(v.views)}</td><td className="n">{numero(v.likes)}</td>
                          <td className="n">{numero(v.comments)}</td><td className="n">{numero(v.shares)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
        </>
      )}
    </>
  );
}
