// Validadores do roteiro visual (beats) e do corte (keeps) do motor VSL.
// Roda no Deno (edge function) e no Node (testes). Sem dependências.
//
// O código de beats que o Claude devolve vai ser executado no Chrome do computador do usuário.
// Por isso ele NÃO é executado aqui nem aceito "como veio": passa por um analisador que só deixa
// passar uma linguagem mínima — `const x = ...;`, chamadas K.<função do kit>(...), A("frase") e
// literais. Nada de funções, laços, acesso por colchetes, import, rede, DOM, imagens ou URLs.

export type Palavra = { text: string; start: number; end: number };
export type Keep = { from: number; to: number; why: string; raw?: boolean };

// ------------------------------------------------------------------------------------------------
// normalização e busca de frase — mesma lógica do kit (K.at)
export const norm = (s: string): string =>
  String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9%$ ]+/g, " ").trim();

export function acharFrase(palavras: Palavra[], frase: string, nth = 1): Palavra[] | null {
  const WN = palavras.map((w) => ({ n: norm(w.text), w })).filter((x) => x.n);
  const p = norm(frase).split(/\s+/).filter(Boolean);
  if (!p.length) return null;
  let hit = 0;
  for (let i = 0; i <= WN.length - p.length; i++) {
    let ok = true;
    for (let j = 0; j < p.length; j++) if (WN[i + j].n.replace(/ /g, "") !== p[j]) { ok = false; break; }
    if (ok && ++hit === nth) return WN.slice(i, i + p.length).map((x) => x.w);
  }
  return null;
}

// ------------------------------------------------------------------------------------------------
// o que o kit oferece (apenas o que não depende de imagem externa)
export const K_PERMITIDOS = new Set([
  "at", "end", "layout", "punch", "drift", "hideMouth", "camcorder", "glitch", "flash", "leak",
  "stack", "pill", "chain", "section", "kickerTop", "panel", "prompt", "progress", "stamp", "cta",
  "compare", "price", "mouthCaps", "icon",
]);
const MATH_PERMITIDOS = new Set(["min", "max", "round", "floor", "ceil", "abs"]);
const GLOBAIS = new Set(["K", "A", "SPLIT_TOP", "CHEST", "Math", "NaN", "Infinity"]);
const PALAVRAS = new Set(["const", "let", "true", "false", "null", "undefined"]);
const RESERVADOS = new Set([
  "K", "A", "WORDS", "SPLIT_TOP", "CHEST", "Math", "NaN", "Infinity", "undefined", "const", "let", "var", "function",
  "constructor", "__proto__", "prototype", "eval", "window", "document", "globalThis", "self", "top", "parent", "frames",
  "process", "Deno", "require", "import", "export", "fetch", "this", "new", "return", "class", "async", "await", "yield",
  "delete", "typeof", "instanceof", "void", "in", "of", "if", "else", "for", "while", "do", "switch", "case", "break",
  "continue", "try", "catch", "finally", "throw", "with", "debugger", "default", "null", "true", "false", "gsap", "tl",
]);
const CHAVES_PROIBIDAS = new Set(["__proto__", "constructor", "prototype"]);
const PONTUACAO = new Set(["+", "-", "*", "/", "%", "(", ")", ",", ";", ":", "?", "{", "}", "[", "]", "=", "<", ">", "!", "&", "|", "."]);

// conteúdo proibido dentro de textos (strings e templates) — HTML de painel é só texto e SVG inline
const PROIBIDO_EM_TEXTO: [RegExp, string][] = [
  [/<\s*(script|iframe|link|object|embed|video|audio|base|meta|style|img|image|use|foreignObject|form|input|button|a)\b/i, "tag HTML não permitida"],
  [/url\s*\(/i, "url() não é permitido"],
  [/@import/i, "@import não é permitido"],
  [/javascript\s*:/i, "javascript: não é permitido"],
  [/\bdata\s*:\s*(image|text|application|font)\b/i, "data: não é permitido"],
  [/https?\s*:/i, "URL externa não é permitida"],
  [/\/\//, "// em texto (possível URL) não é permitido"],
  [/\bon[a-z]+\s*=/i, "atributo de evento não é permitido"],
  [/\b(src|href|srcdoc|xlink:href)\s*=/i, "src/href não são permitidos (sem imagens externas)"],
  [/expression\s*\(/i, "expression() não é permitido"],
];

type Tok = { t: "id" | "num" | "str" | "tpl" | "p"; v: string; i: number; exprs?: string[] };

function lex(src: string): { toks: Tok[]; erro?: string } {
  const toks: Tok[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") {
      const f = src.indexOf("*/", i + 2);
      if (f < 0) return { toks, erro: "comentário /* sem fechar" };
      i = f + 2; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1, out = "";
      while (j < n && src[j] !== c) {
        if (src[j] === "\n") return { toks, erro: `texto sem fechar perto de "${src.slice(i, i + 30)}"` };
        if (src[j] === "\\") {
          const e = src[j + 1];
          out += e === "n" ? "\n" : e === "t" ? "\t" : e;
          j += 2; continue;
        }
        out += src[j++];
      }
      if (j >= n) return { toks, erro: `texto sem fechar perto de "${src.slice(i, i + 30)}"` };
      toks.push({ t: "str", v: out, i });
      i = j + 1; continue;
    }
    if (c === "`") {
      let j = i + 1, out = "";
      const exprs: string[] = [];
      while (j < n && src[j] !== "`") {
        if (src[j] === "\\") { out += src[j + 1] ?? ""; j += 2; continue; }
        if (src[j] === "$" && src[j + 1] === "{") {
          let k = j + 2, e = "";
          while (k < n && src[k] !== "}") {
            if (src[k] === "{" || src[k] === "`") return { toks, erro: "expressão ${...} aninhada não é permitida" };
            e += src[k++];
          }
          if (k >= n) return { toks, erro: "${ sem fechar" };
          exprs.push(e);
          out += "\u0000";
          j = k + 1; continue;
        }
        out += src[j++];
      }
      if (j >= n) return { toks, erro: "template literal (crase) sem fechar" };
      toks.push({ t: "tpl", v: out, i, exprs });
      i = j + 1; continue;
    }
    const prev = toks[toks.length - 1];
    const prevFimValor = prev && (prev.t === "id" || prev.t === "num" || prev.t === "str" || prev.t === "tpl" || prev.v === ")" || prev.v === "]");
    if (/\d/.test(c) || (c === "." && /\d/.test(src[i + 1] ?? "") && !prevFimValor)) {
      const m = /^(\d+(\.\d+)?|\.\d+)/.exec(src.slice(i));
      if (!m) return { toks, erro: "número inválido" };
      toks.push({ t: "num", v: m[0], i });
      i += m[0].length; continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      const m = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(src.slice(i))!;
      toks.push({ t: "id", v: m[0], i });
      i += m[0].length; continue;
    }
    if (c === "=" && src[i + 1] === ">") return { toks, erro: "funções com => não são permitidas" };
    if (PONTUACAO.has(c)) { toks.push({ t: "p", v: c, i }); i++; continue; }
    return { toks, erro: `caractere não permitido "${c}"` };
  }
  return { toks };
}

// argumentos de uma chamada: índice do "(" → índices [início, fim) dos tokens internos
function intervaloChamada(toks: Tok[], abre: number): [number, number] | null {
  let nivel = 0;
  for (let k = abre; k < toks.length; k++) {
    const v = toks[k].t === "p" ? toks[k].v : "";
    if (v === "(" || v === "[" || v === "{") nivel++;
    else if (v === ")" || v === "]" || v === "}") { nivel--; if (nivel === 0) return [abre + 1, k]; }
  }
  return null;
}

// pares chave: número literais dentro de um intervalo (primeira ocorrência de cada chave)
function numeros(toks: Tok[], a: number, b: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (let k = a; k < b - 2; k++) {
    if (toks[k].t === "id" && toks[k + 1].v === ":" && toks[k + 2].t === "num" && !(toks[k].v in out)) out[toks[k].v] = parseFloat(toks[k + 2].v);
  }
  return out;
}
// objeto aninhado "chave: { ... }" → intervalo interno
function objeto(toks: Tok[], a: number, b: number, chave: string): [number, number] | null {
  for (let k = a; k < b - 2; k++) {
    if (toks[k].t === "id" && toks[k].v === chave && toks[k + 1].v === ":" && toks[k + 2].v === "{") return intervaloChamada(toks, k + 2);
  }
  return null;
}

export type ResultadoBeats = { ok: boolean; erros: string[]; avisos: string[]; ancoras: number };

export function validarBeats(codigo: string, palavras: Palavra[]): ResultadoBeats {
  const erros: string[] = [];
  const avisos: string[] = [];
  const bad = (m: string) => { if (erros.length < 25) erros.push(m); };

  if (!codigo || !codigo.trim()) return { ok: false, erros: ["código vazio"], avisos, ancoras: 0 };
  if (codigo.length > 26000) return { ok: false, erros: [`código grande demais (${codigo.length} caracteres; limite 26000)`], avisos, ancoras: 0 };

  const { toks, erro } = lex(codigo);
  if (erro) return { ok: false, erros: [erro], avisos, ancoras: 0 };

  // 1ª passada: nomes declarados
  const declarados = new Set<string>();
  for (let k = 0; k < toks.length; k++) {
    if (toks[k].t === "id" && (toks[k].v === "const" || toks[k].v === "let")) {
      const nome = toks[k + 1];
      if (!nome || nome.t !== "id") { bad("declaração inválida depois de const/let"); continue; }
      if (RESERVADOS.has(nome.v)) { bad(`nome reservado em const: ${nome.v} (A, K, SPLIT_TOP e CHEST já existem; não redeclare)`); continue; }
      if (declarados.has(nome.v)) bad(`const duplicado: ${nome.v}`);
      declarados.add(nome.v);
      if (toks[k + 2]?.v !== "=") bad(`falta "=" na declaração de ${nome.v}`);
    }
  }

  // 2ª passada: gramática mínima
  let chaves = 0;
  let ancoras = 0;
  const chamadasK: { nome: string; abre: number }[] = [];
  const checarTexto = (s: string, onde: string) => {
    for (const [re, msg] of PROIBIDO_EM_TEXTO) if (re.test(s)) { bad(`${msg} (em ${onde}: "${s.replace(/\s+/g, " ").slice(0, 50)}…")`); break; }
  };

  for (let k = 0; k < toks.length; k++) {
    const tk = toks[k], prev = toks[k - 1], next = toks[k + 1];
    if (tk.t === "str") { checarTexto(tk.v, "texto"); continue; }
    if (tk.t === "tpl") {
      checarTexto(tk.v, "template");
      for (const e of tk.exprs ?? []) {
        const ex = e.trim();
        const okId = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(ex) && (declarados.has(ex) || ex === "SPLIT_TOP" || ex === "CHEST");
        const okIcon = /^K\.icon\(\s*["'][a-z0-9]+["']\s*\)$/.test(ex);
        const okNum = /^(SPLIT_TOP|CHEST)\s*[+-]\s*\d+$/.test(ex);
        if (!okId && !okIcon && !okNum) bad("em ${...} só cabem um nome declarado com const, SPLIT_TOP, CHEST ou K.icon(\"nome\")");
      }
      if (next && next.v === "(") bad("template seguido de ( não é permitido");
      continue;
    }
    if (tk.t === "num") continue;
    if (tk.t === "p") {
      if (tk.v === "{") chaves++;
      else if (tk.v === "}") chaves--;
      else if (tk.v === "[") {
        if (prev && (prev.t === "id" || prev.t === "str" || prev.t === "tpl" || prev.t === "num" || prev.v === ")" || prev.v === "]")) bad("acesso por colchetes não é permitido");
      } else if (tk.v === ".") {
        const antes = toks[k - 1], antes2 = toks[k - 2];
        const nome = next;
        if (!antes || antes.t !== "id" || (antes.v !== "K" && antes.v !== "Math") || (antes2 && antes2.v === ".")) { bad("ponto só é permitido em K.função(...) e Math.função(...)"); continue; }
        if (!nome || nome.t !== "id") { bad("ponto sem nome"); continue; }
        if (antes.v === "K") {
          if (!K_PERMITIDOS.has(nome.v)) bad(`K.${nome.v} não está disponível (permitidas: ${[...K_PERMITIDOS].join(", ")})`);
        } else if (!MATH_PERMITIDOS.has(nome.v)) bad(`Math.${nome.v} não é permitido`);
        if (toks[k + 2]?.v !== "(") bad(`K.${nome.v}/Math.${nome.v} precisa ser chamado com ( )`);
        else if (antes.v === "K") chamadasK.push({ nome: nome.v, abre: k + 2 });
      } else if (tk.v === "(") {
        const ok = !prev || (prev.t === "p" && prev.v !== ")" && prev.v !== "]") || (prev.t === "id" && (prev.v === "A" || toks[k - 2]?.v === "."));
        if (!ok) bad("chamada de função não permitida");
      }
      continue;
    }
    // identificador
    if (tk.t === "id") {
      if (PALAVRAS.has(tk.v)) continue;
      if (prev && prev.v === ".") continue; // tratado no ponto
      const chave = chaves > 0 && next && next.v === ":" && prev && (prev.v === "{" || prev.v === ",");
      if (chave) { if (CHAVES_PROIBIDAS.has(tk.v)) bad(`chave proibida: ${tk.v}`); continue; }
      if (GLOBAIS.has(tk.v) || declarados.has(tk.v)) {
        if (tk.v === "K" && next?.v !== ".") bad("K só pode aparecer como K.função(...)");
        if (tk.v === "Math" && next?.v !== ".") bad("Math só pode aparecer como Math.função(...)");
        if (tk.v === "A") {
          if (next?.v !== "(") bad("A só pode ser chamado como A(\"frase\")");
          else chamadasK.push({ nome: "A", abre: k + 1 });
        } else if (tk.v !== "K" && tk.v !== "Math" && next && (next.v === "(" || next.t === "tpl")) bad(`${tk.v} não é uma função`);
        if (next?.v === "[") bad("acesso por colchetes não é permitido");
        continue;
      }
      bad(`identificador não permitido: ${tk.v}`);
    }
  }
  if (chaves !== 0) bad("chaves { } desbalanceadas");

  // âncoras: toda frase de A()/K.at()/K.end() é texto literal e existe na fala
  for (const c of chamadasK) {
    if (c.nome !== "A" && c.nome !== "at" && c.nome !== "end") continue;
    const arg = toks[c.abre + 1];
    if (!arg || arg.t !== "str") { bad(`âncora ${c.nome}(...) precisa de uma frase entre aspas como 1º argumento`); continue; }
    let nth = 1;
    if (toks[c.abre + 2]?.v === ",") {
      const n2 = toks[c.abre + 3];
      if (n2 && n2.t === "num") nth = Math.max(1, Math.round(parseFloat(n2.v)));
      else bad(`ocorrência de "${arg.v}" precisa ser um número literal`);
    }
    ancoras++;
    if (!acharFrase(palavras, arg.v, nth)) bad(`frase não encontrada na fala: "${arg.v}"${nth > 1 ? ` (ocorrência ${nth})` : ""}`);
  }

  // mouthCaps: exatamente um, e por último entre as chamadas K.*
  const kk = chamadasK.filter((c) => c.nome !== "A" && c.nome !== "icon");
  const mc = kk.filter((c) => c.nome === "mouthCaps");
  if (mc.length !== 1) bad(`K.mouthCaps precisa aparecer exatamente 1 vez (apareceu ${mc.length})`);
  else if (kk[kk.length - 1].nome !== "mouthCaps") bad("K.mouthCaps precisa ser a ÚLTIMA chamada K.* do arquivo");

  // zona segura e rosto (R1/R7) — só números literais
  const dentro = (x: number, w: number | undefined) => x >= 90 && (w == null || x + w <= 990);
  for (const c of chamadasK) {
    const r = intervaloChamada(toks, c.abre);
    if (!r) continue;
    const [a, b] = r;
    const num = numeros(toks, a, b);
    const box = objeto(toks, a, b, "box");
    const nb = box ? numeros(toks, box[0], box[1]) : {};
    switch (c.nome) {
      case "stack":
        if (num.top != null && (num.top < 1100 || num.top > 1300)) bad(`K.stack: top ${num.top} fora de 1100–1300 (lettering no peito; o alto do quadro é a cabeça)`);
        break;
      case "pill":
        if (num.y != null && num.y < 1150) bad(`K.pill: y ${num.y} < 1150 cobre o rosto (use o peito: y 1250–1450)`);
        break;
      case "stamp":
        if (num.y == null || num.y < 1150) bad("K.stamp: informe y >= 1150 (no peito); sem y ele cai na testa");
        break;
      case "kickerTop":
        if (num.y == null || num.y < 1150) bad("K.kickerTop: informe y >= 1150 (no peito); no topo ele encosta no cabelo — em SPLIT use o kicker do K.section");
        break;
      case "cta":
        if (num.y == null || num.y < 1150 || num.y > 1400) bad("K.cta: informe y entre 1150 e 1400 (ex.: 1300)");
        break;
      case "prompt":
        if (num.x == null || num.y == null || num.w == null) bad("K.prompt: informe x, y e w (ex.: x: 90, y: 400, w: 900)");
        else if (!dentro(num.x, num.w) || num.y < 220 || num.y > 1450) bad(`K.prompt: fora da zona segura (x ${num.x}, w ${num.w}, y ${num.y})`);
        break;
      case "price":
        if (box == null || nb.x == null || nb.w == null) bad("K.price: informe box: {x, y, w, h} dentro de x 90–990");
        else if (!dentro(nb.x, nb.w)) bad("K.price: box fora da zona segura (x 90–990)");
        break;
      case "panel":
      case "compare":
      case "progress":
        if (box) {
          if (nb.x != null && !dentro(nb.x, nb.w)) bad(`K.${c.nome}: box fora de x 90–990 (x ${nb.x}, w ${nb.w})`);
          if (nb.y != null && nb.y < 220) bad(`K.${c.nome}: box acima da zona segura (y ${nb.y} < 220)`);
          if (nb.y != null && nb.h != null && nb.y + nb.h > 1520) bad(`K.${c.nome}: box passa de y 1520 (y ${nb.y}, h ${nb.h})`);
        } else if (c.nome === "panel") avisos.push("K.panel sem box: usa o padrão x 90, y 360, w 900, h 520");
        break;
      case "layout": {
        const tipo = toks[a];
        if (!tipo || tipo.t !== "str" || !["full", "split"].includes(tipo.v)) bad('K.layout: o 1º argumento é "full" ou "split"');
        break;
      }
      case "punch": {
        const esc = toks[b - 1];
        if (esc && esc.t === "num" && parseFloat(esc.v) > 1.25) bad("K.punch: escala máxima 1.25 (rosto cortado acima disso)");
        break;
      }
    }
  }

  // aviso de composição (não bloqueia): troca de layout sem esconder a legenda
  const nLayout = kk.filter((c) => c.nome === "layout").length;
  const nHide = kk.filter((c) => c.nome === "hideMouth").length;
  if (nLayout > 0 && nHide < nLayout) avisos.push(`há ${nLayout} K.layout e só ${nHide} K.hideMouth: toda troca precisa de K.hideMouth(t - 0.05, t + 0.5)`);
  if (nLayout === 0) avisos.push("nenhuma troca FULL↔SPLIT: o estilo espera ~50% de cada");

  return { ok: erros.length === 0, erros, avisos, ancoras };
}

// ------------------------------------------------------------------------------------------------
export type ResultadoKeeps = { ok: boolean; erros: string[]; keeps: Keep[]; total: number };

export function validarKeeps(bruto: unknown, duracaoBruto: number): ResultadoKeeps {
  const erros: string[] = [];
  const lista = Array.isArray(bruto) ? bruto : [];
  if (!lista.length) return { ok: false, erros: ["keeps vazio"], keeps: [], total: 0 };
  if (lista.length > 80) erros.push("keeps demais (máximo 80)");
  const out: Keep[] = [];
  let fimAnterior = -1;
  lista.forEach((k: any, i: number) => {
    const f = Number(k?.from), t = Number(k?.to);
    if (!isFinite(f) || !isFinite(t)) { erros.push(`keep ${i + 1}: from/to precisam ser números`); return; }
    if (f < 0 || (duracaoBruto > 0 && t > duracaoBruto + 0.5)) erros.push(`keep ${i + 1}: fora da duração do bruto (${duracaoBruto.toFixed(1)} s)`);
    if (t - f < 0.4) erros.push(`keep ${i + 1}: curto demais (${(t - f).toFixed(2)} s; mínimo 0,4 s)`);
    if (f < fimAnterior - 0.001) erros.push(`keep ${i + 1}: começa antes do fim do anterior (mantenha a ordem do bruto, sem sobrepor)`);
    fimAnterior = t;
    const why = String(k?.why ?? "").replace(/\s+/g, " ").slice(0, 160);
    out.push({ from: Math.round(f * 100) / 100, to: Math.round(t * 100) / 100, why, ...(k?.raw === true ? { raw: true } : {}) });
  });
  const total = out.reduce((s, k) => s + (k.to - k.from), 0);
  if (total > 92) erros.push(`o Reel final teria ${total.toFixed(1)} s; o máximo é 90 s — escolha menos tomadas`);
  if (total < 3) erros.push(`o Reel final teria só ${total.toFixed(1)} s`);
  return { ok: erros.length === 0, erros, keeps: out, total };
}
