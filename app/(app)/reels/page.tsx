// @ts-nocheck
'use client'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { sb, pingAgente, enviarAoAgente, AGENT, ETAPAS, msgErro, fmtData } from '@/lib/reels'
import { Icon, Barras, Chip, Aviso, Copiar, Escudo, andamento, fmtDur, fmtTam, Cab } from '@/components/reels/ui'

const ABAS = [['todos', 'Todos'], ['andamento', 'Em andamento'], ['pronto', 'Prontos'], ['erro', 'Com problema']]

export default function Projetos() {
  const [lista, setLista] = useState(null), [peds, setPeds] = useState({}), [aba, setAba] = useState('todos'), [falha, setFalha] = useState(false)
  useEffect(() => {
    let vivo = true
    const carregar = async () => {
      const { data: ps, error } = await sb.from('projetos').select('*').order('atualizado_em', { ascending: false })
      if (!vivo) return
      if (error) { setFalha(true); setLista(l => l || []); return }
      const m = {}
      if (ps?.length) {
        const { data: pd } = await sb.from('pedidos').select('projeto_id,status,etapa,progresso,criado_em').in('projeto_id', ps.map(p => p.id)).order('criado_em', { ascending: false })
        ;(pd || []).forEach(x => { if (!m[x.projeto_id]) m[x.projeto_id] = x })
      }
      if (!vivo) return
      setFalha(false); setPeds(m); setLista(ps || [])
    }
    carregar(); const t = setInterval(carregar, 6000)
    return () => { vivo = false; clearInterval(t) }
  }, [])
  const itens = (lista || []).map(p => ({ p, ped: peds[p.id], a: andamento(peds[p.id]) }))
  const conta = k => k === 'todos' ? itens.length : itens.filter(i => i.a.grupo === k).length
  const vis = aba === 'todos' ? itens : itens.filter(i => i.a.grupo === aba)
  return (<>
    <Cab titulo="Reels" sub="O vídeo de cada Reel fica na pasta do seu computador. Aqui ficam o pedido e o andamento." />
    <div className="corpo">
    {falha && <Aviso tom="warn" role="alert">Não consegui atualizar a lista agora. Vou tentar de novo em instantes.</Aviso>}
    {lista === null ? (
      <div className="lista" aria-busy="true" aria-label="Carregando Reels"><div className="esq" /><div className="esq" /><div className="esq" /></div>
    ) : lista.length === 0 ? (
      <div className="vazio">
        <Icon n="film" s={28} />
        <h2>Bora criar o primeiro Reel?</h2>
        <p>Escolha o vídeo no seu computador, diga o estilo e a plataforma monta a edição. O MP4 final volta para a sua pasta.</p>
        <a className="btn" href="/reels/novo"><Icon n="plus" />Novo Reel</a>
      </div>
    ) : (<>
      <div className="abas" role="tablist" aria-label="Filtrar Reels">
        {ABAS.map(([k, t]) => <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)}>{t}<span className="n">{conta(k)}</span></button>)}
      </div>
      {vis.length === 0 ? <div className="vazio"><p>Nenhum Reel nesta aba.</p></div> : (
        <div className="lista" role="tabpanel">
          <div className="cols-h" aria-hidden="true"><span>Reel</span><span>Andamento</span><span>Atualizado</span><span /></div>
          <ul>
            {vis.map(({ p, ped, a }) => (
              <li key={p.id}>
                <a className="linha" href={'/reels/' + p.id}>
                  <div className="tit"><b>{p.titulo}</b><span>{p.arquivo_nome}{p.duracao_s != null && ' · ' + fmtDur(p.duracao_s)}</span></div>
                  <div className="and">
                    <Barras estados={a.estados} />
                    <span className={a.tom}>{a.tom === 'ok' && <Icon n="circleCheck" s={14} />}{a.tom === 'err' && <Icon n="alert" s={14} />}{a.texto}{a.tom === 'run' && ped?.progresso != null && ' · ' + ped.progresso + '%'}</span>
                  </div>
                  <div className="quando">{fmtData(p.atualizado_em)}</div>
                  <Icon n="chevron" s={16} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>)}
    </div>
  </>)
}
