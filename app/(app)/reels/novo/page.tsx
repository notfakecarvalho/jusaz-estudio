// @ts-nocheck
'use client'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { sb, pingAgente, enviarAoAgente, AGENT, ETAPAS, msgErro, fmtData } from '@/lib/reels'
import { Icon, Barras, Chip, Aviso, Copiar, Escudo, andamento, fmtDur, fmtTam, Cab } from '@/components/reels/ui'

const AUDIOS = [['proprio', 'Áudio do meu Reel', 'Mantém a fala original e melhora ritmo e legendas.'], ['outro', 'Enviar outro áudio', 'Locução ou música que você já tem.'], ['ia', 'Locução com IA', 'Em breve.', true]]

function Solta({ arq, dur, onFile }) {
  const [sobre, setSobre] = useState(false), inp = useRef(null)
  const solto = e => { e.preventDefault(); setSobre(false); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('video/')) onFile(f) }
  return (
    <div className={'solta' + (sobre ? ' sobre' : '') + (arq ? ' cheio' : '')} onDragOver={e => { e.preventDefault(); setSobre(true) }} onDragLeave={() => setSobre(false)} onDrop={solto}>
      <span className="ic"><Icon n={arq ? 'check' : 'upload'} s={20} /></span>
      <div className="txt">
        <b>{arq ? arq.name : 'Arraste o vídeo para cá ou escolha no computador'}</b>
        <span>{arq ? <span className="mono">{fmtTam(arq.size)}{dur != null && ' · ' + fmtDur(dur)}</span> : 'MP4 ou MOV. Fica na pasta do agente e não sai do seu computador.'}</span>
      </div>
      <button type="button" className="btn sec" onClick={() => inp.current.click()}>{arq ? 'Trocar vídeo' : 'Escolher vídeo'}</button>
      <input ref={inp} className="vh" tabIndex={-1} type="file" accept="video/*" onChange={e => e.target.files[0] && onFile(e.target.files[0])} />
    </div>
  )
}

export default function Novo() {
  const router = useRouter()
  const [estilos, setEstilos] = useState([]), [custos, setCustos] = useState({}), [saldo, setSaldo] = useState(0), [agente, setAgente] = useState(null), [pronto, setPronto] = useState(false)
  const [arq, setArq] = useState(null), [dur, setDur] = useState(null), [titulo, setTitulo] = useState(''), [ref, setRef] = useState('')
  const [audio, setAudio] = useState('proprio'), [audioArq, setAudioArq] = useState(null), [estilo, setEstilo] = useState(null), [instr, setInstr] = useState('')
  const [erro, setErro] = useState(''), [enviando, setEnviando] = useState(false)
  useEffect(() => {
    Promise.all([
      sb.from('estilos').select('*').order('ordem').then(r => { setEstilos(r.data || []); if (r.data?.length) setEstilo(r.data[0].id) }),
      sb.from('custos').select('*').then(r => setCustos(Object.fromEntries((r.data || []).map(c => [c.acao, c.creditos])))),
      sb.rpc('saldo').then(r => setSaldo(r.data || 0)),
      pingAgente().then(setAgente),
    ]).then(() => setPronto(true))
    const t = setInterval(() => pingAgente().then(setAgente), 5000)
    return () => clearInterval(t)
  }, [])
  const custoDe = s => custos[s?.tipo === 'cartoon3d' ? 'cartoon_3d' : s?.motor === 'vsl' ? 'edicao_vsl' : 'edicao_reel'] || 0
  const escolhido = estilos.find(e => e.id === estilo)
  const custo = custoDe(escolhido)
  const escolherVideo = f => {
    setArq(f); setDur(null); if (!titulo) setTitulo(f.name.replace(/\.[^.]+$/, ''))
    const v = document.createElement('video'); v.preload = 'metadata'; v.src = URL.createObjectURL(f)
    v.onloadedmetadata = () => { setDur(v.duration); URL.revokeObjectURL(v.src) }
  }
  const reqs = [
    [!!arq, 'Vídeo escolhido', 'Escolha o vídeo do Reel'],
    [!!agente, 'Agente aberto neste computador', 'Abra o agente neste computador', '/reels/agente'],
    ...(audio === 'outro' ? [[!!audioArq, 'Áudio escolhido', 'Escolha o arquivo de áudio']] : []),
    ...(escolhido?.motor === 'vsl' ? [[audio !== 'outro', 'Voz do próprio vídeo', 'O estilo animado não aceita outro áudio']] : []),
    [pronto && saldo >= custo, 'Créditos suficientes', `Faltam créditos: o pedido custa ${custo} e você tem ${saldo}`, '/reels/creditos'],
  ]
  const falta = reqs.filter(r => !r[0]).length
  const enviar = async () => {
    setErro('')
    if (falta) return
    setEnviando(true)
    try {
      const { data: p, error: e1 } = await sb.from('projetos').insert({ titulo: titulo || arq.name, arquivo_nome: arq.name, duracao_s: dur }).select().single()
      if (e1) throw e1
      await enviarAoAgente(p.id, 'original', arq)
      if (audio === 'outro') await enviarAoAgente(p.id, 'audio', audioArq)
      const { error: e2 } = await sb.rpc('criar_pedido', { p_projeto: p.id, p_estilo: estilo, p_audio: audio, p_referencia: ref, p_instrucoes: instr })
      if (e2) throw e2
      router.push('/reels/' + p.id)
    } catch (e) { setErro(msgErro(e)); setEnviando(false) }
  }
  return (<>
    <Cab titulo="Novo Reel" sub="Traga o vídeo, a referência e o áudio. A plataforma monta a edição no estilo escolhido." />
    <div className="corpo">
    <div className="dois">
      <div className="col">
        <Escudo titulo="Seu vídeo não sai do seu computador">Só o texto do pedido e o andamento vão para a plataforma. O MP4 final volta para a sua pasta.</Escudo>
        <section className="painel passo"><h2><span className="n">1</span>Seu Reel</h2>
          <Solta arq={arq} dur={dur} onFile={escolherVideo} />
          <label className="campo"><span>Nome do projeto</span><input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} /></label>
          {pronto && !agente && <Aviso tom="warn">O agente não está aberto neste computador, então o vídeo não tem onde ficar guardado. <a href="/reels/agente">Como instalar</a></Aviso>}
        </section>
        <section className="painel passo"><h2><span className="n">2</span>Referência</h2>
          <label className="campo"><span>Link de um Reel que você quer imitar</span><input type="text" inputMode="url" value={ref} onChange={e => setRef(e.target.value)} placeholder="https://www.instagram.com/reel/…" /></label>
        </section>
        <section className="painel passo"><h2><span className="n">3</span>Áudio</h2>
          <div className="opcoes" role="radiogroup" aria-label="Áudio">
            {AUDIOS.map(([k, n, d, off]) => (
              <label key={k} className={'opcao' + (audio === k ? ' on' : '') + (off ? ' off' : '')}>
                <input className="vh" type="radio" name="audio" value={k} disabled={off} checked={audio === k} onChange={() => setAudio(k)} />
                <b>{n}</b><span>{d}</span>
              </label>
            ))}
          </div>
          {audio === 'outro' && <label className="campo"><span>Arquivo de áudio</span><input type="file" accept="audio/*" onChange={e => setAudioArq(e.target.files[0] || null)} /></label>}
        </section>
        <section className="painel passo"><h2><span className="n">4</span>Estilo de animação</h2>
          <div className="opcoes" role="radiogroup" aria-label="Estilo de animação">
            {estilos.map(s => (
              <label key={s.id} className={'opcao' + (estilo === s.id ? ' on' : '')}>
                <input className="vh" type="radio" name="estilo" value={s.id} checked={estilo === s.id} onChange={() => setEstilo(s.id)} />
                <b>{s.nome}<span className="custo">{custoDe(s)} cr</span></b><span>{s.descricao}</span>
              </label>
            ))}
          </div>
          {escolhido?.motor === 'vsl' && <p className="nota mut">Este estilo corta pelo som e monta telas animadas no seu computador. Precisa de Chrome, whisper.cpp e Python com numpy e opencv (o agente avisa o que faltar). Leva mais tempo que o estilo simples e usa a voz do próprio vídeo.</p>}
          {escolhido?.motor === 'vsl' && audio === 'outro' && <Aviso tom="err" role="alert">O estilo animado usa a voz do próprio vídeo. Escolha "Áudio do meu Reel" ou troque o estilo.</Aviso>}
        </section>
        <section className="painel passo"><h2><span className="n">5</span>Pedido de edição</h2>
          <label className="campo"><span>Descreva como você quer o Reel</span><textarea rows={4} value={instr} onChange={e => setInstr(e.target.value)} placeholder="Ex.: título logo no começo, cortes rápidos e uma chamada no final." /></label>
        </section>
      </div>
      <aside className="lado">
        <div className="painel"><h2>Resumo</h2>
          <dl className="dl">
            <div><dt>Reel</dt><dd>{arq ? arq.name : '—'}</dd></div>
            <div><dt>Áudio</dt><dd>{AUDIOS.find(a => a[0] === audio)[1]}</dd></div>
            <div><dt>Estilo</dt><dd>{escolhido?.nome || '—'}</dd></div>
            <div><dt>Custo</dt><dd className="mono">{custo} créditos</dd></div>
            <div><dt>Seu saldo</dt><dd className="mono">{saldo} créditos</dd></div>
          </dl>
          <ul className="req" aria-label="O que falta para enviar">
            {reqs.map(([ok, sim, nao, href], i) => (
              <li key={i} className={ok ? 'ok' : 'falta'}><Icon n={ok ? 'circleCheck' : 'circle'} s={16} /><span>{ok ? sim : href ? <a href={href}>{nao}</a> : nao}</span></li>
            ))}
          </ul>
          {erro && <Aviso tom="err" role="alert">{erro}</Aviso>}
          <button className="btn cheio" disabled={enviando || falta > 0} onClick={enviar}>{enviando ? <><Icon n="spinner" className="giro" />Enviando…</> : <><Icon n="send" />Enviar para edição</>}</button>
          <p className="mut sm">A edição roda no seu agente local. O MP4 final volta para a sua pasta.</p>
        </div>
      </aside>
    </div>
    </div>
  </>)
}
