const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function dataCurta(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  return `${DIAS[d.getDay()]}, ${d.getDate()} ${MESES[d.getMonth()]}`;
}

export function hojeMaceio() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Maceio" }).format(new Date());
}

export function palavras(texto: string) {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

export function segundosEstimados(texto: string) {
  return Math.round((palavras(texto) / 3.35) * 10) / 10;
}

export const ROTULO_VIDEO: Record<string, string> = {
  na_fila: "Na fila",
  voz: "Gerando voz",
  render: "Renderizando",
  mixagem: "Mixando",
  pronto: "Pronto",
  postado: "Postado",
  erro: "Erro",
};

export const ROTULO_ROTEIRO: Record<string, string> = {
  rascunho: "Rascunho",
  pronto: "Pronto",
  conferir_fato: "Conferir fato",
};

export function classeBadgeVideo(s: string) {
  if (s === "pronto" || s === "postado") return "b-ok";
  if (s === "voz" || s === "render" || s === "mixagem") return "b-run";
  if (s === "erro") return "b-warn";
  return "b-wait";
}

export function haQuanto(iso: string | null) {
  if (!iso) return "nunca";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora há pouco";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return `há ${Math.floor(s / 86400)} d`;
}

export function numero(n: number | null | undefined) {
  return n == null ? "—" : new Intl.NumberFormat("pt-BR").format(n);
}

export const ROTULO_COMENTARIO: Record<string, string> = {
  novo: "Novo",
  enviando: "Enviando",
  respondido: "Respondido pelo funil",
  ignorado: "Sem regra",
  erro: "Erro",
};

export function classeBadgeComentario(s: string) {
  if (s === "respondido") return "b-ok";
  if (s === "enviando") return "b-run";
  if (s === "erro") return "b-warn";
  return "b-wait";
}

export const ROTULO_MIDIA: Record<string, string> = { VIDEO: "Reel", CAROUSEL_ALBUM: "Carrossel", IMAGE: "Foto" };
