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
