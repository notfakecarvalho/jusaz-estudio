import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { PORTA, VERSAO, pastaBase, origensPermitidas } from './config.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EXT_VIDEO = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv'])
const EXT_AUDIO = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg'])
const LIMITE = 4 * 1024 * 1024 * 1024

function cors(req, res, restrito) {
  const o = req.headers.origin
  const ok = o && origensPermitidas().includes(o)
  if (ok) res.setHeader('Access-Control-Allow-Origin', o)
  else if (!restrito) res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Private-Network', 'true')
  res.setHeader('Vary', 'Origin')
  return ok
}
const json = (res, st, obj) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)) }

export function iniciarServidor(nome) {
  const srv = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1')
    const partes = u.pathname.split('/').filter(Boolean)
    try {
      if (req.method === 'OPTIONS') { cors(req, res, false); res.writeHead(204); return res.end() }

      if (u.pathname === '/ping') {
        cors(req, res, false)
        return json(res, 200, { ok: true, versao: VERSAO, nome, pasta: pastaBase() })
      }

      // Enviar arquivo para a pasta do projeto (só origens permitidas)
      if (req.method === 'POST' && partes[0] === 'arquivos' && UUID.test(partes[1] || '')) {
        if (!cors(req, res, true)) return json(res, 403, { erro: 'origem_nao_permitida' })
        const tipo = u.searchParams.get('tipo') === 'audio' ? 'audio' : 'original'
        const ext = path.extname(u.searchParams.get('nome') || '').toLowerCase()
        const permitidas = tipo === 'audio' ? EXT_AUDIO : EXT_VIDEO
        if (!permitidas.has(ext)) return json(res, 400, { erro: 'tipo_de_arquivo_nao_aceito' })
        const tam = Number(req.headers['content-length'] || 0)
        if (tam > LIMITE) return json(res, 413, { erro: 'arquivo_grande_demais' })
        const dir = path.join(pastaBase(), partes[1])
        fs.mkdirSync(dir, { recursive: true })
        for (const f of fs.readdirSync(dir)) if (f.startsWith(tipo + '.')) fs.unlinkSync(path.join(dir, f))
        const destino = path.join(dir, tipo + ext)
        await new Promise((ok, falha) => {
          const w = fs.createWriteStream(destino)
          req.pipe(w); w.on('finish', ok); w.on('error', falha); req.on('error', falha)
        })
        return json(res, 200, { ok: true })
      }

      // Abrir a pasta do projeto no Finder/Explorer
      if (req.method === 'POST' && partes[0] === 'abrir' && UUID.test(partes[1] || '')) {
        if (!cors(req, res, true)) return json(res, 403, { erro: 'origem_nao_permitida' })
        const dir = path.join(pastaBase(), partes[1])
        if (!fs.existsSync(dir)) return json(res, 404, { erro: 'pasta_nao_existe' })
        const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open'
        spawn(cmd, [dir], { detached: true, stdio: 'ignore' }).unref()
        return json(res, 200, { ok: true })
      }

      // Servir o MP4 pronto (id do pedido é um UUID impossível de adivinhar)
      if (req.method === 'GET' && partes[0] === 'video' && partes[1]?.endsWith('.mp4')) {
        const id = partes[1].slice(0, -4)
        if (!UUID.test(id)) return json(res, 400, { erro: 'id_invalido' })
        const arq = achar(pastaBase(), id + '.mp4')
        if (!arq) return json(res, 404, { erro: 'nao_encontrado' })
        cors(req, res, false)
        const st = fs.statSync(arq)
        const h = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes' }
        if (u.searchParams.get('baixar')) h['Content-Disposition'] = `attachment; filename="reel-${id.slice(0, 8)}.mp4"`
        const r = req.headers.range
        if (r) {
          const m = /bytes=(\d*)-(\d*)/.exec(r)
          const ini = m[1] ? parseInt(m[1], 10) : 0
          const fim = m[2] ? parseInt(m[2], 10) : st.size - 1
          res.writeHead(206, { ...h, 'Content-Range': `bytes ${ini}-${fim}/${st.size}`, 'Content-Length': fim - ini + 1 })
          return fs.createReadStream(arq, { start: ini, end: fim }).pipe(res)
        }
        res.writeHead(200, { ...h, 'Content-Length': st.size })
        return fs.createReadStream(arq).pipe(res)
      }

      json(res, 404, { erro: 'rota_desconhecida' })
    } catch (e) {
      if (!res.headersSent) json(res, 500, { erro: 'erro_interno' })
    }
  })
  srv.listen(PORTA, '127.0.0.1', () => console.log(`Agente ouvindo em http://127.0.0.1:${PORTA}`))
  return srv
}

// procura <id>.mp4 dentro das pastas de projeto (um nível)
function achar(base, arquivo) {
  for (const d of fs.readdirSync(base)) {
    const p = path.join(base, d, arquivo)
    if (fs.existsSync(p)) return p
  }
  return null
}
