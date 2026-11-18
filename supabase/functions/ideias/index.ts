// Gera ideias de vídeo para o JusAz a partir dos roteiros que já existem e dos posts que mais engajaram.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

async function ehAdmin(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth) return false;
  const sb = createClient(URL_, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: u } = await sb.auth.getUser();
  if (!u?.user) return false;
  const { data } = await sb.from("admins").select("user_id").maybeSingle();
  return !!data;
}

async function gerar() {
  const chave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!chave) return { erro: "Falta o segredo ANTHROPIC_API_KEY no Supabase (Edge Functions → Secrets)." };

  const [{ data: roteiros }, { data: posts }, { data: ideias }] = await Promise.all([
    admin.from("scripts").select("title, keyword").order("position"),
    admin.from("ig_posts").select("caption, likes, comments_count").order("likes", { ascending: false }).limit(8),
    admin.from("ideas").select("title").order("created_at", { ascending: false }).limit(30),
  ]);

  const contexto = [
    "Roteiros que já existem: " + (roteiros ?? []).map((r) => r.title).join("; "),
    "Posts com mais curtidas: " + (posts ?? []).map((p) => `${(p.caption ?? "").replace(/\s+/g, " ").slice(0, 80)} (${p.likes} curtidas, ${p.comments_count} comentários)`).join(" | "),
    "Ideias já feitas (não repetir): " + (ideias ?? []).map((i) => i.title).join("; "),
  ].join("\n");

  const pedido = `O JusAz é uma plataforma gratuita que liga pessoas a advogados verificados pela OAB. Fazemos um Reel curto por dia no Instagram, em português do Brasil, contando uma situação do dia a dia em que a pessoa pode ter um direito que não conhece (banco, plano de saúde, INSS, consumidor, trabalho, família, voos). Cada vídeo termina convidando a pessoa a comentar uma palavra-chave para receber o caminho no direct.

${contexto}

Proponha 5 ideias novas de vídeo. Regras: situações reais e comuns no Brasil; sem prometer resultado; sem citar pessoas reais; nada que dependa de lei que você não tenha certeza; não repetir temas já feitos. Responda só com JSON, uma lista de 5 objetos com: "title" (curto), "hook" (a primeira frase falada, uma pergunta ou fato que prende), "angle" (2 frases: a história e o direito envolvido) e "keyword" (uma palavra em maiúsculas, sem acento, para a pessoa comentar).`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": chave, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 2000, messages: [{ role: "user", content: pedido }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { erro: `A IA recusou o pedido: ${j?.error?.message ?? r.status}` };
  const texto = String(j.content?.[0]?.text ?? "");
  const bruto = texto.slice(texto.indexOf("["), texto.lastIndexOf("]") + 1);
  let lista: { title?: string; hook?: string; angle?: string; keyword?: string }[] = [];
  try {
    lista = JSON.parse(bruto);
  } catch {
    return { erro: "A resposta da IA veio num formato que não consegui ler. Tente de novo." };
  }
  const linhas = lista
    .filter((x) => x.title)
    .slice(0, 5)
    .map((x) => ({
      title: String(x.title).slice(0, 120),
      hook: x.hook ? String(x.hook).slice(0, 300) : null,
      angle: x.angle ? String(x.angle).slice(0, 600) : null,
      keyword: x.keyword ? String(x.keyword).toUpperCase().normalize("NFD").replace(/[^A-Z0-9]/g, "").slice(0, 20) : null,
      source: "ia",
    }));
  if (!linhas.length) return { erro: "A IA não trouxe nenhuma ideia. Tente de novo." };
  await admin.from("ideas").insert(linhas);
  return { ok: true, criadas: linhas.length };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
  if (!(await ehAdmin(req))) return json({ erro: "Não autorizado." }, 401);
  const b = await req.json().catch(() => ({}));
  try {
    if (b.acao === "gerar") return json(await gerar());
    return json({ erro: "Ação inválida." }, 400);
  } catch (e) {
    return json({ erro: (e as Error).message }, 500);
  }
});
