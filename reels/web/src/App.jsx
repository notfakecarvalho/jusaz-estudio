import React, { useEffect, useRef, useState, useCallback } from 'react'
import { sb, pingAgente, enviarAoAgente, AGENT, ETAPAS, msgErro, fmtData } from './lib.js'
import { Icon, Marca, Barras, Chip, Aviso, Copiar, Selo, Escudo, andamento, fmtDur, fmtTam, MARCA } from './ui.jsx'

const useHash = () => {
  const [h, setH] = useState(location.hash || '#/')
  useEffect(() => { const f = () => setH(location.hash || '#/'); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  return h
}

function Cab({ titulo, sub, acao }) {
  return (
    <header className="banda">
      <div className="miolo">
        <div><h1>{titulo}</h1>{sub && <p>{sub}</p>}</div>
        {acao && <div className="acoes">{acao}</div>}
      </div>
    </header>
  )
}

/* ---------- landing e entrada ---------- */
function Acesso({ modo, setModo, fechar }) {
  const [email, setEmail] = useState(''), [senha, setSenha] = useState(''), [nome, setNome] = useState('')
  const [erro, setErro] = useState(''), [info, setInfo] = useState(''), [carregando, setCarregando] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const f = e => { if (e.key === 'Escape') fechar() }
    addEventListener('keydown', f); const t = setTimeout(() => ref.current?.querySelector('input')?.focus(), 50)
    const ov = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { removeEventListener('keydown', f); clearTimeout(t); document.body.style.overflow = ov }
  }, [fechar])
  const criar = modo === 'criar'
  const enviar = async e => {
    e.preventDefault(); setErro(''); setInfo(''); setCarregando(true)
    const r = criar
      ? await sb.auth.signUp({ email, password: senha, options: { data: { nome } } })
      : await sb.auth.signInWithPassword({ email, password: senha })
    setCarregando(false)
    if (r.error) return setErro(r.error.message)
    if (criar && !r.data.session) setInfo('Conta criada. Confirme o e-mail que enviamos e depois entre.')
  }
  return (
    <div className="lp-modal" onMouseDown={e => { if (e.target === e.currentTarget) fechar() }}>
      <form ref={ref} onSubmit={enviar} role="dialog" aria-modal="true" aria-label={criar ? 'Criar conta' : 'Entrar'}>
        <button type="button" className="fechar" onClick={fechar} aria-label="Fechar"><Icon n="x" s={18} /></button>
        <Marca />
        <h2>{criar ? 'Crie sua conta' : 'Entre na sua conta'}</h2>
        <p className="sub">{criar ? 'Leva menos de um minuto.' : 'Bem-vindo de volta.'}</p>
        {criar && <label className="campo"><span>Nome</span><input type="text" autoComplete="name" value={nome} onChange={e => setNome(e.target.value)} /></label>}
        <label className="campo"><span>E-mail</span><input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label className="campo"><span>Senha</span><input type="password" required minLength={8} autoComplete={criar ? 'new-password' : 'current-password'} value={senha} onChange={e => setSenha(e.target.value)} />{criar && <small>Mínimo de 8 caracteres.</small>}</label>
        {erro && <Aviso tom="err" role="alert">{erro}</Aviso>}
        {info && <Aviso tom="ok" role="status">{info}</Aviso>}
        <button className="btn cheio" style={{ height: 46 }} disabled={carregando}>{carregando && <Icon n="spinner" className="giro" />}{criar ? 'Criar conta' : 'Entrar'}</button>
        <p className="priv"><Icon n="lock" s={14} />Seu vídeo fica no seu computador. Nunca pedimos a senha do Instagram.</p>
        <p className="troca">{criar ? 'Já tem conta?' : 'Ainda não tem conta?'}<button type="button" onClick={() => { setModo(criar ? 'entrar' : 'criar') }}>{criar ? 'Entrar' : 'Criar conta'}</button></p>
      </form>
    </div>
  )
}

const RECURSOS = [
  ['film', 'Edição pronta a partir de um pedido', 'Envie o Reel, uma referência e o áudio. A plataforma monta cortes, legendas e motions e entrega um MP4 vertical.', 'g'],
  ['layers', 'Biblioteca de estilos', 'Escolha um estilo da biblioteca ou importe os seus prompts de motion e reutilize quando quiser.', 'g'],
  ['monitor', 'Interface animada (VSL)', 'Corte pelo som, telas animadas e legendas dinâmicas, com o render rodando no seu computador.'],
  ['upload', 'Referência de Reel', 'Aponte um Reel que você admira e peça uma edição no mesmo ritmo.'],
  ['clock', 'Acompanhe cada etapa', 'Pedido, plano, render e MP4 com andamento em tempo real e ajustes depois de pronto.'],
]
const PASSOS = [
  ['Envie o seu Reel', 'Escolha o vídeo no computador, cole a referência, defina o áudio e o estilo da edição.'],
  ['Receba o plano de edição', 'A plataforma analisa o pedido e monta cortes, legendas e animações. Você acompanha tudo e pede ajustes.'],
  ['Baixe o MP4 final', 'O render roda no seu computador e o arquivo volta direto para a sua pasta, pronto para postar.'],
]
const SEGURANCA = [
  ['Seu vídeo não sai do seu computador', 'O arquivo original e o Reel pronto ficam na sua pasta. Só o texto do pedido e o andamento passam pela plataforma.'],
  ['Cada conta vê só o que é seu', 'Projetos, pedidos e créditos são isolados por conta, com regras de acesso aplicadas no banco de dados.'],
  ['Sem senha do Instagram', 'Nunca pedimos login de redes sociais. Você posta o MP4 onde e quando quiser.'],
  ['Conexão protegida', 'Todo o tráfego entre o navegador e a plataforma usa HTTPS.'],
]

function Landing() {
  const [modo, setModo] = useState(null)
  const abrir = m => () => setModo(m)
  const fechar = useCallback(() => setModo(null), [])
  const ano = new Date().getFullYear()
  return (
    <div className="lp">
      <div className="lp-aviso">Novo: estilo Interface animada (VSL) disponível.<a href="#recursos">Saiba mais</a></div>
      <nav className="lp-nav" aria-label="Principal">
        <div className="in">
          <Marca />
          <div className="lp-links">
            <a href="#recursos">Produto</a><a href="#como">Como funciona</a><a href="#seguranca">Segurança</a><a href="#comece">Preços</a>
          </div>
          <div className="lp-dir">
            <button className="txt" onClick={abrir('entrar')}>Entrar</button>
            <button className="btn" onClick={abrir('criar')}>Comece já</button>
          </div>
        </div>
      </nav>
      <header className="lp-hero">
        <div className="lp-faixa" aria-hidden="true" /><div className="lp-faixa b" aria-hidden="true" />
        <div className="lp-wrap">
          <div>
            <h1>Edição de Reels <em>profissional</em>, com o seu vídeo sempre no seu computador.</h1>
            <p className="sub">Envie o Reel, a referência e o áudio. A plataforma monta a edição, o render roda na sua máquina e o MP4 final volta para a sua pasta.</p>
            <div className="lp-cta">
              <button className="btn" onClick={abrir('criar')}>Comece já<Icon n="chevron" s={16} /></button>
              <a className="btn sec" href="#como">Ver como funciona</a>
            </div>
            <div className="lp-nota"><span><Icon n="shieldCheck" s={16} />Vídeo só no seu computador</span><span><Icon n="shieldCheck" s={16} />Sem senha do Instagram</span></div>
          </div>
          <div className="lp-prod" aria-hidden="true">
            <div className="lp-fone"><div className="onda" /><div className="leg">Seu <mark>Reel</mark>,<br />editado.</div><Barras estados={['ok', 'ok', 'run', 'wait']} /></div>
            <div className="lp-card a">
              <h4>Pedido #1042<Chip tom="run">Em andamento</Chip></h4>
              <ul>
                <li className="ok"><Icon n="circleCheck" s={18} />Pedido recebido<small>00:02</small></li>
                <li className="ok"><Icon n="circleCheck" s={18} />Plano de edição<small>00:41</small></li>
                <li className="run"><Icon n="spinner" s={18} className="giro" />Render no seu computador<small>68%</small></li>
                <li className="wait"><Icon n="circle" s={18} />MP4 na sua pasta</li>
              </ul>
            </div>
            <div className="lp-card b"><span className="ic"><Icon n="lock" s={18} /></span><div><b>Arquivo local</b><span>Nada de upload do vídeo</span></div></div>
          </div>
        </div>
      </header>
      <div className="lp-faixa-cap"><div className="lp-wrap">
        <span><Icon n="check" s={16} />Cortes automáticos</span><span><Icon n="check" s={16} />Legendas e motions</span><span><Icon n="check" s={16} />MP4 vertical 9:16</span><span><Icon n="check" s={16} />Render local</span><span><Icon n="check" s={16} />Ajustes depois de pronto</span>
      </div></div>
      <section className="lp-sec" id="recursos"><div className="lp-wrap">
        <span className="lp-eyebrow">Produto</span>
        <h2>Tudo o que você precisa para editar Reels em escala</h2>
        <p className="lead">Do pedido ao arquivo final, cada etapa acontece num só lugar, com a privacidade de manter o vídeo na sua máquina.</p>
        <div className="lp-bento">{RECURSOS.map(([ic, t, d, g]) => <article key={t} className={'lp-tile' + (g ? ' g' : '')}><span className="ic"><Icon n={ic} s={20} /></span><h3>{t}</h3><p>{d}</p></article>)}</div>
      </div></section>
      <section className="lp-sec cinza" id="como"><div className="lp-wrap">
        <span className="lp-eyebrow">Como funciona</span>
        <h2>Do pedido ao MP4 em três passos</h2>
        <ol className="lp-passos">{PASSOS.map(([t, d]) => <li key={t}><h3>{t}</h3><p>{d}</p></li>)}</ol>
      </div></section>
      <section className="lp-sec lp-seg" id="seguranca"><div className="lp-wrap">
        <span className="lp-eyebrow">Segurança</span>
        <h2>Feita para proteger o seu conteúdo</h2>
        <p className="lead">Seu material é o seu ativo. Por isso a plataforma foi desenhada para que ele nunca saia do seu controle.</p>
        <div className="lp-seg-grid">{SEGURANCA.map(([t, d]) => <article key={t} className="lp-seg-item"><span className="ic"><Icon n="shieldCheck" s={20} /></span><div><h3>{t}</h3><p>{d}</p></div></article>)}</div>
      </div></section>
      <section className="lp-sec" id="comece"><div className="lp-wrap">
        <span className="lp-eyebrow">Preços</span>
        <h2>Pague só pelo que usar</h2>
        <p className="lead">Cada edição consome créditos. Você vê o custo antes de enviar e, se algo falhar, os créditos voltam para a sua conta.</p>
        <div className="lp-nums" style={{ marginTop: 40 }}>
          <div className="lp-num"><b>0</b><span>vídeos enviados para a nuvem: o render e os arquivos ficam com você.</span></div>
          <div className="lp-num"><b>4</b><span>etapas acompanhadas em tempo real, do pedido ao MP4.</span></div>
          <div className="lp-num"><b>9:16</b><span>MP4 vertical pronto para Reels, Shorts e TikTok.</span></div>
        </div>
      </div></section>
      <section className="lp-fim"><div className="lp-wrap">
        <h2>Tudo pronto para começar?</h2>
        <p>Crie sua conta e envie o primeiro Reel hoje.</p>
        <div className="lp-cta"><button className="btn" onClick={abrir('criar')}>Comece já</button><button className="btn sec" onClick={abrir('entrar')}>Entrar</button></div>
      </div></section>
      <footer className="lp-rodape"><div className="lp-wrap">
        <div className="cols">
          <div><Marca /><p style={{ marginTop: 12, maxWidth: '30ch' }}>Edição de Reels com o seu vídeo sempre no seu computador.</p></div>
          <div><h5>Produto</h5><ul><li><a href="#recursos">Recursos</a></li><li><a href="#como">Como funciona</a></li><li><a href="#comece">Preços</a></li></ul></div>
          <div><h5>Segurança</h5><ul><li><a href="#seguranca">Privacidade</a></li><li><a href="#seguranca">Proteção de dados</a></li></ul></div>
          <div><h5>Conta</h5><ul><li><button className="txt-link" onClick={abrir('entrar')}>Entrar</button></li><li><button className="txt-link" onClick={abrir('criar')}>Criar conta</button></li></ul></div>
        </div>
        <div className="fim"><span>© {ano} {MARCA}</span><span>Brasil (Português)</span></div>
      </div></footer>
      {modo && <Acesso modo={modo} setModo={setModo} fechar={fechar} />}
    </div>
  )
}

/* ---------- estrutura ---------- */
function Layout({ hash, children, chave }) {
  const [saldo, setSaldo] = useState(null), [agente, setAgente] = useState(null), [email, setEmail] = useState('')
  const atualizar = useCallback(async () => {
    const [s, a] = await Promise.all([sb.rpc('saldo'), pingAgente()])
    setSaldo(s.data); setAgente(a)
  }, [])
  useEffect(() => { atualizar(); const t = setInterval(atualizar, 10000); return () => clearInterval(t) }, [atualizar, hash])
  useEffect(() => { sb.auth.getUser().then(r => setEmail(r.data?.user?.email || '')) }, [])
  const itens = [['#/', 'Reels'], ['#/estilos', 'Estilos'], ['#/creditos', 'Créditos'], ['#/agente', 'Agente local']]
  const ativo = h => h === '#/' ? (hash === '#/' || hash.startsWith('#/projeto')) : hash.startsWith(h)
  return (
    <div className="app">
      <header className="topo">
        <Marca link />
        <nav className="nav" aria-label="Principal">
          {itens.map(([h, t]) => <a key={h} href={h} className={ativo(h) ? 'on' : ''} aria-current={ativo(h) ? 'page' : undefined}>{t}</a>)}
        </nav>
        <div className="dir">
          <a className="saldo" href="#/creditos" aria-label={'Saldo: ' + (saldo ?? 'carregando') + ' créditos'}><b>{saldo ?? '–'}</b> créditos</a>
          <a className="agente-st" href="#/agente"><span className={'ponto ' + (agente ? 'on' : 'off')} /><span>{agente ? 'Agente online' : 'Agente offline'}</span></a>
          <button className="sair" title={email} onClick={() => sb.auth.signOut()} aria-label={'Sair' + (email ? ' (' + email + ')' : '')}><Icon n="logout" s={16} /></button>
          <a className="btn escuro" href="#/novo" style={{ height: 36 }}><Icon n="plus" s={16} />Novo Reel</a>
        </div>
      </header>
      <main><div className="pagina" key={chave}>{children}</div></main>
    </div>
  )
}

/* ---------- Reels ---------- */
const ABAS = [['todos', 'Todos'], ['andamento', 'Em andamento'], ['pronto', 'Prontos'], ['erro', 'Com problema']]

function Projetos() {
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
        <a className="btn" href="#/novo"><Icon n="plus" />Novo Reel</a>
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
                <a className="linha" href={'#/projeto/' + p.id}>
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

/* ---------- novo Reel ---------- */
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

function Novo() {
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
    [!!agente, 'Agente aberto neste computador', 'Abra o agente neste computador', '#/agente'],
    ...(audio === 'outro' ? [[!!audioArq, 'Áudio escolhido', 'Escolha o arquivo de áudio']] : []),
    ...(escolhido?.motor === 'vsl' ? [[audio !== 'outro', 'Voz do próprio vídeo', 'O estilo animado não aceita outro áudio']] : []),
    [pronto && saldo >= custo, 'Créditos suficientes', `Faltam créditos: o pedido custa ${custo} e você tem ${saldo}`, '#/creditos'],
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
      location.hash = '#/projeto/' + p.id
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
          {pronto && !agente && <Aviso tom="warn">O agente não está aberto neste computador, então o vídeo não tem onde ficar guardado. <a href="#/agente">Como instalar</a></Aviso>}
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

/* ---------- edição ---------- */
function Edicao({ id }) {
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
  if (naoAchou) return <><Cab titulo="Reel não encontrado" /><div className="corpo"><div className="vazio"><p>Este Reel não existe ou não é seu.</p><a className="btn sec" href="#/">Voltar para os Reels</a></div></div></>
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
            {ped.status === 'fila' && (agente ? <Aviso tom="ok" role="status">Na fila: o agente vai começar já.</Aviso> : <Aviso tom="warn" role="status">Aguardando o agente. Abra-o neste computador. <a href="#/agente">Como abrir</a></Aviso>)}
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

/* ---------- estilos ---------- */
const TIPOS = { reel: 'Reel', cartoon3d: 'Cartoon 3D' }

function Estilos() {
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

/* ---------- créditos ---------- */
const ACOES = { roteiro_ia: 'Roteiro com IA', locucao_ia: 'Locução com IA', edicao_reel: 'Edição de um Reel', edicao_vsl: 'Edição animada (interface VSL)', cartoon_3d: 'Cartoon 3D narrado', ajuste: 'Ajuste depois de pronto', boas_vindas: 'Créditos de boas-vindas', reembolso_erro: 'Reembolso por erro' }

function Creditos() {
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

/* ---------- agente local ---------- */
function Agente() {
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
        <li><div><span>Baixe o agente e descompacte.</span><div><a className="btn sec peq" href="./agente.tgz" download><Icon n="download" s={14} />Baixar o agente</a></div>{cmd('tar -xzf agente.tgz')}</div></li>
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

/* ---------- raiz ---------- */
export default function App() {
  const [sessao, setSessao] = useState(undefined)
  const hash = useHash()
  useEffect(() => {
    sb.auth.getSession().then(r => setSessao(r.data.session))
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSessao(s))
    return () => data.subscription.unsubscribe()
  }, [])
  if (sessao === undefined) return <div style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh' }}><div style={{ width: 120 }}><Barras estados={['run', 'run', 'run', 'run']} /></div></div>
  if (!sessao) return <Landing />
  const m = hash.match(/^#\/projeto\/([0-9a-f-]{36})$/)
  let tela = <Projetos />, chave = 'reels'
  if (hash.startsWith('#/novo')) { tela = <Novo />; chave = 'novo' }
  else if (m) { tela = <Edicao key={m[1]} id={m[1]} />; chave = m[1] }
  else if (hash.startsWith('#/estilos')) { tela = <Estilos />; chave = 'estilos' }
  else if (hash.startsWith('#/creditos')) { tela = <Creditos />; chave = 'creditos' }
  else if (hash.startsWith('#/agente')) { tela = <Agente />; chave = 'agente' }
  return <Layout hash={hash} chave={chave}>{tela}</Layout>
}
