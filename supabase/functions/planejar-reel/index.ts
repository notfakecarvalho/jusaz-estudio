import { createClient } from "npm:@supabase/supabase-js@2";
import { validarBeats, validarKeeps, type Palavra } from "./validar.ts";

// planejar-reel — o "cérebro" do motor VSL (corte pelo som + roteiro visual animado).
// O vídeo nunca passa por aqui: o agente local manda só texto (mapa de tomadas, transcrição) e recebe
// de volta decisões (keeps do corte; roteiro visual `beats.js` validado). Quem corta e renderiza é o computador do usuário.
//
// POST { pedido_id, etapa: "keeps" | "beats", contexto: {...} }
//   keeps:  contexto = { tomadas: string, duracao_bruto_s: number }
//   beats:  contexto = { palavras: [{text,start,end}], duracao_s: number, keeps?: [...], beats_anterior?: string }

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MODELO = "claude-sonnet-5-5";
const PREAMBULO = `const A = (p, n = 1, after = 0) => K.at(p, n, after);
const SPLIT_TOP = 240; // topo do conteúdo em SPLIT (a zona segura do Reels começa em 220)
const CHEST = 1250;    // linha do peito em tela cheia
`;

// Os prompts de sistema ficam na tabela privada config_ia (só o service role lê): dá para ajustar o estilo do
// roteiro sem redeploy. Cache de 60 s por instância.
let cachePrompts: { t: number; v: Record<string, string> } | null = null;
async function carregarPrompts(admin: any): Promise<Record<string, string>> {
  if (cachePrompts && Date.now() - cachePrompts.t < 60000) return cachePrompts.v;
  const { data, error } = await admin.from("config_ia").select("chave, valor").in("chave", ["reel_sistema_keeps", "reel_sistema_beats"]);
  const v: Record<string, string> = {};
  for (const r of data ?? []) v[r.chave] = r.valor;
  if (error || !v.reel_sistema_keeps || !v.reel_sistema_beats) throw new Error("prompts_indisponiveis");
  cachePrompts = { t: Date.now(), v };
  return v;
}

// ------------------------------------------------------------------------------------------------
type Uso = { entrada: number; saida: number; cache_leitura: number; cache_escrita: number; chamadas: number };
const usoVazio = (): Uso => ({ entrada: 0, saida: 0, cache_leitura: 0, cache_escrita: 0, chamadas: 0 });

async function chamarClaude(chave: string, sistema: string, mensagens: { role: string; content: string }[], maxTokens: number, uso: Uso) {
  let ultimo = "";
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": chave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: maxTokens,
        system: [{ type: "text", text: sistema, cache_control: { type: "ephemeral" } }],
        messages: mensagens,
      }),
    });
    if (r.ok) {
      const out = await r.json();
      uso.chamadas++;
      uso.entrada += out.usage?.input_tokens ?? 0;
      uso.saida += out.usage?.output_tokens ?? 0;
      uso.cache_leitura += out.usage?.cache_read_input_tokens ?? 0;
      uso.cache_escrita += out.usage?.cache_creation_input_tokens ?? 0;
      return String(out.content?.[0]?.text ?? "");
    }
    ultimo = (await r.text()).slice(0, 300);
    if (r.status !== 429 && r.status < 500) break;
    await new Promise((ok) => setTimeout(ok, 2500));
  }
  throw new Error("falha_ia:" + ultimo);
}

const tag = (t: string, nome: string): string | null => {
  const m = new RegExp(`<${nome}>([\\s\\S]*?)</${nome}>`, "i").exec(t);
  return m ? m[1].trim() : null;
};
const jsonDe = (t: string): any => {
  const ini = t.indexOf("{"), fim = t.lastIndexOf("}");
  return JSON.parse(t.slice(ini, fim + 1));
};
const arrayDe = (s: string | null): any[] => {
  if (!s) return [];
  try { const a = JSON.parse(s.slice(s.indexOf("["), s.lastIndexOf("]") + 1)); return Array.isArray(a) ? a : []; } catch { return []; }
};
const limparCodigo = (s: string) => s.replace(/^```[a-z]*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

function aplicarCorrecoes(palavras: Palavra[], brutas: any[]) {
  const out = palavras.map((p) => ({ ...p }));
  const aplicadas: { i: number; de: string; para: string }[] = [];
  for (const c of brutas.slice(0, 60)) {
    const i = Number(c?.i), texto = String(c?.texto ?? "").trim();
    if (!Number.isInteger(i) || i < 0 || i >= out.length) continue;
    if (!texto || texto.length > 40 || /\s/.test(texto) || /[<>&"`\\]/.test(texto)) continue;
    if (out[i].text !== texto) { aplicadas.push({ i, de: out[i].text, para: texto }); out[i].text = texto; }
  }
  return { palavras: out, aplicadas };
}

// ------------------------------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const t0 = Date.now();
  const uso = usoVazio();
  let admin: any = null, pedidoId = "", etapaAtual = "";
  const gravarUso = async (pedido: any) => {
    if (!admin || !pedidoId || !uso.chamadas) return;
    const antes = pedido?.ia_uso ?? {};
    const etapas = { ...(antes.etapas ?? {}) };
    const e = etapas[etapaAtual] ?? usoVazio();
    for (const k of ["entrada", "saida", "cache_leitura", "cache_escrita", "chamadas"] as const) e[k] = (e[k] ?? 0) + uso[k];
    etapas[etapaAtual] = e;
    const total = usoVazio();
    for (const v of Object.values(etapas) as Uso[]) for (const k of Object.keys(total) as (keyof Uso)[]) total[k] += v[k] ?? 0;
    await admin.from("pedidos").update({ ia_uso: { chamadas: total.chamadas, total, etapas } }).eq("id", pedidoId);
  };

  let pedido: any = null;
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const chave = Deno.env.get("ANTHROPIC_API_KEY");

    const user = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    admin = createClient(url, service);
    const corpo = await req.json();
    const { pedido_id, etapa, contexto } = corpo ?? {};
    if (etapa === "validar") { // autoteste do analisador: sem IA, sem custo, sem pedido
      const ps = (Array.isArray(contexto?.palavras) ? contexto.palavras : []).slice(0, 600);
      return json(validarBeats(String(contexto?.codigo ?? ""), ps));
    }
    if (!chave) return json({ erro: "chave_ia_ausente" }, 500);
    if (!pedido_id) return json({ erro: "pedido_id_obrigatorio" }, 400);
    if (etapa !== "keeps" && etapa !== "beats") return json({ erro: "etapa_invalida" }, 400);
    pedidoId = pedido_id; etapaAtual = etapa;

    // RLS: só o dono enxerga o pedido
    const { data, error } = await user.from("pedidos")
      .select("*, projetos(titulo, duracao_s), estilos(nome, prompt, motor, fonte_url)").eq("id", pedido_id).single();
    if (error || !data) return json({ erro: "pedido_nao_encontrado" }, 404);
    pedido = data;
    if (pedido.motor !== "vsl") return json({ erro: "motor_incorreto" }, 409);
    if (pedido.status !== "em_andamento" || pedido.reembolsado) return json({ erro: "pedido_nao_elegivel" }, 409);

    // teto de chamadas por pedido (protege o custo): 8 + 6 por ajuste pedido
    const ajustes = (String(pedido.instrucoes ?? "").match(/Ajuste pedido:/g) ?? []).length;
    const limite = 8 + 6 * ajustes;
    if ((pedido.ia_uso?.chamadas ?? 0) >= limite) return json({ erro: "limite_chamadas", limite }, 429);

    const plano = pedido.plano_edicao ?? null;
    const instrucoes = String(pedido.instrucoes ?? "").slice(0, 3000);
    const estilo = pedido.estilos ? `${pedido.estilos.nome}${pedido.estilos.prompt ? " — " + String(pedido.estilos.prompt).slice(0, 2500) : ""}` : "nenhum";
    const cabecalho = [
      `Projeto: ${pedido.projetos?.titulo ?? ""}`,
      `Estilo escolhido (direção criativa): ${estilo}`,
      pedido.referencia_url ? `Referência: ${pedido.referencia_url}` : "",
      `Pedido do usuário: ${instrucoes || "(sem instruções extras)"}`,
    ].filter(Boolean).join("\n");

    const P = await carregarPrompts(admin);

    // ---------------------------------------------------------------- corte
    if (etapa === "keeps") {
      if (plano?.keeps?.length) return json({ keeps: plano.keeps, resumo: plano.resumo ?? "", avisos: plano.avisos ?? [], reaproveitado: true });
      const tomadas = String(contexto?.tomadas ?? "").slice(0, 16000);
      const duracao = Number(contexto?.duracao_bruto_s ?? 0);
      if (!tomadas.trim()) return json({ erro: "tomadas_obrigatorias" }, 400);

      const msg = `${cabecalho}\nDuração do bruto: ${duracao ? duracao.toFixed(1) + " s" : "desconhecida"}\n\nMAPA DE TOMADAS:\n${tomadas}`;
      const conversa = [{ role: "user", content: msg }];
      let texto = await chamarClaude(chave, P.reel_sistema_keeps, conversa, 2500, uso);
      let res: any, v: any, parseErro = "";
      for (let rodada = 0; rodada < 2; rodada++) {
        try { res = jsonDe(texto); v = validarKeeps(res.keeps, duracao); parseErro = ""; } catch { parseErro = "resposta não é JSON válido"; v = null; }
        if (v?.ok) break;
        if (rodada === 1 || Date.now() - t0 > 90000) break;
        conversa.push({ role: "assistant", content: texto });
        conversa.push({ role: "user", content: `Seu JSON foi recusado: ${(v?.erros ?? [parseErro]).join("; ")}. Corrija e responda de novo só com o JSON.` });
        texto = await chamarClaude(chave, P.reel_sistema_keeps, conversa, 2500, uso);
      }
      if (!v?.ok) { await gravarUso(pedido); return json({ erro: "keeps_invalidos", detalhes: v?.erros ?? [parseErro] }, 422); }

      const resumo = String(res.resumo ?? "").slice(0, 1500);
      const avisos = (Array.isArray(res.avisos) ? res.avisos : []).map((a: unknown) => String(a).slice(0, 300)).slice(0, 10);
      await admin.from("pedidos").update({ plano_edicao: { motor: "vsl", etapa: "keeps", resumo, keeps: v.keeps, avisos } }).eq("id", pedido_id);
      if (resumo) await admin.from("mensagens").insert({ pedido_id, user_id: pedido.user_id, papel: "claude", texto: resumo });
      await gravarUso(pedido);
      return json({ keeps: v.keeps, resumo, avisos });
    }

    // ---------------------------------------------------------------- roteiro visual
    if (plano?.beats_js) return json({ resumo: plano.resumo ?? "", correcoes: plano.correcoes ?? [], avisos: plano.avisos ?? [], beats_js: plano.beats_js, reaproveitado: true });
    const brutas: Palavra[] = (Array.isArray(contexto?.palavras) ? contexto.palavras : [])
      .map((p: any) => ({ text: String(p?.text ?? "").trim(), start: Number(p?.start), end: Number(p?.end) }))
      .filter((p: Palavra) => p.text && isFinite(p.start) && isFinite(p.end))
      .slice(0, 600);
    if (brutas.length < 3) return json({ erro: "palavras_obrigatorias" }, 400);
    const duracao = Number(contexto?.duracao_s ?? brutas[brutas.length - 1].end);
    const anterior = typeof contexto?.beats_anterior === "string" ? contexto.beats_anterior.slice(0, 24000) : "";
    const lista = brutas.map((p, i) => `${i} ${p.start.toFixed(2)} ${p.end.toFixed(2)} ${p.text}`).join("\n");
    const msg = `${cabecalho}\nDuração do vídeo já cortado: ${duracao.toFixed(1)} s\n${anterior ? `\nROTEIRO VISUAL ANTERIOR (ajuste este, conforme o pedido):\n<anterior>\n${anterior}\n</anterior>\n` : ""}\nTRANSCRIÇÃO NUMERADA (índice início fim texto):\n${lista}`;
    const conversa = [{ role: "user", content: msg }];

    let texto = await chamarClaude(chave, P.reel_sistema_beats, conversa, 7000, uso);
    let ultimoErro: string[] = [];
    let final: any = null;
    for (let rodada = 0; rodada < 2; rodada++) {
      const codigoBruto = tag(texto, "codigo");
      if (!codigoBruto) ultimoErro = ["faltou a tag <codigo>…</codigo>"];
      else {
        const corr = aplicarCorrecoes(brutas, arrayDe(tag(texto, "correcoes")));
        const codigo = limparCodigo(codigoBruto);
        const v = validarBeats(codigo, corr.palavras);
        if (v.ok) {
          final = { texto, codigo, corr, avisos: v.avisos, ancoras: v.ancoras };
          break;
        }
        ultimoErro = v.erros;
      }
      if (rodada === 1 || Date.now() - t0 > 90000) break;
      conversa.push({ role: "assistant", content: texto });
      conversa.push({ role: "user", content: `O analisador recusou o <codigo>:\n- ${ultimoErro.join("\n- ")}\nReescreva a resposta completa no mesmo formato (<resumo>, <correcoes>, <avisos>, <codigo>) corrigindo exatamente isso.` });
      texto = await chamarClaude(chave, P.reel_sistema_beats, conversa, 7000, uso);
    }
    if (!final) { await gravarUso(pedido); return json({ erro: "beats_invalidos", detalhes: ultimoErro }, 422); }

    const resumo = String(tag(final.texto, "resumo") ?? "").slice(0, 1500);
    const avisosIA = arrayDe(tag(final.texto, "avisos")).map((a) => String(a).slice(0, 300)).slice(0, 10);
    const avisos = [...avisosIA, ...final.avisos];
    const beatsJs = PREAMBULO + final.codigo + "\n";
    const novoPlano = {
      ...(plano ?? {}),
      motor: "vsl",
      etapa: "beats",
      resumo: resumo || plano?.resumo || "",
      keeps: Array.isArray(contexto?.keeps) ? contexto.keeps.slice(0, 80) : plano?.keeps ?? [],
      correcoes: final.corr.aplicadas,
      avisos,
      beats_js: beatsJs,
      ancoras: final.ancoras,
    };
    await admin.from("pedidos").update({ plano_edicao: novoPlano }).eq("id", pedido_id);
    if (resumo) await admin.from("mensagens").insert({ pedido_id, user_id: pedido.user_id, papel: "claude", texto: resumo });
    await gravarUso(pedido);
    // palavras corrigidas voltam inteiras para o agente gravar o transcript do kit
    return json({ resumo, correcoes: final.corr.aplicadas, avisos, beats_js: beatsJs, palavras: final.corr.palavras });
  } catch (e) {
    try { await gravarUso(pedido); } catch { /* o custo já foi tentado */ }
    const m = String(e);
    if (m.includes("prompts_indisponiveis")) return json({ erro: "prompts_indisponiveis" }, 500);
    if (m.includes("falha_ia")) return json({ erro: "falha_ia", detalhe: m.slice(0, 300) }, 502);
    return json({ erro: "erro_interno", detalhe: m.slice(0, 200) }, 500);
  }
});
