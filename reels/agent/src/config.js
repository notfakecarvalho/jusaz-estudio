import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const SUPABASE_URL = 'https://owucqvwdznrhqkcoliyh.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_tIWJYdyxAWfLLOpI56a3fg_1VoQaUwM'
export const PORTA = 47821
export const VERSAO = '0.2.0'

const DIR = path.join(os.homedir(), '.estudio-reels')
const ARQ = path.join(DIR, 'config.json')

export function lerConfig() {
  try { return JSON.parse(fs.readFileSync(ARQ, 'utf8')) } catch { return {} }
}
export function salvarConfig(parcial) {
  fs.mkdirSync(DIR, { recursive: true })
  const nova = { ...lerConfig(), ...parcial }
  fs.writeFileSync(ARQ, JSON.stringify(nova, null, 2), { mode: 0o600 })
  return nova
}
export function pastaBase() {
  const c = lerConfig()
  const p = c.pasta || path.join(os.homedir(), 'Reels')
  fs.mkdirSync(p, { recursive: true })
  return p
}
export function origensPermitidas() {
  const c = lerConfig()
  return ['https://2netxje4zyf4.ample.run', 'https://jusaz-estudio.vercel.app', 'http://localhost:5173', 'http://127.0.0.1:5173', ...(c.origens || [])]
}
