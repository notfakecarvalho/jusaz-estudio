import { diaMes, tetoRedondo } from "@/lib/insights";
import { numero } from "@/lib/format";

// Cores: destaque no azul da marca, o resto em cinza. Os números sempre aparecem escritos.
const DESTAQUE = "#2447E0";
const CINZA = "#8A93A8";
const GRADE = "#E4DFD2";

export type Item = { id: string; rotulo: string; sub?: string; valor: number | null; dica: string; href?: string | null };

// Ranking em barras horizontais: a maior fica em destaque.
export function RankingBarras({ itens, unidade = "" }: { itens: Item[]; unidade?: string }) {
  const max = Math.max(1, ...itens.map((i) => i.valor ?? 0));
  const melhor = itens.find((i) => (i.valor ?? 0) === max && max > 0)?.id;
  return (
    <ol className="bars" aria-label="Ranking">
      {itens.map((i, n) => {
        const pct = Math.max(((i.valor ?? 0) / max) * 100, i.valor ? 1.5 : 0);
        const conteudo = (
          <>
            <span className="bar-n">{n + 1}</span>
            <span className="bar-lbl">
              <b>{i.rotulo}</b>
              {i.sub && <small>{i.sub}</small>}
            </span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${pct}%`, background: i.id === melhor ? DESTAQUE : CINZA }} />
            </span>
            <span className="bar-val">{i.valor == null ? "—" : `${numero(i.valor)}${unidade}`}</span>
          </>
        );
        return (
          <li key={i.id} title={i.dica}>
            {i.href ? <a className="bar-row" href={i.href} target="_blank" rel="noreferrer">{conteudo}</a> : <div className="bar-row">{conteudo}</div>}
          </li>
        );
      })}
    </ol>
  );
}

// Colunas por publicação, em ordem de data. Passe o mouse (ou toque) para ver o valor.
export function ColunasTempo({ pontos }: { pontos: { id: string; data: string | null; valor: number | null; dica: string }[] }) {
  const W = 640, H = 220, ml = 44, mr = 8, mt = 12, mb = 28;
  const valores = pontos.map((p) => p.valor ?? 0);
  const topo = tetoRedondo(Math.max(...valores, 1));
  const iw = W - ml - mr, ih = H - mt - mb;
  const passo = iw / Math.max(pontos.length, 1);
  const largura = Math.min(24, passo * 0.62);
  const max = Math.max(...valores);
  const cada = Math.ceil(pontos.length / 8);
  const ticks = [0, 0.5, 1].map((f) => f * topo);
  const y = (v: number) => mt + ih - (v / topo) * ih;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Valor por publicação, da mais antiga para a mais nova" className="chart">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={ml} x2={W - mr} y1={y(t)} y2={y(t)} stroke={GRADE} strokeWidth={t === 0 ? 1.5 : 1} />
          <text x={ml - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#5b6478">{numero(Math.round(t))}</text>
        </g>
      ))}
      {pontos.map((p, i) => {
        const v = p.valor ?? 0;
        const h = Math.max((v / topo) * ih, v > 0 ? 3 : 0);
        const x = ml + passo * i + (passo - largura) / 2;
        const r = Math.min(4, h / 2);
        const forte = v === max && max > 0;
        return (
          <g key={p.id} className="col">
            <rect x={ml + passo * i} y={mt} width={passo} height={ih + 4} fill="transparent" />
            {h > 0 && (
              <path
                d={`M${x},${mt + ih} V${mt + ih - h + r} Q${x},${mt + ih - h} ${x + r},${mt + ih - h} H${x + largura - r} Q${x + largura},${mt + ih - h} ${x + largura},${mt + ih - h + r} V${mt + ih} Z`}
                fill={forte ? DESTAQUE : CINZA}
              />
            )}
            {i % cada === 0 && <text x={x + largura / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#5b6478">{diaMes(p.data)}</text>}
            <title>{p.dica}</title>
          </g>
        );
      })}
      {max > 0 && (() => {
        const i = valores.indexOf(max);
        const x = ml + passo * i + passo / 2;
        return <text x={x} y={y(max) - 6} textAnchor="middle" fontSize="12" fontWeight="700" fill="#0e1b33">{numero(max)}</text>;
      })()}
    </svg>
  );
}

// Linha simples (uma série) para seguidores ao longo dos dias.
export function LinhaSimples({ pontos, rotulo }: { pontos: { dia: string; valor: number }[]; rotulo: string }) {
  const W = 640, H = 200, ml = 44, mr = 16, mt = 16, mb = 28;
  const vs = pontos.map((p) => p.valor);
  const min = Math.min(...vs), max = Math.max(...vs);
  const passo = Math.max(1, tetoRedondo(Math.max(max - min, 1) / 3));
  const lo = Math.max(0, Math.floor(min / passo) * passo), hi = Math.max(Math.ceil(max / passo) * passo, lo + passo);
  const iw = W - ml - mr, ih = H - mt - mb;
  const x = (i: number) => ml + (pontos.length === 1 ? iw / 2 : (i / (pontos.length - 1)) * iw);
  const y = (v: number) => mt + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const d = pontos.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.valor)}`).join(" ");
  const ticks: number[] = [];
  for (let t = lo; t <= hi + 1e-9; t += passo) ticks.push(t);
  const cada = Math.ceil(pontos.length / 7);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={rotulo} className="chart">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={ml} x2={W - mr} y1={y(t)} y2={y(t)} stroke={GRADE} strokeWidth="1" />
          <text x={ml - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#5b6478">{numero(Math.round(t))}</text>
        </g>
      ))}
      <path d={d} fill="none" stroke={DESTAQUE} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pontos.map((p, i) => (
        <g key={p.dia}>
          <circle cx={x(i)} cy={y(p.valor)} r="4" fill={DESTAQUE} stroke="#fff" strokeWidth="2" />
          <circle cx={x(i)} cy={y(p.valor)} r="12" fill="transparent"><title>{`${diaMes(p.dia + "T12:00:00Z")}: ${numero(p.valor)}`}</title></circle>
          {i % cada === 0 && <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#5b6478">{diaMes(p.dia + "T12:00:00Z")}</text>}
        </g>
      ))}
      <text x={x(pontos.length - 1)} y={y(pontos[pontos.length - 1].valor) - 12} textAnchor="end" fontSize="12" fontWeight="700" fill="#0e1b33">{numero(pontos[pontos.length - 1].valor)}</text>
    </svg>
  );
}
