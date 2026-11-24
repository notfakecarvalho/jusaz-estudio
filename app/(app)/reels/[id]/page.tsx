// @ts-nocheck
'use client'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { sb, pingAgente, enviarAoAgente, AGENT, ETAPAS, msgErro, fmtData } from '@/lib/reels'
import { Icon, Barras, Chip, Aviso, Copiar, Escudo, andamento, fmtDur, fmtTam, Cab } from '@/components/reels/ui'

export default function Edicao() {
  const { id } = useParams()
  const [proj, setProj] = useState(null), [ped, setPed] = useState(null), [msgs, setMsgs] = useState([]), [texto, setTexto] = useState(''), [erro, setErro] = useState(''), [agente, setAgente] = useState(null), [naoAchou, setNaoAchou] = useState(false)
  const carregar = useCallback(async () => {
    const { data: p } = await sb.from('projetos').select('*').eq('id', id).maybeSingle()
    if (!p) return setNaoAchou(true)
    setProj(p)
    const { data: pe } = await sb.from('pedidos').select('*').eq('projeto_id', id).order('criado_em', { ascending: false }).limit(1)
    setPed(pe?.[0] || null)
    if (pe?.[0]) { const { data: m } = await sb.from('mensagens').select('*').eq('pedido_id', pe[0].id).order('criado_em'); setMsgs(m || []) }
    setAgente(await pingAgente())
  }, [id])
  useEffect(() => { carregar(); const t = setInterval(carregar, 3000); return () => clearInterval(t) }, [carregar])
  if (naoAchou) return <><Cab titulo="Reel não encontrado" /><div className="corpo"><div className="vazio"><p>Este Reel não existe ou não é seu.</p><a className="btn sec" href="/reels">Voltar para os Reels</a></div></div></>
  if (!proj) return <><Cab titulo="Carregando…" /><div className="corpo"><div className="lista" aria-busy="true"><div className="esq" /><div className="esq" /></div></div></>
  const a = andamento(ped)
  const pronto = ped?.status === 'concluido'
  const ajuste = async () => {
    setErro(''); const { error } = await sb.rpc('pedir_ajuste', { p_pedido: ped.id, p_texto: texto })
    if (error) return setErro(msgErro(error)); setTexto(''); carregar()
  }
  const refazer = async () => { const { error } = await sb.rpc('refazer_pedido', { p_pedido: ped.id }); if (error) setErro(msgErro(error)); else carregar() }
  const abrir = () => fetch(`${AGENT}/abrir/${proj.id}`, { method: 'POST' }).catch(() => setErro('Abra o agente para abrir a pasta.'))
  const chipTxt = a.tom === 'run' ? 'Editando: ' + a.texto.toLowerCase() : a.texto
  const rotulo = { ok: 'Feito', run: 'Em andamento', err: 'Parou', wait: 'Aguardando' }
  const podeAjustar = ped && ['concluido', 'erro'].includes(ped.status)
  return (<>
    <Cab titulo={proj.titulo} sub={<span className="mono">{proj.arquivo_nome}{proj.duracao_s != null && ' · ' + fmtDur(proj.duracao_s)}</span>} acao={<Chip tom={a.tom}>{chipTxt}</Chip>} />
    <div className="corpo">
    <div className="edicao">
      <div className="esq-col">
        <div className="tela">
          {pronto && agente ? <video controls playsInline src={`${AGENT}/video/${ped.id}.mp4`} /> : (
            <div className="nada"><Barras estados={a.estados} /><b>{pronto ? 'Abra o agente para ver o vídeo' : a.tom === 'err' ? 'A edição parou antes de gerar o vídeo' : 'A prévia aparece quando o render terminar'}</b></div>
          )}
        </div>
        {pronto && agente ? <a className="btn cheio" href={`${AGENT}/video/${ped.id}.mp4?baixar=1`}><Icon n="download" />Baixar MP4</a> : <button className="btn cheio" disabled><Icon n="download" />Baixar MP4</button>}
        <button className="btn sec cheio" disabled={!agente} onClick={abrir}><Icon n="folder" />Abrir pasta no computador</button>
        <button className="btn sec cheio" disabled><Icon n="send" />Postar no Instagram</button>
        <p className="mut sm">A postagem direta depende da aprovação do app na Meta e ainda não está disponível.</p>
      </div>
      <div className="coluna">
        <section className="painel"><h2>O que está acontecendo</h2>
          {!ped ? <p className="mut">Nenhum pedido neste projeto.</p> : <>
            {ped.status === 'fila' && (agente ? <Aviso tom="ok" role="status">Na fila: o agente vai começar já.</Aviso> : <Aviso tom="warn" role="status">Aguardando o agente. Abra-o neste computador. <a href="/reels/agente">Como abrir</a></Aviso>)}
            {ped.status === 'erro' && (
              <Aviso tom="err" role="alert">
                {ped.erro || 'Algo deu errado.'} {ped.reembolsado ? 'Os créditos foram devolvidos.' : ''}
                {!ped.reembolsado && <div><button className="btn sec peq" onClick={refazer}><Icon n="refresh" s={14} />Tentar de novo</button></div>}
              </Aviso>
            )}
            <div className="progresso"><span className="mut sm">Andamento</span><span className="pct">{ped.status === 'concluido' ? 100 : ped.progresso || 0}%</span></div>
            <div>
              <Barras grande estados={a.estados} />
              <div className="legenda" style={{ marginTop: 8 }} aria-hidden="true">{['Pedido', 'Plano', 'Render', 'MP4'].map((t, i) => <span key={t} className={a.estados[i] === 'run' ? 'on' : ''}>{t}</span>)}</div>
            </div>
            <ol className="etapas">
              {ETAPAS.map((e, i) => { const st = a.estados[i]; return (
                <li key={e[0]} className={st}>
                  <span className="ic"><Icon n={st === 'ok' ? 'circleCheck' : st === 'run' ? 'spinner' : st === 'err' ? 'circleX' : 'circle'} className={st === 'run' ? 'giro' : ''} /></span>
                  <div><b>{e[1]}</b><p>{e[2]}</p></div>
                  <Chip tom={st}>{rotulo[st]}</Chip>
                </li>) })}
            </ol>
          </>}
        </section>
        <section className="painel"><h2>Conversa com o editor</h2>
          <div className="conversa" aria-live="polite">
            {msgs.length === 0 && <p className="mut">As mensagens do editor aparecem aqui.</p>}
            {msgs.map(m => <div key={m.id} className={'msg ' + (m.papel === 'claude' ? 'c' : 'u')}><small>{m.papel === 'claude' ? 'Editor' : 'Você'}</small>{m.texto}</div>)}
          </div>
          {erro && <Aviso tom="err" role="alert">{erro}</Aviso>}
          {podeAjustar && (
            <form className="envio" onSubmit={e => { e.preventDefault(); if (texto.trim()) ajuste() }}>
              <input type="text" aria-label="Pedir um ajuste" placeholder="Peça um ajuste na edição" value={texto} onChange={e => setTexto(e.target.value)} />
              <button className="btn" disabled={!texto.trim()}><Icon n="send" />Pedir ajuste</button>
            </form>
          )}
        </section>
      </div>
    </div>
    </div>
  </>)
}
