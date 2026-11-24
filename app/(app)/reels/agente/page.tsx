// @ts-nocheck
'use client'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { sb, pingAgente, enviarAoAgente, AGENT, ETAPAS, msgErro, fmtData } from '@/lib/reels'
import { Icon, Barras, Chip, Aviso, Copiar, Escudo, andamento, fmtDur, fmtTam, Cab } from '@/components/reels/ui'

export default function Agente() {
  const [a, setA] = useState(null)
  useEffect(() => { const f = () => pingAgente().then(setA); f(); const t = setInterval(f, 4000); return () => clearInterval(t) }, [])
  const cmd = t => <div className="cod"><code>{t}</code><Copiar texto={t} /></div>
  return (<>
    <Cab titulo="Agente local" sub="É o programa que guarda seus vídeos e faz o render. Deixe aberto quando for editar." acao={a ? <Chip tom="ok">Online</Chip> : <Chip tom="wait">Offline</Chip>} />
    <div className="corpo">
    <section className="painel"><h2>Este computador</h2>
      <dl className="dl"><div><dt>Nome</dt><dd>{a?.nome || '—'}</dd></div><div><dt>Pasta dos Reels</dt><dd className="mono">{a?.pasta || '—'}</dd></div><div><dt>Versão</dt><dd className="mono">{a?.versao || '—'}</dd></div></dl>
    </section>
    <section className="painel"><h2>Instalar</h2>
      <ol className="passos">
        <li><div><span>Instale o Node 20 ou mais novo (nodejs.org) e o ffmpeg. No Mac:</span>{cmd('brew install ffmpeg')}</div></li>
        <li><div><span>Baixe o agente e descompacte.</span><div><a className="btn sec peq" href="/agente.tgz" download><Icon n="download" s={14} />Baixar o agente</a></div>{cmd('tar -xzf agente.tgz')}</div></li>
        <li><div><span>Na pasta <code>agent</code>, instale e inicie.</span>{cmd('cd agent && npm install && npm start')}</div></li>
        <li><div><span>Entre com o e-mail e a senha desta conta e deixe a janela aberta.</span></div></li>
      </ol>
      <Aviso>Um instalador de um clique para Mac e Windows ainda não existe: por enquanto é por esta linha de comando.</Aviso>
      <p className="nota mut">Para o estilo "Interface animada (VSL)", o agente também usa Chrome, whisper.cpp e Python com numpy e opencv. Ao abrir, ele avisa o que faltar, e o README do agente tem os comandos.</p>
    </section>
    <div className="pedra">
      <section className="painel"><h2><Icon n="lock" s={18} />Fica no seu computador</h2><ul><li><Icon n="check" s={16} />O vídeo original e o Reel pronto</li><li><Icon n="check" s={16} />A pasta de cada projeto</li><li><Icon n="check" s={16} />O render</li></ul></section>
      <section className="painel"><h2><Icon n="cloud" s={18} />Vai para a plataforma</h2><ul><li><Icon n="check" s={16} />O texto do pedido</li><li><Icon n="check" s={16} />O andamento e as mensagens</li><li><Icon n="check" s={16} />O saldo de créditos</li></ul></section>
    </div>
    </div>
  </>)
}
