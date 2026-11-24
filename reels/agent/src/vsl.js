// Motor "Interface animada (VSL)" — roda no computador da pessoa.
// Usa a skill-reel (github.com/Felpborges/skill-reel) numa versão fixa: corte pelo som + composição HTML/GSAP
// renderizada no Chrome (HyperFrames). A nuvem só decide O QUE cortar e O QUE desenhar (planejar-reel);
// o vídeo nunca sai daqui.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, execFile } from 'node:child_process'
import { temComando, sondar } from './render.js'

export const SKILL_REPO = 'Felpborges/skill-reel'
export const SKILL_COMMIT = 'b9c1222297ce8ff8d15f19f5218afc08cab279bf'
const MAX_TENTATIVAS = 3

const PY = () => process.env.VSL_PYTHON || (process.platform === 'win32' ? 'python' : 'python3')
const WIN = process.platform === 'win32'

// ---------- utilidades ----------
const sh = (cmd, args, { cwd, env, log, aoLinha, timeout } = {}) => new Promise((ok, falha) => {
  const p = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, shell: WIN && /\.(cmd|bat)$|^npx$|^npm$/.test(cmd) })
  let saida = ''
  const rec = d => {
    const t = d.toString(); saida += t
    if (saida.length > 400000) saida = saida.slice(-200000)
    if (aoLinha) t.split(/\r?\n|\r/).forEach(l => l.trim() && aoLinha(l))
    else if (log) t.split(/\r?\n/).forEach(l => l.trim() && log('  ' + l.slice(0, 300)))
  }
  p.stdout.on('data', rec); p.stderr.on('data', rec)
  const t = timeout ? setTimeout(() => { p.kill('SIGKILL'); saida += '\n[tempo esgotado]' }, timeout) : null
  p.on('error', e => { t && clearTimeout(t); falha(Object.assign(e, { saida })) })
  p.on('close', code => { t && clearTimeout(t); code === 0 ? ok(saida) : falha(Object.assign(new Error(`${cmd} ${args.slice(0, 2).join(' ')} saiu com código ${code}`), { saida, code })) })
})
const execp = (cmd, args, opts = {}) => new Promise(ok => execFile(cmd, args, { maxBuffer: 16 * 1024 * 1024, ...opts }, (e, out, err) => ok({ e, out: String(out || ''), err: String(err || '') })))
const lerJson = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return d } }
const ultimasLinhas = (s, n = 25) => String(s || '').split(/\r?\n/).filter(Boolean).slice(-n).join('\n')

export function acharChrome() {
  if (process.env.CHROME && fs.existsSync(process.env.CHROME)) return process.env.CHROME
  const c = process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium']
    : WIN
      ? [process.env['PROGRAMFILES'] + '\\Google\\Chrome\\Application\\chrome.exe', process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe', process.env['LOCALAPPDATA'] + '\\Google\\Chrome\\Application\\chrome.exe']
      : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  return c.find(p => p && fs.existsSync(p)) || null
}

function acharModeloWhisper() {
  const m = process.env.WHISPER_MODEL
  const c = [m, '~/.cache/whisper-cpp/ggml-large-v3-turbo.bin', '~/.cache/whisper.cpp/ggml-large-v3-turbo.bin', '~/whisper.cpp/models/ggml-large-v3-turbo.bin']
  return c.filter(Boolean).map(p => p.replace(/^~/, os.homedir())).find(p => fs.existsSync(p)) || null
}

// ---------- máquina ----------
// Devolve a lista do que falta (vazia = pronta). Cada item já diz como resolver.
export async function checarMaquina() {
  const falta = []
  if (!(await temComando('ffmpeg'))) falta.push('ffmpeg (Mac: brew install ffmpeg · Windows: winget install Gyan.FFmpeg)')
  if (!(await temComando('whisper-cli')) && !(await temComando('whisper-cpp'))) falta.push('whisper-cli (Mac: brew install whisper-cpp)')
  if (!acharModeloWhisper()) falta.push('modelo do Whisper ggml-large-v3-turbo.bin em ~/.cache/whisper-cpp/ (ou variável WHISPER_MODEL)')
  const py = await execp(PY(), ['-c', 'import numpy, cv2'])
  if (py.e) falta.push(`Python com numpy e opencv (${PY()} -m pip install numpy opencv-python) — ou defina VSL_PYTHON`)
  if (!acharChrome()) falta.push('Google Chrome instalado (ou variável CHROME com o caminho)')
  const node = Number(process.versions.node.split('.')[0])
  if (node < 20) falta.push('Node 20 ou mais novo')
  if (WIN && !(await temComando('bash'))) falta.push('bash (no Windows, instale o Git for Windows)')
  return falta
}

// ---------- skill (versão fixa) ----------
export async function garantirSkill(base, log) {
  const dir = path.join(base, 'skill-reel', SKILL_COMMIT)
  if (fs.existsSync(path.join(dir, 'modelo', 'montar.mjs'))) return dir
  log('Baixando o motor de edição (uma vez só)…')
  fs.mkdirSync(dir, { recursive: true })
  const url = `https://codeload.github.com/${SKILL_REPO}/tar.gz/${SKILL_COMMIT}`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Não consegui baixar o motor de edição (${r.status}).`)
  const tgz = path.join(dir, '_skill.tgz')
  fs.writeFileSync(tgz, Buffer.from(await r.arrayBuffer()))
  await sh('tar', ['-xzf', tgz, '-C', dir, '--strip-components=1'])
  fs.rmSync(tgz, { force: true })
  if (!fs.existsSync(path.join(dir, 'modelo', 'montar.mjs'))) throw new Error('O motor de edição baixado está incompleto.')
  return dir
}

// ---------- medidas do rosto → vsl.json ----------
const mediana = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0 }
function medirRosto(motor, log) {
  const ft = lerJson(path.join(motor, 'assets', 'face-track.json'))
  const quadros = Array.isArray(ft) ? ft : ft?.frames
  if (!quadros?.length) return null
  // [t, bocaX, bocaY, larguraBoca, queixoY, testaY, rostoX0, rostoX1]
  const col = i => quadros.map(q => Number(q[i])).filter(Number.isFinite)
  const queixo = mediana(col(4)), testa = mediana(col(5)), x0 = mediana(col(6)), x1 = mediana(col(7))
  const alt = queixo - testa
  if (!(alt > 80) || !(x1 > x0)) return null
  const y = Math.max(0, Math.round(testa - alt * 0.3)) // folga para o cabelo
  const h = Math.round(queixo - y + alt * 0.1)
  const medidas = { face: { x: Math.round(x0), y, w: Math.round(x1 - x0), h }, head: { x: Math.round((x0 + x1) / 2), y: Math.round(testa + alt * 0.5) } }
  log(`Rosto medido: ${JSON.stringify(medidas.face)}`)
  return medidas
}

function gravarVslJson(motor, medidas) {
  const arq = path.join(motor, 'vsl.json')
  const base = lerJson(arq) || lerJson(path.join(motor, 'vsl-padrao.json'), {})
  if (medidas) { base.face = medidas.face; base.head = medidas.head }
  fs.writeFileSync(arq, JSON.stringify(base, null, 2))
}

// ---------- principal ----------
// ctx: { sb, ped, dirP, video, avancar, log }
export async function processarVsl({ sb, ped, dirP, video, avancar, log }) {
  const base = path.join(os.homedir(), '.estudio-reels')
  const falta = await checarMaquina()
  if (falta.length) throw new Error('Para o estilo "Interface animada (VSL)" faltam neste computador:\n- ' + falta.join('\n- '))
  if (ped.audio_modo === 'outro') throw new Error('O estilo "Interface animada (VSL)" usa a voz do próprio vídeo. Envie sem áudio extra.')

  const skill = await garantirSkill(base, log)
  const chrome = acharChrome()
  const modelo = acharModeloWhisper()
  const env = { CHROME: chrome, WHISPER_MODEL: modelo, VSL_PYTHON: PY(), npm_config_onnxruntime_node_install_cuda: 'skip', PYTHONIOENCODING: 'utf-8' }
  const P = path.join(dirP, 'vsl')
  const corte = path.join(P, 'corte')
  const motor = path.join(P, 'motor')
  fs.mkdirSync(P, { recursive: true })
  const scripts = path.join(skill, 'corte', 'scripts')
  const py = (script, args, o = {}) => sh(PY(), [path.join(scripts, script), ...args], { env, log, ...o })

  const marca = path.join(P, '.pedido')
  const mesmoPedido = fs.existsSync(marca) && fs.readFileSync(marca, 'utf8') === ped.id
  const temCorte = mesmoPedido && fs.existsSync(path.join(corte, 'clean.mp4')) && fs.existsSync(path.join(corte, 'cortepalavras.json')) && lerJson(path.join(corte, 'keeps.json'))
  let keeps = null

  // ===== 1. corte pelo som =====
  if (temCorte) {
    log('Reaproveitando o corte já feito (ajuste).')
    keeps = lerJson(path.join(corte, 'keeps.json')).keeps
    await avancar('em_andamento', 'plano', 40)
  } else {
    fs.rmSync(corte, { recursive: true, force: true }); fs.rmSync(motor, { recursive: true, force: true })
    fs.mkdirSync(corte, { recursive: true })
    const { duracao } = await sondar(video)
    await avancar('em_andamento', 'entendeu', 15)
    log('Mapeando as falas do vídeo…')
    await py('1-tomadas.py', [video, corte], { timeout: 40 * 60 * 1000 })
    const tomadas = fs.readFileSync(path.join(corte, 'tomadas.txt'), 'utf8')

    await avancar('em_andamento', 'plano', 30)
    const { data, error } = await sb.functions.invoke('planejar-reel', { body: { pedido_id: ped.id, etapa: 'keeps', contexto: { tomadas, duracao_bruto_s: duracao } } })
    if (error || data?.erro) throw new Error('Falha ao decidir os cortes: ' + (data?.erro || error?.message) + (data?.detalhes ? ' — ' + [].concat(data.detalhes).join('; ') : ''))
    keeps = data.keeps
    fs.writeFileSync(path.join(corte, 'keeps.json'), JSON.stringify({ keeps }, null, 1))

    await avancar('em_andamento', 'plano', 40)
    log('Cortando pelo som e tirando os vícios…')
    await py('2-vicios.py', [corte], { timeout: 30 * 60 * 1000 })
    await py('3-corte.py', [video, corte], { timeout: 30 * 60 * 1000 })
    await py('4-conferir.py', [corte], { timeout: 30 * 60 * 1000 })
    fs.writeFileSync(marca, ped.id)
  }

  // ===== 2. motor de composição =====
  await avancar('em_andamento', 'plano', 50)
  if (!fs.existsSync(path.join(motor, 'montar.mjs'))) {
    fs.cpSync(path.join(skill, 'modelo'), motor, { recursive: true })
    log('Preparando a composição (1ª vez demora: instala o HyperFrames)…')
    try { await sh('bash', ['preparar.sh'], { cwd: motor, env, log, timeout: 40 * 60 * 1000 }) }
    catch (e) {
      // a "primeira montagem" do preparar.sh pode falhar sem beats; o que importa é o preparo ter gerado os arquivos
      if (!fs.existsSync(path.join(motor, 'assets', 'transcript.json')) || !fs.existsSync(path.join(motor, 'node_modules'))) throw new Error('Falha ao preparar a composição:\n' + ultimasLinhas(e.saida))
    }
    await sh('npx', ['--no-install', 'hyperframes', 'telemetry', 'disable'], { cwd: motor, env }).catch(() => {})
  }
  const tr = lerJson(path.join(motor, 'assets', 'transcript.json'))
  if (!tr?.words?.length) throw new Error('Não encontrei fala no vídeo cortado.')
  gravarVslJson(motor, medirRosto(motor, log))

  // ===== 3. roteiro visual (nuvem) + montagem, com retentativa =====
  const arqBeats = path.join(motor, 'src', 'beats.js')
  const marcaBeats = path.join(P, '.beats-ia')
  // ajuste do mesmo pedido: a IA parte do roteiro visual anterior (só o que foi pedido muda)
  let anterior = temCorte && fs.existsSync(marcaBeats) && fs.existsSync(arqBeats) ? fs.readFileSync(arqBeats, 'utf8') : ''
  let palavras = tr.words
  let ultimoErro = ''
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    await avancar('em_andamento', 'plano', 55)
    log(`Desenhando as telas animadas (tentativa ${tentativa})…`)
    const ctxAnterior = ultimoErro ? `${anterior}\n// ERROS DA MONTAGEM ANTERIOR — corrija:\n${ultimoErro.split('\n').map(l => '// ' + l).join('\n')}` : anterior
    const { data, error } = await sb.functions.invoke('planejar-reel', {
      body: { pedido_id: ped.id, etapa: 'beats', contexto: { palavras, duracao_s: tr.audio_duration_secs, keeps, ...(ctxAnterior ? { beats_anterior: ctxAnterior } : {}) } },
    })
    if (error || data?.erro) throw new Error('Falha ao desenhar as telas: ' + (data?.erro || error?.message) + (data?.detalhes ? ' — ' + [].concat(data.detalhes).join('; ') : ''))
    if (Array.isArray(data.palavras) && data.palavras.length) {
      palavras = data.palavras
      fs.writeFileSync(path.join(motor, 'assets', 'transcript.json'), JSON.stringify({ ...tr, words: palavras }))
    }
    fs.writeFileSync(arqBeats, data.beats_js)
    fs.writeFileSync(marcaBeats, '1')
    anterior = data.beats_js

    try {
      await sh('node', ['montar.mjs'], { cwd: motor, env, log })
      await sh('npx', ['--no-install', 'hyperframes', 'lint'], { cwd: motor, env, log })
      await sh('node', ['ferramentas/zona-segura-dom.mjs', '.', '--strict'], { cwd: motor, env, log })
      ultimoErro = ''
      break
    } catch (e) {
      ultimoErro = ultimasLinhas(e.saida || e.message, 30)
      log(`Montagem recusada (tentativa ${tentativa}): ${ultimoErro.split('\n').slice(-3).join(' | ')}`)
      if (tentativa === MAX_TENTATIVAS) throw new Error('A composição não passou nas verificações:\n' + ultimoErro)
    }
  }

  // ===== 4. render =====
  await avancar('em_andamento', 'render', 60)
  const renderDir = path.join(P, 'render'); fs.mkdirSync(renderDir, { recursive: true })
  const bruto = path.join(renderDir, '_reel-bruto.mp4')
  const final = path.join(renderDir, `reel-${ped.id}.mp4`)
  log('Renderizando o vídeo (leva alguns minutos)…')
  let ultimo = 60
  await sh('npx', ['--no-install', 'hyperframes', 'render', '-q', 'high', '-o', bruto], {
    cwd: motor, env, timeout: 90 * 60 * 1000,
    aoLinha: l => {
      const m = l.match(/(\d{1,3})\s*%/)
      if (m) { const v = 60 + Math.round(Math.min(100, +m[1]) * 0.3); if (v - ultimo >= 3) { ultimo = v; avancar('em_andamento', 'render', v) } }
    },
  })

  await avancar('em_andamento', 'render', 92)
  log('Ajustando o volume final (−14 LUFS)…')
  await sh('bash', ['ferramentas/audio-final-vsl.sh', bruto, final], { cwd: motor, env, log })

  // conferência do skill — informativa (os itens que só o olho confere ficam no VERIFY.md)
  try { await sh(PY(), [path.join(skill, 'ferramentas', 'verificar.py'), P, '--video', path.relative(P, final)], { cwd: P, env, log }) }
  catch (e) { log('Conferência final apontou itens para olhar (veja vsl/VERIFY.md).') }

  const saida = path.join(dirP, `${ped.id}.mp4`)
  fs.copyFileSync(final, saida)
  return saida
}
