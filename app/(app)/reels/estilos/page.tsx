// @ts-nocheck
'use client'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { sb, pingAgente, enviarAoAgente, AGENT, ETAPAS, msgErro, fmtData } from '@/lib/reels'
import { Icon, Barras, Chip, Aviso, Copiar, Escudo, andamento, fmtDur, fmtTam, Cab } from '@/components/reels/ui'

const TIPOS = { reel: 'Reel', cartoon3d: 'Cartoon 3D' }

export default function Estilos() {
  const [lista, setLista] = useState(null), [uid, setUid] = useState(null), [nome, setNome] = useState(''), [desc, setDesc] = useState(''), [prompt, setPrompt] = useState(''), [erro, setErro] = useState(''), [apagando, setApagando] = useState(null), [fonte, setFonte] = useState('')
  const carregar = () => sb.from('estilos').select('*').order('ordem').then(r => setLista(r.data || []))
  useEffect(() => { carregar(); sb.auth.getUser().then(r => setUid(r.data.user.id)) }, [])
  const add = async e => {
    e.preventDefault(); setErro(''); if (!nome.trim() || !prompt.trim()) return setErro('Dê um nome e cole o prompt.')
    const url = fonte.trim()
    if (url && !/^https?:\/\//i.test(url)) return setErro('O link do autor precisa começar com http:// ou https://.')
    const { error } = await sb.from('estilos').insert({ user_id: uid, nome, descricao: desc, prompt, tipo: 'reel', ordem: 100, fonte_url: url || null })
    if (error) return setErro(error.message); setNome(''); setDesc(''); setPrompt(''); setFonte(''); carregar()
  }
  const apagar = async id => { await sb.from('estilos').delete().eq('id', id); setApagando(null); carregar() }
  const pedir = id => { if (apagando === id) return apagar(id); setApagando(id); setTimeout(() => setApagando(a => (a === id ? null : a)), 4000) }
  return (<>
    <Cab titulo="Estilos de animação" sub="Cada estilo é uma instrução aplicada na edição do seu Reel." />
    <div className="corpo">
    <div className="dois larga">
      <section className="painel"><h2>Biblioteca</h2>
        {lista === null ? <div aria-busy="true"><div className="esq" /><div className="esq" /></div> : lista.length === 0 ? <p className="mut">Nenhum estilo ainda.</p> : (
          <ul>{lista.map(s => (
            <li key={s.id} className="estilo">
              <div><b>{s.nome}<Chip tom="wait" semIcone>{s.user_id ? 'Seu estilo' : 'Do estúdio'}</Chip>{s.motor === 'vsl' && <Chip tom="wait" semIcone>Motor animado</Chip>}</b><p>{s.descricao || TIPOS[s.tipo] || ''}</p>{s.fonte_url && /^https?:\/\//i.test(s.fonte_url) && <p className="nota mut">Autor: <a href={s.fonte_url} target="_blank" rel="noopener noreferrer">{s.fonte_url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 48)}</a></p>}</div>
              {s.user_id && <button className={'btn peq ' + (apagando === s.id ? 'perigo' : 'sec')} onClick={() => pedir(s.id)}><Icon n="trash" s={14} />{apagando === s.id ? 'Confirmar' : 'Apagar'}</button>}
            </li>))}
          </ul>
        )}
      </section>
      <form className="painel lado" onSubmit={add}><h2>Importar prompt de motion</h2>
        <p className="nota mut">Cole o prompt de motion. Ele vira um estilo que aparece na hora de montar o Reel.</p>
        <p className="nota mut">Quer ideias? Veja os prompts em <a href="https://prompt-motion.com" target="_blank" rel="noopener noreferrer">prompt-motion.com</a>. Cada prompt pertence ao seu criador: importe só os que você pode usar e guarde o link do autor aqui.</p>
        <label className="campo"><span>Nome do estilo</span><input type="text" value={nome} onChange={e => setNome(e.target.value)} /></label>
        <label className="campo"><span>Descrição curta</span><input type="text" value={desc} onChange={e => setDesc(e.target.value)} /></label>
        <label className="campo"><span>Prompt</span><textarea rows={8} value={prompt} onChange={e => setPrompt(e.target.value)} /></label>
        <label className="campo"><span>Link do autor (opcional)</span><input type="url" inputMode="url" placeholder="https://prompt-motion.com/…" value={fonte} onChange={e => setFonte(e.target.value)} /></label>
        {erro && <Aviso tom="err" role="alert">{erro}</Aviso>}
        <button className="btn"><Icon n="plus" />Adicionar à biblioteca</button>
      </form>
    </div>
    </div>
  </>)
}
