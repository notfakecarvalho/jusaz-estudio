import React, { useState } from 'react'

export const MARCA = 'Mira'

const rr = (x, y, w, h, r) => `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 -${r} ${r}h-${w - 2 * r}a${r} ${r} 0 0 1 -${r} -${r}v-${h - 2 * r}a${r} ${r} 0 0 1 ${r} -${r}z`
const ci = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 -${2 * r} 0`

const ICONES = {
  plus: ['M12 5v14M5 12h14'],
  check: ['M20 6 9 17l-5-5'],
  x: ['M18 6 6 18M6 6l12 12'],
  chevron: ['m9 18 6-6-6-6'],
  film: [rr(3, 3, 18, 18, 2), 'M7 3v18M17 3v18M3 7.5h4M3 12h18M3 16.5h4M17 7.5h4M17 16.5h4'],
  layers: ['m12 2 10 5-10 5L2 7z', 'm2 17 10 5 10-5', 'm2 12 10 5 10-5'],
  wallet: ['M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1', 'M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4'],
  monitor: [rr(2, 3, 20, 14, 2), 'M8 21h8M12 17v4'],
  upload: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3'],
  folder: ['M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z'],
  alert: ['m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3', 'M12 9v4M12 17h.01'],
  clock: [ci(12, 12, 10), 'M12 6v6l4 2'],
  send: ['m22 2-7 20-4-9-9-4Z', 'M22 2 11 13'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'],
  copy: [rr(9, 9, 13, 13, 2), 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
  lock: [rr(3, 11, 18, 11, 2), 'M7 11V7a5 5 0 0 1 10 0v4'],
  shield: ['M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z'],
  shieldCheck: ['M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z', 'm9 12 2 2 4-4'],
  cloud: ['M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z'],
  info: [ci(12, 12, 10), 'M12 16v-4M12 8h.01'],
  spinner: ['M21 12a9 9 0 1 1-6.219-8.56'],
  circleCheck: [ci(12, 12, 10), 'm9 12 2 2 4-4'],
  circleX: [ci(12, 12, 10), 'm15 9-6 6M9 9l6 6'],
  circle: [ci(12, 12, 10)],
  refresh: ['M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5'],
  trash: ['M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
}

export function Icon({ n, s = 18, className }) {
  return (
    <svg className={className} width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {ICONES[n].map((d, i) => <path key={i} d={d} />)}
    </svg>
  )
}

export function Logo() {
  return (
    <svg className="logo" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path className="lc" d="M16 2.5 5 6.6v8.2c0 6.6 4.5 11.6 11 14.7 6.5-3.1 11-8.1 11-14.7V6.6z" fill="#635BFF" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M13 11.2v9.6l8-4.8z" fill="#fff" />
    </svg>
  )
}

export function Marca({ link }) {
  const c = <><Logo /><span>{MARCA.toLowerCase()}</span></>
  return link ? <a className="marca" href="#/" style={{ textDecoration: 'none' }} aria-label={MARCA + ', início'}>{c}</a> : <div className="marca">{c}</div>
}

export function Selo({ children, escuro }) {
  return <span className={'selo' + (escuro ? ' escuro' : '')}><Icon n="shieldCheck" s={16} />{children}</span>
}

export function Escudo({ titulo, children }) {
  return <div className="escudo"><Icon n="shieldCheck" s={34} /><div><b>{titulo}</b><span>{children}</span></div></div>
}

export function Barras({ estados, grande }) {
  return (
    <div className={'barras' + (grande ? ' g' : '')} aria-hidden="true">
      {estados.map((e, i) => <div key={i} className={'b ' + e}><i /></div>)}
    </div>
  )
}

export const ETAPAS_CURTO = ['Pedido', 'Plano', 'Render', 'MP4']

export function andamento(ped) {
  const vazio = ['wait', 'wait', 'wait', 'wait']
  if (!ped) return { estados: vazio, tom: 'wait', texto: 'Rascunho', grupo: 'rascunho' }
  const idx = Math.max(0, ['entendeu', 'plano', 'render', 'pronto'].indexOf(ped.etapa))
  if (ped.status === 'concluido') return { estados: ['ok', 'ok', 'ok', 'ok'], tom: 'ok', texto: 'Pronto', grupo: 'pronto' }
  if (ped.status === 'erro') return { estados: vazio.map((_, i) => (i < idx ? 'ok' : i === idx ? 'err' : 'wait')), tom: 'err', texto: 'Parou em ' + ETAPAS_CURTO[idx].toLowerCase(), grupo: 'erro' }
  if (ped.status === 'fila') return { estados: vazio, tom: 'warn', texto: 'Na fila', grupo: 'andamento' }
  return { estados: vazio.map((_, i) => (i < idx ? 'ok' : i === idx ? 'run' : 'wait')), tom: 'run', texto: ETAPAS_CURTO[idx], grupo: 'andamento' }
}

const CHIP_ICONE = { ok: 'circleCheck', run: 'spinner', warn: 'clock', err: 'alert', wait: 'circle' }
export function Chip({ tom = 'wait', semIcone, children }) {
  return <span className={'chip ' + tom} style={semIcone ? { paddingLeft: 9 } : undefined}>{!semIcone && <Icon n={CHIP_ICONE[tom]} s={14} className={tom === 'run' ? 'giro' : ''} />}{children}</span>
}

export function Aviso({ tom = 'info', icone, children, role }) {
  const ic = icone || (tom === 'err' || tom === 'warn' ? 'alert' : tom === 'ok' ? 'circleCheck' : 'info')
  return <div className={'aviso ' + tom} role={role}><Icon n={ic} s={18} /><div>{children}</div></div>
}

export function Copiar({ texto }) {
  const [ok, setOk] = useState(false)
  const f = async () => {
    try { await navigator.clipboard.writeText(texto); setOk(true); setTimeout(() => setOk(false), 1600) } catch { /* sem permissão: o texto continua visível */ }
  }
  return <button type="button" onClick={f} aria-label={'Copiar: ' + texto}><Icon n={ok ? 'check' : 'copy'} s={14} />{ok ? 'Copiado' : 'Copiar'}</button>
}

export const fmtDur = s => { if (s == null) return ''; const t = Math.round(s); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0') }
export const fmtTam = b => (b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : (b / 1e6).toFixed(b >= 1e8 ? 0 : 1) + ' MB')
