import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const SUPABASE_URL = 'https://paifoylplzokkqqzytkk.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_igMagOaJaX_VOW1OxxHoCg_PbLROHfk'
export const PORTA = 47821
export const VERSAO = '0.3.0'

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
  return ['https://jusaz-estudio.vercel.app', 'http://localhost:3000', 'http://127.0.0.1:3000', ...(c.origens || [])]
}
