// Chaves do Estúdio JusAz trocadas pela tela Conexões.
// O valor vai direto para o Vault (criptografado) e nunca volta para a tela: só se sabe se existe e quando mudou.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

// Só estas chaves podem ser trocadas pela tela.
const CHAVES: Record<string, { rotulo: string; min: number; segredo: boolean }> = {
  IG_ACCESS_TOKEN: { rotulo: "Token do Instagram", min: 40, segredo: true },
  IG_USER_ID: { rotulo: "ID da conta do Instagram", min: 5, segredo: false },
  ELEVENLABS_API_KEY: { rotulo: "Chave do ElevenLabs", min: 20, segredo: true },
  ANTHROPIC_API_KEY: { rotulo: "Chave da Anthropic", min: 20, segredo: true },
  TIKTOK_CLIENT_SECRET: { rotulo: "Client Secret do TikTok", min: 16, segredo: true },
};

async function ehAdmin(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization");
  if (!auth) return false;
  const sb = createClient(URL_, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: u } = await sb.auth.getUser();
  if (!u?.user) return false;
  const { data } = await sb.from("admins").select("user_id").maybeSingle();
  return !!data;
}

async function atual(nome: string): Promise<string> {
  const { data } = await admin.rpc("segredo_ler", { nome });
  return (typeof data === "string" && data.trim()) || Deno.env.get(nome) || "";
}

const baseIg = (t: string) => (t.startsWith("EAA") ? "https://graph.facebook.com/v23.0" : "https://graph.instagram.com/v23.0");

// Confere token e conta no Instagram, sem postar nada. Atualiza o selo da tela.
async function conferirInstagram(token: string, uid: string) {
  const grava = (status: string, label: string | null, meta: Record<string, unknown>) =>
    admin.from("connections").update({ status, label, meta, checked_at: new Date().toISOString() }).eq("kind", "instagram");
  if (!token || !uid) {
    await grava("desconectado", null, { erro: "Falta o token ou o ID da conta do Instagram." });
    return { ok: false, erro: "Falta o token ou o ID da conta." };
  }
  const G = baseIg(token);
  const r = await fetch(`${G}/${uid}?fields=username&access_token=${encodeURIComponent(token)}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.username) {
    const msg = `O Instagram recusou o token: ${j?.error?.message ?? r.status}`;
    await grava("atencao", null, { erro: msg });
    return { ok: false, erro: msg };
  }
  // Token do Login do Facebook (EAA...) lista as permissões liberadas.
  let faltam: string[] = [];
  if (token.startsWith("EAA")) {
    const pr = await fetch(`${G}/me/permissions?access_token=${encodeURIComponent(token)}`);
    const pj = await pr.json().catch(() => ({}));
    const dadas = new Set<string>(((pj?.data ?? []) as { permission: string; status: string }[]).filter((p) => p.status === "granted").map((p) => p.permission));
    if (dadas.size) {
      faltam = ["instagram_basic", "instagram_content_publish", "instagram_manage_insights", "instagram_manage_comments", "instagram_manage_messages"].filter((p) => !dadas.has(p));
    }
  }
  await grava("conectado", `@${j.username}`, faltam.length ? { aviso: `Token sem as permissões: ${faltam.join(", ")}` } : {});
  return { ok: true, conta: j.username as string, faltam };
}

async function status() {
  const nomes = Object.keys(CHAVES);
  const { data } = await admin.rpc("segredo_info", { nomes });
  const painel = new Map<string, string>(((data ?? []) as { nome: string; atualizado_em: string }[]).map((x) => [x.nome, x.atualizado_em]));
  const chaves = nomes.map((nome) => {
    const c = CHAVES[nome];
    const noPainel = painel.has(nome);
    const noServidor = !!Deno.env.get(nome);
    return {
      nome,
      rotulo: c.rotulo,
      origem: noPainel ? "painel" : noServidor ? "servidor" : null,
      atualizado_em: painel.get(nome) ?? null,
    };
  });
  // O ID da conta não é segredo: pode aparecer na tela para conferir.
  const uid = await atual("IG_USER_ID");
  const token = await atual("IG_ACCESS_TOKEN");
  return { chaves, ig_user_id: uid || null, ig_tipo: token ? (token.startsWith("EAA") ? "Login do Facebook" : "Login do Instagram") : null };
}

async function salvar(nome: string, valorBruto: unknown) {
  const c = CHAVES[nome];
  if (!c) return { erro: "Essa chave não pode ser trocada por aqui." };
  const valor = String(valorBruto ?? "").trim();
  if (!valor) return { erro: "Cole o valor antes de salvar." };
  if (/\s/.test(valor)) return { erro: "O valor tem espaço ou quebra de linha. Cole só a chave, sem nada ao redor." };
  if (valor.length < c.min || valor.length > 4000) return { erro: `${c.rotulo}: o valor não parece completo.` };

  // Token do Instagram só é guardado se o Instagram aceitar. Assim a chave boa não é trocada por uma quebrada.
  if (nome === "IG_ACCESS_TOKEN") {
    const uid = await atual("IG_USER_ID");
    if (uid) {
      const t = await conferirInstagram(valor, uid);
      if (!t.ok) {
        // devolve o selo ao estado anterior: a conferência do token novo não vale para o que está salvo
        const velho = await atual("IG_ACCESS_TOKEN");
        if (velho) await conferirInstagram(velho, uid);
        return { erro: t.erro };
      }
    }
  }

  const { error } = await admin.rpc("segredo_gravar", { nome, valor, descricao: `${c.rotulo} (salvo pela tela Conexões)` });
  if (error) return { erro: "Não consegui guardar a chave. Tente de novo." };

  if (nome === "IG_ACCESS_TOKEN" || nome === "IG_USER_ID") {
    const t = await conferirInstagram(await atual("IG_ACCESS_TOKEN"), await atual("IG_USER_ID"));
    if (!t.ok) return { ok: true, aviso: t.erro };
    return {
      ok: true,
      conta: t.conta,
      aviso: t.faltam?.length ? `Salvo, mas o token está sem: ${t.faltam.join(", ")}.` : undefined,
    };
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
  if (!(await ehAdmin(req))) return json({ erro: "Não autorizado." }, 401);
  const b = await req.json().catch(() => ({}));
  try {
    if (b.acao === "status") return json(await status());
    if (b.acao === "salvar") return json(await salvar(String(b.nome ?? ""), b.valor));
    if (b.acao === "testar") return json(await conferirInstagram(await atual("IG_ACCESS_TOKEN"), await atual("IG_USER_ID")));
    return json({ erro: "Ação inválida." }, 400);
  } catch (e) {
    // nunca devolve o valor recebido
    return json({ erro: "Algo deu errado ao salvar. Tente de novo." }, 500);
  }
});
