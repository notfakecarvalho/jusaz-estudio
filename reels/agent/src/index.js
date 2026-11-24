import os from 'node:os'
import readline from 'node:readline'
import { createClient } from '@supabase/supabase-js'
import { checarMaquina } from './vsl.js'
import { SUPABASE_URL, SUPABASE_KEY, VERSAO, lerConfig, salvarConfig, pastaBase } from './config.js'
import { iniciarServidor } from './server.js'
import { processar } from './jobs.js'
import { temComando } from './render.js'

function perguntar(q, oculto = false) {
  return new Promise(res => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    if (oculto) rl._writeToOutput = s => { rl.output.write(s.includes(q) ? s : '*') }
    rl.question(q, a => { rl.close(); if (oculto) process.stdout.write('\n'); res(a.trim()) })
  })
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: true } })
sb.auth.onAuthStateChange((_ev, s) => { if (s?.refresh_token) salvarConfig({ refresh_token: s.refresh_token }) })

async function entrar() {
  const c = lerConfig()
  if (c.refresh_token) {
    const { data, error } = await sb.auth.refreshSession({ refresh_token: c.refresh_token })
    if (!error && data.session) return data.session.user
    console.log('Sessão expirada. Entre de novo.')
  }
  for (let t = 0; t < 3; t++) {
    const email = await perguntar('E-mail da sua conta: ')
    const senha = await perguntar('Senha: ', true)
    const { data, error } = await sb.auth.signInWithPassword({ email, password: senha })
    if (!error) { salvarConfig({ refresh_token: data.session.refresh_token }); return data.user }
    console.log('Não consegui entrar:', error.message)
  }
  process.exit(1)
}

const user = await entrar()
console.log(`Conectado como ${user.email}`)
if (!(await temComando('ffmpeg'))) console.log('ATENÇÃO: ffmpeg não encontrado. Instale (Mac: brew install ffmpeg) para o render funcionar.')
if (!(await temComando('whisper'))) console.log('Aviso: whisper não encontrado; as legendas palavra por palavra ficam desligadas.')
{
  const falta = await checarMaquina().catch(() => ['(não consegui conferir)'])
  if (falta.length) console.log('Estilo "Interface animada (VSL)" indisponível por enquanto. Falta:\n  - ' + falta.join('\n  - '))
  else console.log('Estilo "Interface animada (VSL)": pronto neste computador.')
}

// registra este computador
const sistema = process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'windows' : 'linux'
let cfg = lerConfig()
if (!cfg.agente_id) {
  const { data, error } = await sb.from('agentes').insert({ nome: os.hostname(), sistema, versao: VERSAO }).select().single()
  if (error) { console.log('Falha ao registrar o computador:', error.message); process.exit(1) }
  cfg = salvarConfig({ agente_id: data.id })
}
const batida = () => sb.from('agentes').update({ visto_em: new Date().toISOString(), versao: VERSAO, nome: os.hostname() }).eq('id', cfg.agente_id)
await batida(); setInterval(batida, 20000)

iniciarServidor(os.hostname())
console.log(`Pasta dos Reels: ${pastaBase()}`)

let ocupado = false
async function ciclo() {
  if (ocupado) return
  const { data } = await sb.from('pedidos').select('*').eq('status', 'fila').order('criado_em').limit(1)
  if (!data?.length) return
  ocupado = true
  try { await processar(sb, data[0]) } finally { ocupado = false }
}
setInterval(() => ciclo().catch(e => console.log('Ciclo:', e.message)), 4000)
console.log('Pronto. Deixe esta janela aberta enquanto edita.')
