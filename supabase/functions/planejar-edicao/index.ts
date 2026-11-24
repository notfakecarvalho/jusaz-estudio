import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const SISTEMA = `Você é o editor de vídeo do edita.ai. Recebe o pedido de um criador e devolve um PLANO DE EDIÇÃO em JSON para um Reel vertical (1080x1920).
Responda SOMENTE com JSON válido, sem texto antes ou depois, neste formato:
{
  "resumo": "2 frases em português dizendo o que você vai fazer",
  "titulo": { "texto": "", "inicio": 0, "fim": 2.5, "cor": "#FFD60A" } ou null,
  "cortes": [ { "inicio": 0, "fim": 4.2 } ],
  "legendas": { "ativo": true, "modo": "palavra_por_palavra", "destaque": "#FFD60A" },
  "motions": [ { "tipo": "zoom", "inicio": 1.0, "fim": 2.0, "intensidade": 1.12, "texto": "" } ],
  "chamada_final": { "texto": "", "inicio": 0, "fim": 0 } ou null
}
Regras: tempos em segundos, dentro da duração informada; cortes em ordem e sem sobrepor; tipos de motion permitidos: zoom, texto, flash, whip. Siga o estilo escolhido e o que o usuário pediu. Nunca invente falas que não estejam na transcrição. Se houver um pedido de ajuste no fim das instruções, ele tem prioridade sobre o resto.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const chave = Deno.env.get("ANTHROPIC_API_KEY");
    if (!chave) return json({ erro: "chave_ia_ausente" }, 500);

    const user = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const admin = createClient(url, service);
    const { pedido_id, contexto } = await req.json();
    if (!pedido_id) return json({ erro: "pedido_id_obrigatorio" }, 400);

    // RLS garante que só o dono enxerga o pedido
    const { data: pedido, error } = await user.from("pedidos").select("*, projetos(titulo, duracao_s, arquivo_nome), estilos(nome, prompt)").eq("id", pedido_id).single();
    if (error || !pedido) return json({ erro: "pedido_nao_encontrado" }, 404);
    if (pedido.plano_edicao) return json({ plano: pedido.plano_edicao, reaproveitado: true });
    if (pedido.status !== "em_andamento" || pedido.reembolsado) return json({ erro: "pedido_nao_elegivel" }, 409);

    const duracao = Number(contexto?.duracao_s ?? pedido.projetos?.duracao_s ?? 0);
    const msgUsuario = [
      `Projeto: ${pedido.projetos?.titulo ?? ""}`,
      `Duração do vídeo: ${duracao ? duracao.toFixed(1) + " s" : "desconhecida"}`,
      `Áudio: ${pedido.audio_modo}`,
      `Estilo escolhido: ${pedido.estilos?.nome ?? "nenhum"}${pedido.estilos?.prompt ? " — " + pedido.estilos.prompt : ""}`,
      pedido.referencia_url ? `Referência: ${pedido.referencia_url}` : "",
      `Pedido do usuário: ${pedido.instrucoes ?? "(sem instruções extras)"}`,
      contexto?.transcricao ? `Transcrição com tempos:\n${JSON.stringify(contexto.transcricao).slice(0, 12000)}` : "",
    ].filter(Boolean).join("\n");

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": chave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 2000, system: SISTEMA, messages: [{ role: "user", content: msgUsuario }] }),
    });
    if (!r.ok) return json({ erro: "falha_ia", detalhe: (await r.text()).slice(0, 300) }, 502);
    const out = await r.json();
    const texto: string = out.content?.[0]?.text ?? "";
    const ini = texto.indexOf("{"), fim = texto.lastIndexOf("}");
    let plano;
    try { plano = JSON.parse(texto.slice(ini, fim + 1)); } catch { return json({ erro: "plano_invalido" }, 502); }

    await admin.from("pedidos").update({ plano_edicao: plano }).eq("id", pedido_id);
    if (plano.resumo) await admin.from("mensagens").insert({ pedido_id, user_id: pedido.user_id, papel: "claude", texto: String(plano.resumo).slice(0, 2000) });
    return json({ plano });
  } catch (e) {
    return json({ erro: "erro_interno", detalhe: String(e).slice(0, 200) }, 500);
  }
});
