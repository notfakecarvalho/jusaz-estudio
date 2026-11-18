import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ColunasTempo, LinhaSimples, RankingBarras, type Item } from "@/components/charts";
import { atualizarInsights } from "@/app/actions";
import { haQuanto, numero, ROTULO_MIDIA } from "@/lib/format";
import { diaMes, ehReel, METRICAS, primeiraLinha, segundos, valor, type MetricaId } from "@/lib/insights";
import { contaInstagram, postsInstagram, retratosConta } from "@/lib/queries";
import { supabaseServer } from "@/lib/supabase/server";
import type { IgPost } from "@/lib/types";

type VideoLigado = { id: string; duration_s: number | null; scripts: { title: string } | { title: string }[] | null };

const soma = (xs: (number | null)[]) => xs.reduce<number>((n, x) => n + (x ?? 0), 0);
const temAlgum = (xs: (number | null)[]) => xs.some((x) => x != null);

export default async function Insights({ searchParams }: { searchParams: Promise<{ m?: string; t?: string; erro?: string; ok?: string }> }) {
  const { m, t, erro, ok } = await searchParams;
  const sb = await supabaseServer();
  const [conta, posts, retratos, { data: videos }] = await Promise.all([
    contaInstagram(),
    postsInstagram(30),
    retratosConta(60),
    sb.from("videos").select("id, duration_s, scripts(title)").not("ig_media_id", "is", null).returns<VideoLigado[]>(),
  ]);

  const porVideo = new Map((videos ?? []).map((v) => [v.id, v]));
  const tituloDe = (p: IgPost) => {
    const v = p.video_id ? porVideo.get(p.video_id) : null;
    const sc = v ? (Array.isArray(v.scripts) ? v.scripts[0] : v.scripts) : null;
    return sc?.title ?? primeiraLinha(p.caption);
  };
  const tipoDe = (p: IgPost) => (ehReel(p) ? "Reel" : ROTULO_MIDIA[p.media_type ?? ""] ?? "Post");

  const reels = posts.filter(ehReel);
  const tipo = t === "todos" ? "todos" : t === "reels" ? "reels" : reels.length ? "reels" : "todos";
  const lista = tipo === "reels" ? reels : posts;
  const semReels = reels.length === 0;

  const metricasValidas = METRICAS.map((x) => x.id);
  const metrica: MetricaId = metricasValidas.includes(m as MetricaId)
    ? (m as MetricaId)
    : temAlgum(lista.map((p) => p.views)) ? "views" : "engaj";
  const info = METRICAS.find((x) => x.id === metrica)!;

  const link = (nova: { m?: string; t?: string }) => {
    const q = new URLSearchParams({ m: nova.m ?? metrica, t: nova.t ?? tipo });
    return `/insights?${q}`;
  };

  // Métricas que só o Instagram entrega (precisam de permissão no token).
  const comInsights = lista.some((p) => p.views != null || p.reach != null);
  const bloqueado = !comInsights && posts.some((p) => p.insights_erro);
  const motivoBloqueio = posts.find((p) => p.insights_erro)?.insights_erro ?? "";

  const ordenados = [...lista].sort((a, b) => (valor(b, metrica) ?? -1) - (valor(a, metrica) ?? -1));
  const rank = ordenados.filter((p) => valor(p, metrica) != null).slice(0, 10);
  const melhor = rank[0] && (valor(rank[0], metrica) ?? 0) > 0 ? rank[0] : null;

  const cronologico = [...lista].filter((p) => p.posted_at).sort((a, b) => (a.posted_at! < b.posted_at! ? -1 : 1)).slice(-20);

  // Números do topo
  const seguidores = conta?.followers ?? null;
  const comSeg = retratos.filter((r) => r.followers != null);
  const base30 = comSeg.find((r) => Date.now() - new Date(r.day + "T12:00:00").getTime() <= 30 * 86400e3);
  const deltaSeg = comSeg.length >= 2 && base30 && seguidores != null ? seguidores - (base30.followers ?? seguidores) : null;
  const views = temAlgum(lista.map((p) => p.views)) ? soma(lista.map((p) => p.views)) : null;
  const comAlcance = lista.filter((p) => p.reach != null);
  const alcanceMedio = comAlcance.length ? Math.round(soma(comAlcance.map((p) => p.reach)) / comAlcance.length) : null;
  const interTotal = soma(lista.map((p) => valor(p, "engaj")));
  const interMedia = lista.length ? Math.round((interTotal / lista.length) * 10) / 10 : null;
  const taxa = comAlcance.length && soma(comAlcance.map((p) => p.reach)) > 0
    ? (soma(comAlcance.map((p) => valor(p, "engaj"))) / soma(comAlcance.map((p) => p.reach))) * 100
    : null;

  // Retenção: tempo médio assistido ÷ duração do vídeo (só Reels feitos aqui)
  const retencao: Item[] = reels
    .map((p) => {
      const dur = p.video_id ? porVideo.get(p.video_id)?.duration_s : null;
      if (!p.avg_watch_ms || !dur) return null;
      const pct = Math.min(100, Math.round((p.avg_watch_ms / (dur * 1000)) * 100));
      return { id: p.id, rotulo: tituloDe(p), sub: `${segundos(p.avg_watch_ms)} de ${segundos(dur * 1000)}`, valor: pct, dica: `${tituloDe(p)}: em média ${segundos(p.avg_watch_ms)} assistidos de ${segundos(dur * 1000)}`, href: p.permalink };
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 10);

  const itens: Item[] = rank.map((p) => ({
    id: p.id,
    rotulo: tituloDe(p),
    sub: `${tipoDe(p)} · ${diaMes(p.posted_at)}`,
    valor: valor(p, metrica),
    dica: `${tituloDe(p)} (${diaMes(p.posted_at)}): ${numero(valor(p, metrica))} ${info.rotulo.toLowerCase()}`,
    href: p.permalink,
  }));

  const serieSeg = comSeg.map((r) => ({ dia: r.day, valor: r.followers as number }));
  const metricaSemDado = lista.length > 0 && !temAlgum(lista.map((p) => valor(p, metrica)));

  return (
    <>
      <AutoRefresh segundos={120} />
      <div className="head">
        <div>
          <span className="lbl">Métricas lidas {haQuanto(posts.map((p) => p.insights_at).filter(Boolean).sort().pop() ?? conta?.synced_at ?? null)}</span>
          <h1>Insights</h1>
        </div>
        <form action={atualizarInsights}>
          <button className="btn btn-s">Atualizar agora</button>
        </form>
      </div>

      {ok && <div className="toast t-ok" role="status">{ok}</div>}
      {erro && <div className="toast t-warn" role="alert">{erro}</div>}

      {bloqueado && (
        <div className="card stack" style={{ borderColor: "var(--yellow)" }}>
          <h3 style={{ fontSize: 19 }}>O Instagram ainda não liberou visualizações, alcance e tempo assistido</h3>
          <p className="muted">
            O token da conta foi aceito, mas não tem a permissão <b>instagram_manage_insights</b>. Gere um novo token com essa permissão
            e salve em IG_ACCESS_TOKEN nos segredos do Supabase. Enquanto isso, os gráficos usam curtidas e comentários.
          </p>
          <p className="muted" style={{ fontSize: 12 }}>Resposta do Instagram: {motivoBloqueio}</p>
          <div><Link className="btn btn-s btn-sm" href="/conexoes">Ver conexões</Link></div>
        </div>
      )}

      <div className="row wrap" style={{ gap: 20 }}>
        <div className="seg" role="group" aria-label="Tipo de publicação">
          <Link href={link({ t: "reels" })} className={tipo === "reels" ? "on" : ""} aria-current={tipo === "reels" ? "true" : undefined}>Reels ({reels.length})</Link>
          <Link href={link({ t: "todos" })} className={tipo === "todos" ? "on" : ""} aria-current={tipo === "todos" ? "true" : undefined}>Todas ({posts.length})</Link>
        </div>
        <div className="seg" role="group" aria-label="Métrica">
          {METRICAS.map((x) => (
            <Link key={x.id} href={link({ m: x.id })} title={x.dica} className={metrica === x.id ? "on" : ""} aria-current={metrica === x.id ? "true" : undefined}>{x.rotulo}</Link>
          ))}
        </div>
      </div>

      {semReels && tipo === "todos" && (
        <p className="muted">Ainda não há Reels publicados. Enquanto o primeiro não sai, o painel mostra todas as publicações da conta.</p>
      )}

      <div className="stats">
        <div className="stat">
          <span className="lbl">Seguidores</span>
          <b>{numero(seguidores)}</b>
          <span className="muted" style={{ fontSize: 12 }}>{deltaSeg == null ? "Variação aparece a partir do 2º dia" : `${deltaSeg >= 0 ? "+" : ""}${numero(deltaSeg)} em 30 dias`}</span>
        </div>
        <div className="stat">
          <span className="lbl">Visualizações</span>
          <b>{numero(views)}</b>
          <span className="muted" style={{ fontSize: 12 }}>{views == null ? "Precisa da permissão de insights" : `em ${lista.length} ${tipo === "reels" ? "Reels" : "publicações"}`}</span>
        </div>
        <div className="stat">
          <span className="lbl">Alcance médio</span>
          <b>{numero(alcanceMedio)}</b>
          <span className="muted" style={{ fontSize: 12 }}>{alcanceMedio == null ? "Precisa da permissão de insights" : "contas por publicação"}</span>
        </div>
        <div className="stat">
          <span className="lbl">Interações por publicação</span>
          <b>{interMedia == null ? "—" : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(interMedia)}</b>
          <span className="muted" style={{ fontSize: 12 }}>{taxa == null ? "curtidas, comentários e mais" : `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(taxa)}% do alcance`}</span>
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="card muted">Nenhum Reel publicado ainda. O primeiro sai na data marcada na Fila e as métricas aparecem aqui.</div>
      ) : (
        <>
          {melhor && (
            <section className="card best">
              {melhor.thumb_url ? <img className="best-thumb" src={melhor.thumb_url} alt="" /> : <div className="best-thumb" />}
              <div className="stack" style={{ gap: 6 }}>
                <span className="lbl">Melhor em {info.rotulo.toLowerCase()}</span>
                <h2 style={{ fontSize: 24 }}>{tituloDe(melhor)}</h2>
                <span className="muted">{tipoDe(melhor)} · {diaMes(melhor.posted_at)}</span>
                <div className="row wrap" style={{ gap: 20 }}>
                  <span><b>{numero(valor(melhor, metrica))}</b> <span className="muted">{info.rotulo.toLowerCase()}</span></span>
                  <span className="muted">♥ {numero(melhor.likes)} · 💬 {numero(melhor.comments_count)}{melhor.saves != null ? ` · salvos ${numero(melhor.saves)}` : ""}{melhor.shares != null ? ` · enviados ${numero(melhor.shares)}` : ""}</span>
                </div>
                {melhor.permalink && <div><a className="btn btn-s btn-sm" href={melhor.permalink} target="_blank" rel="noreferrer">Abrir no Instagram</a></div>}
              </div>
            </section>
          )}

          <div className="grid2">
            <section className="card stack">
              <div>
                <h3 style={{ fontSize: 19 }}>Ranking por {info.rotulo.toLowerCase()}</h3>
                <span className="muted" style={{ fontSize: 13 }}>As 10 melhores. A primeira fica em azul.</span>
              </div>
              {metricaSemDado ? (
                <p className="muted">O Instagram ainda não mandou {info.rotulo.toLowerCase()}. Escolha Curtidas, Comentários ou Interações.</p>
              ) : (
                <RankingBarras itens={itens} />
              )}
            </section>

            <section className="card stack">
              <div>
                <h3 style={{ fontSize: 19 }}>{info.rotulo} por publicação</h3>
                <span className="muted" style={{ fontSize: 13 }}>Da mais antiga para a mais nova (até 20). A maior está em azul.</span>
              </div>
              {metricaSemDado ? (
                <p className="muted">Sem dados dessa métrica ainda.</p>
              ) : (
                <ColunasTempo
                  pontos={cronologico.map((p) => ({
                    id: p.id,
                    data: p.posted_at,
                    valor: valor(p, metrica),
                    dica: `${tituloDe(p)} (${diaMes(p.posted_at)}): ${numero(valor(p, metrica))} ${info.rotulo.toLowerCase()}`,
                  }))}
                />
              )}
            </section>
          </div>

          <div className="grid2">
            <section className="card stack">
              <div>
                <h3 style={{ fontSize: 19 }}>Quanto do vídeo as pessoas assistem</h3>
                <span className="muted" style={{ fontSize: 13 }}>Tempo médio assistido dividido pela duração do Reel. Quanto maior, mais o vídeo prende.</span>
              </div>
              {retencao.length ? (
                <RankingBarras itens={retencao} unidade="%" />
              ) : (
                <p className="muted">Aparece quando um Reel feito aqui for publicado e o Instagram liberar o tempo assistido.</p>
              )}
            </section>

            <section className="card stack">
              <div>
                <h3 style={{ fontSize: 19 }}>Seguidores por dia</h3>
                <span className="muted" style={{ fontSize: 13 }}>Um retrato por dia, tirado automaticamente.</span>
              </div>
              {serieSeg.length >= 2 ? (
                <LinhaSimples pontos={serieSeg} rotulo="Seguidores por dia" />
              ) : (
                <p className="muted">O gráfico aparece a partir do segundo dia de dados. Hoje: {numero(seguidores)} seguidores.</p>
              )}
            </section>
          </div>

          <details className="card">
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>Ver como tabela</summary>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Publicação</th><th>Data</th><th className="n">Views</th><th className="n">Alcance</th><th className="n">Curtidas</th>
                    <th className="n">Coment.</th><th className="n">Salvos</th><th className="n">Envios</th><th className="n">Assistido</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenados.map((p) => (
                    <tr key={p.id}>
                      <td>{p.permalink ? <a href={p.permalink} target="_blank" rel="noreferrer">{tituloDe(p)}</a> : tituloDe(p)} <span className="muted">· {tipoDe(p)}</span></td>
                      <td>{diaMes(p.posted_at)}</td>
                      <td className="n">{numero(p.views)}</td><td className="n">{numero(p.reach)}</td><td className="n">{numero(p.likes)}</td>
                      <td className="n">{numero(p.comments_count)}</td><td className="n">{numero(p.saves)}</td><td className="n">{numero(p.shares)}</td>
                      <td className="n">{segundos(p.avg_watch_ms)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </>
  );
}
