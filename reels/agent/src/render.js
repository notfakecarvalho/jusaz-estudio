import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, execFile } from 'node:child_process'

const run = (cmd, args, opts = {}) => new Promise((ok, falha) => {
  execFile(cmd, args, { maxBuffer: 64 * 1024 * 1024, ...opts }, (e, out, err) => e ? falha(Object.assign(e, { stderr: err })) : ok(out))
})

export async function temComando(cmd) {
  try { await run(process.platform === 'win32' ? 'where' : 'which', [cmd]); return true } catch { return false }
}

export async function sondar(arquivo) {
  const out = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', arquivo])
  const j = JSON.parse(out)
  return {
    duracao: Number(j.format?.duration || 0),
    temAudio: (j.streams || []).some(s => s.codec_type === 'audio'),
  }
}

// Transcrição opcional com o whisper local (pip install openai-whisper)
export async function transcrever(video, tmp) {
  if (!(await temComando('whisper'))) return null
  try {
    await run('whisper', [video, '--model', 'base', '--language', 'pt', '--word_timestamps', 'True', '--output_format', 'json', '--output_dir', tmp], { timeout: 20 * 60 * 1000 })
    const base = path.basename(video, path.extname(video))
    const j = JSON.parse(fs.readFileSync(path.join(tmp, base + '.json'), 'utf8'))
    const palavras = []
    for (const s of j.segments || []) for (const w of s.words || []) palavras.push({ p: String(w.word).trim(), i: +w.start.toFixed(2), f: +w.end.toFixed(2) })
    return palavras.length ? palavras : null
  } catch { return null }
}

const FONTES = [
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  'C:/Windows/Fonts/arialbd.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
]
const fonte = () => FONTES.find(f => fs.existsSync(f))

const num = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d
const corAss = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); const h = m ? m[1] : 'FFD60A'; return `&H00${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`.toUpperCase() }
const tempoAss = s => { const t = Math.max(0, s); const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), sec = (t % 60).toFixed(2).padStart(5, '0'); return `${h}:${String(m).padStart(2, '0')}:${sec}` }

// valida e normaliza os cortes do plano
export function normalizarCortes(plano, dur, usarCortes) {
  if (!usarCortes) return [{ inicio: 0, fim: dur }]
  let cs = (plano.cortes || []).map(c => ({ inicio: Math.max(0, num(c.inicio)), fim: Math.min(dur, num(c.fim, dur)) }))
    .filter(c => c.fim - c.inicio >= 0.3).sort((a, b) => a.inicio - b.inicio)
  const lim = []
  for (const c of cs) { const ult = lim[lim.length - 1]; if (ult && c.inicio < ult.fim) c.inicio = ult.fim; if (c.fim - c.inicio >= 0.3) lim.push(c) }
  return lim.length ? lim : [{ inicio: 0, fim: dur }]
}

// tempo do vídeo original -> tempo no vídeo cortado (null se foi cortado fora)
export function mapear(cortes) {
  return t => { let acc = 0; for (const c of cortes) { if (t >= c.inicio && t <= c.fim) return acc + (t - c.inicio); acc += c.fim - c.inicio } return null }
}
const mapIntervalo = (m, a, b) => { const x = m(a), y = m(b); return x == null || y == null || y <= x ? null : [x, y] }

export async function renderizar({ video, audioExtra, plano, transcricao, saida, dur, temAudio, tmp, aoProgredir }) {
  const cortes = normalizarCortes(plano, dur, !audioExtra)
  const m = mapear(cortes)
  const durFinal = cortes.reduce((s, c) => s + c.fim - c.inicio, 0)
  const f = fonte()
  const partes = []
  const entradaAudio = audioExtra ? '1:a' : '0:a'

  cortes.forEach((c, i) => {
    partes.push(`[0:v]trim=start=${c.inicio}:end=${c.fim},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30[v${i}]`)
    if (!audioExtra && temAudio) partes.push(`[0:a]atrim=start=${c.inicio}:end=${c.fim},asetpts=PTS-STARTPTS[a${i}]`)
  })
  const n = cortes.length
  if (!audioExtra && temAudio) {
    partes.push(cortes.map((_, i) => `[v${i}][a${i}]`).join('') + `concat=n=${n}:v=1:a=1[vc][ac]`)
  } else {
    partes.push(cortes.map((_, i) => `[v${i}]`).join('') + `concat=n=${n}:v=1:a=0[vc]`)
  }

  let ult = 'vc'; let k = 0
  const add = filtro => { const nome = `x${k++}`; partes.push(`[${ult}]${filtro}[${nome}]`); ult = nome }

  // motions
  for (const mo of plano.motions || []) {
    const r = mapIntervalo(m, num(mo.inicio), num(mo.fim)); if (!r) continue
    const [a, b] = r
    if (mo.tipo === 'zoom' || mo.tipo === 'whip') {
      const z = Math.min(1.4, Math.max(1.02, num(mo.intensidade, mo.tipo === 'whip' ? 1.2 : 1.12)))
      const e = `(1+(${z}-1)*between(t,${a},${b})*min(1,(t-${a})/0.3))`
      add(`scale=w='1080*${e}':h='1920*${e}':eval=frame,crop=1080:1920`)
    } else if (mo.tipo === 'flash') {
      add(`drawbox=x=0:y=0:w=iw:h=ih:color=white@0.8:t=fill:enable='between(t,${a},${a + 0.12})'`)
    } else if (mo.tipo === 'texto' && mo.texto && f) {
      const arq = `mo${k}.txt`; fs.writeFileSync(path.join(tmp, arq), String(mo.texto).slice(0, 120))
      add(`drawtext=fontfile='${f.replace(/:/g, '\\:')}':textfile=${arq}:fontsize=64:fontcolor=white:borderw=5:bordercolor=black:x=(w-text_w)/2:y=h*0.62:enable='between(t,${a},${b})'`)
    }
  }

  // título e chamada final
  for (const [chave, y, tam] of [['titulo', 0.14, 78], ['chamada_final', 0.78, 64]]) {
    const t = plano[chave]; if (!t?.texto || !f) continue
    const fim = chave === 'chamada_final' && !num(t.fim) ? durFinal : null
    const r = fim ? [Math.max(0, durFinal - 3), durFinal] : mapIntervalo(m, num(t.inicio), num(t.fim, 2.5))
    if (!r) continue
    const arq = `${chave}.txt`; fs.writeFileSync(path.join(tmp, arq), String(t.texto).slice(0, 140))
    const cor = /^#[0-9a-f]{6}$/i.test(t.cor || '') ? t.cor.replace('#', '0x') : '0xFFD60A'
    add(`drawtext=fontfile='${f.replace(/:/g, '\\:')}':textfile=${arq}:fontsize=${tam}:fontcolor=${cor}:borderw=6:bordercolor=black:x=(w-text_w)/2:y=h*${y}:enable='between(t,${r[0]},${r[1]})'`)
  }

  // legendas palavra por palavra
  if (plano.legendas?.ativo && transcricao?.length) {
    const cor = corAss(plano.legendas.destaque)
    let ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\n\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: P,Arial,110,${cor},&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,7,0,2,60,60,520,1\n\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n`
    for (const w of transcricao) {
      const r = mapIntervalo(m, w.i, Math.max(w.f, w.i + 0.15)); if (!r) continue
      ass += `Dialogue: 0,${tempoAss(r[0])},${tempoAss(r[1])},P,,0,0,0,,${String(w.p).toUpperCase().replace(/[{}\\]/g, '')}\n`
    }
    fs.writeFileSync(path.join(tmp, 'legendas.ass'), ass)
    add('ass=legendas.ass')
  }

  const args = ['-y', '-i', video]
  if (audioExtra) args.push('-i', audioExtra)
  args.push('-filter_complex', partes.join(';'), '-map', `[${ult}]`)
  if (audioExtra) args.push('-map', '1:a')
  else if (temAudio) args.push('-map', '[ac]')
  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart')
  if (audioExtra) args.push('-shortest')
  args.push('-progress', 'pipe:1', '-nostats', saida)

  await new Promise((ok, falha) => {
    const p = spawn('ffmpeg', args, { cwd: tmp })
    let erroTxt = ''
    p.stderr.on('data', d => { erroTxt = (erroTxt + d).slice(-2000) })
    p.stdout.on('data', d => {
      const mm = /out_time_ms=(\d+)/.exec(String(d))
      if (mm && aoProgredir) aoProgredir(Math.min(1, Number(mm[1]) / 1e6 / Math.max(1, durFinal)))
    })
    p.on('error', falha)
    p.on('close', c => c === 0 ? ok() : falha(new Error('ffmpeg falhou: ' + erroTxt.split('\n').slice(-4).join(' ').slice(0, 300))))
  })
}
