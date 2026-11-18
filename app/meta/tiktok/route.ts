import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Endereço de retorno do login do TikTok. A rota fica em /meta/ (liberada no proxy), então
// confere a sessão aqui mesmo: só quem entrou no estúdio consegue concluir a conexão.
export async function GET(req: NextRequest) {
  const u = req.nextUrl;
  const para = (caminho: string, chave: "ok" | "erro", texto: string) => {
    const destino = new URL(caminho, req.url);
    destino.searchParams.set(chave, texto);
    return NextResponse.redirect(destino);
  };

  const sb = await supabaseServer();
  const { data: sessao } = await sb.auth.getUser();
  if (!sessao.user) return NextResponse.redirect(new URL("/login", req.url));

  const recusou = u.searchParams.get("error");
  if (recusou) {
    return para("/conexoes", "erro", recusou === "access_denied" ? "Você cancelou a conexão com o TikTok." : "O TikTok não concluiu o login. Tente de novo.");
  }
  const code = u.searchParams.get("code");
  const state = u.searchParams.get("state");
  if (!code || !state) return para("/conexoes", "erro", "O TikTok não devolveu o código de login. Tente de novo.");

  const { data, error } = await sb.functions.invoke("tiktok", { body: { acao: "trocar", code, state } });
  if (error) return para("/conexoes", "erro", "Não consegui falar com o servidor do TikTok. Tente de novo.");
  if (data?.erro) return para("/conexoes", "erro", String(data.erro));
  const conta = data?.conta ? `@${data.conta}` : "a conta";
  return para("/conexoes", "ok", `TikTok conectado: ${conta}.`);
}
