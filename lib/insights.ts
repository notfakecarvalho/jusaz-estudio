import type { IgPost } from "@/lib/types";

export type MetricaId = "views" | "reach" | "engaj" | "likes" | "comments" | "saves" | "shares";

export const METRICAS: { id: MetricaId; rotulo: string; dica: string }[] = [
  { id: "views", rotulo: "Visualizações", dica: "Quantas vezes o vídeo foi exibido" },
  { id: "reach", rotulo: "Alcance", dica: "Contas diferentes que viram" },
  { id: "engaj", rotulo: "Interações", dica: "Curtidas, comentários, salvamentos e compartilhamentos" },
  { id: "likes", rotulo: "Curtidas", dica: "Curtidas" },
  { id: "comments", rotulo: "Comentários", dica: "Comentários" },
  { id: "saves", rotulo: "Salvamentos", dica: "Quantas pessoas salvaram" },
  { id: "shares", rotulo: "Compartilhamentos", dica: "Envios e compartilhamentos" },
];

export function valor(p: IgPost, m: MetricaId): number | null {
  switch (m) {
    case "views": return p.views;
    case "reach": return p.reach;
    case "likes": return p.likes;
    case "comments": return p.comments_count;
    case "saves": return p.saves;
    case "shares": return p.shares;
    case "engaj": return p.interactions ?? p.likes + p.comments_count;
  }
}

export const ehReel = (p: IgPost) => p.product_type === "REELS";

export function primeiraLinha(texto: string | null, max = 56) {
  const l = (texto ?? "").split("\n").find((x) => x.trim()) ?? "Sem legenda";
  const limpa = l.replace(/\s+/g, " ").trim();
  return limpa.length > max ? `${limpa.slice(0, max - 1)}…` : limpa;
}

export function segundos(ms: number | null | undefined) {
  if (ms == null) return "—";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(ms / 1000)} s`;
}

export function diaMes(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(new Date(iso).getTime() - 3 * 3600e3);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Arredonda o teto do eixo para um número "redondo" (1, 2, 5 × 10^n).
export function tetoRedondo(max: number) {
  if (max <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  const f = max / exp;
  const base = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return base * exp;
}
