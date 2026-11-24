"use client";
import { supabaseBrowser } from "@/lib/supabase/client";

export const sb = supabaseBrowser();
export const AGENT = "http://127.0.0.1:47821";

export async function pingAgente(): Promise<{ nome?: string; pasta?: string; versao?: string } | null> {
  try {
    const r = await fetch(AGENT + "/ping", { signal: AbortSignal.timeout(1500) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export async function enviarAoAgente(projetoId: string, tipo: string, arquivo: File) {
  const r = await fetch(`${AGENT}/arquivos/${projetoId}?tipo=${tipo}&nome=${encodeURIComponent(arquivo.name)}`, { method: "POST", body: arquivo });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(
      j.erro === "origem_nao_permitida"
        ? "O agente não aceitou este endereço do site. Atualize o agente para a versão mais recente."
        : "Não consegui guardar o vídeo no seu computador (" + (j.erro || r.status) + ").",
    );
  }
}

export const ETAPAS = [
  ["entendeu", "Entendeu o pedido", "Lido o pedido, o estilo e o áudio."],
  ["plano", "Plano de edição", "Cortes, legendas e motions montados para o seu Reel."],
  ["render", "Render no seu computador", "O agente está editando o vídeo."],
  ["pronto", "MP4 na sua pasta", "O arquivo final está na pasta Reels."],
];

const ERROS: Record<string, string> = {
  saldo_insuficiente: "Saldo de créditos insuficiente.",
  projeto_invalido: "Projeto não encontrado.",
  estilo_invalido: "Estilo não encontrado.",
  pedido_em_andamento: "Espere a edição atual terminar.",
  texto_vazio: "Escreva o que quer ajustar.",
  nao_pode_refazer: "Este pedido não pode ser refeito.",
};
export const msgErro = (e: { message?: string } | null | undefined) => ERROS[e?.message ?? ""] || e?.message || "Algo deu errado.";
export const fmtData = (d: string) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
