import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pastaBase } from './config.js'
import { sondar, transcrever, renderizar } from './render.js'
import { processarVsl } from './vsl.js'

const achar = (dir, prefixo) => {
  if (!fs.existsSync(dir)) return null
  const f = fs.readdirSync(dir).find(x => x.startsWith(prefixo + '.'))
  return f ? path.join(dir, f) : null
}

export async function processar(sb, ped, log = console.log) {
  const avancar = (status, etapa, progresso, resultado = null, erro = null) =>
    sb.rpc('pedido_avancar', { p_pedido: ped.id, p_status: status, p_etapa: etapa, p_progresso: progresso, p_resultado: resultado, p_erro: erro })
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reels-'))
  try {
    let { error } = await avancar('em_andamento', 'entendeu', 5)
    if (error) throw new Error(error.message)

    const dirP = path.join(pastaBase(), ped.projeto_id)
    const video = achar(dirP, 'original')
    if (!video) throw new Error('O vídeo original não está na pasta deste computador.')
    const audioExtra = ped.audio_modo === 'outro' ? achar(dirP, 'audio') : null
    if (ped.audio_modo === 'ia') throw new Error('A locução com IA ainda não está disponível.')

    if (ped.motor === 'vsl') {
      const saida = await processarVsl({ sb, ped, dirP, video, avancar, log })
      await avancar('concluido', 'pronto', 100, path.basename(saida))
      log(`Pedido ${ped.id}: pronto em ${saida}`)
      return
    }

    const { duracao, temAudio } = await sondar(video)
    log(`Pedido ${ped.id}: vídeo de ${duracao.toFixed(1)} s`)
    await avancar('em_andamento', 'entendeu', 15)
    const transcricao = await transcrever(video, tmp)

    await avancar('em_andamento', 'plano', 30)
    const { data, error: e2 } = await sb.functions.invoke('planejar-edicao', { body: { pedido_id: ped.id, contexto: { duracao_s: duracao, transcricao } } })
    if (e2 || data?.erro) throw new Error('Falha ao montar o plano: ' + (data?.erro || e2?.message))
    const plano = data.plano

    await avancar('em_andamento', 'render', 50)
    const saida = path.join(dirP, `${ped.id}.mp4`)
    let ultimo = 0
    await renderizar({
      video, audioExtra, plano, transcricao, saida, dur: duracao, temAudio, tmp,
      aoProgredir: p => { const v = 50 + Math.round(p * 45); if (v - ultimo >= 5) { ultimo = v; avancar('em_andamento', 'render', v) } },
    })
    await avancar('concluido', 'pronto', 100, path.basename(saida))
    log(`Pedido ${ped.id}: pronto em ${saida}`)
  } catch (e) {
    log('Erro:', e.message)
    await avancar('erro', null, 0, null, e.message)
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}
