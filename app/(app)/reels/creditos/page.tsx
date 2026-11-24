// @ts-nocheck
'use client'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { sb, pingAgente, enviarAoAgente, AGENT, ETAPAS, msgErro, fmtData } from '@/lib/reels'
import { Icon, Barras, Chip, Aviso, Copiar, Escudo, andamento, fmtDur, fmtTam, Cab } from '@/components/reels/ui'

const ACOES = { roteiro_ia: 'Roteiro com IA', locucao_ia: 'Locução com IA', edicao_reel: 'Edição de um Reel', edicao_vsl: 'Edição animada (interface VSL)', cartoon_3d: 'Cartoon 3D narrado', ajuste: 'Ajuste depois de pronto', boas_vindas: 'Créditos de boas-vindas', reembolso_erro: 'Reembolso por erro' }

export default function Creditos() {
  const [saldo, setSaldo] = useState(null), [planos, setPlanos] = useState([]), [custos, setCustos] = useState([]), [ext, setExt] = useState(null)
  useEffect(() => {
    sb.rpc('saldo').then(r => setSaldo(r.data)); sb.from('planos').select('*').order('ordem').then(r => setPlanos(r.data || []))
    sb.from('custos').select('*').neq('acao', 'boas_vindas').then(r => setCustos(r.data || []))
    sb.from('creditos_extrato').select('*').order('criado_em', { ascending: false }).limit(50).then(r => setExt(r.data || []))
  }, [])
  return (<>
    <Cab titulo="Créditos" sub="Os créditos pagam a edição. O render roda no seu computador." />
    <div className="corpo">
    <section className="painel saldo-g">
      <div><span className="mut sm">Saldo atual</span><div className="num">{saldo ?? '–'}<small>créditos</small></div></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
        <button className="btn" disabled><Icon n="wallet" />Comprar créditos</button>
        <span className="mut sm">O pagamento ainda não está conectado.</span>
      </div>
    </section>
    {planos.length > 0 && <div className="planos">{planos.map(p => (
      <div key={p.id} className="plano"><b>{p.nome}</b>
        {p.preco_centavos != null ? <span className="preco">{(p.preco_centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span> : <span className="preco nd">Preço a definir</span>}
        <span className="mut sm">{p.creditos_mes != null ? p.creditos_mes + ' créditos por mês' : 'Créditos a definir'}</span></div>))}</div>}
    <div className="grade2">
      <section className="painel"><h2>O que cada ação custa</h2>
        <table className="tab"><thead><tr><th>Ação</th><th>Créditos</th></tr></thead><tbody>{custos.map(c => <tr key={c.acao}><td>{ACOES[c.acao] || c.acao}</td><td>{c.creditos}</td></tr>)}</tbody></table>
      </section>
      <section className="painel"><h2>Extrato</h2>
        {ext === null ? <div aria-busy="true"><div className="esq" /></div> : ext.length === 0 ? <p className="mut">Nenhum uso ainda.</p> : (
          <table className="tab"><thead><tr><th>Movimento</th><th>Créditos</th></tr></thead><tbody>{ext.map(x => (
            <tr key={x.id}><td>{ACOES[x.motivo] || x.motivo}<span className="quando">{fmtData(x.criado_em)}</span></td><td className={x.delta > 0 ? 'pos' : ''}><span>{x.delta > 0 ? '+' : ''}{x.delta}</span></td></tr>))}</tbody></table>
        )}
      </section>
    </div>
    </div>
  </>)
}
