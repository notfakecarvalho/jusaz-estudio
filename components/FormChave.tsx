import { salvarChave } from "@/app/actions";

// Formulário para trocar uma chave. O valor atual nunca é mostrado: só se existe e de onde vem.
export function FormChave({
  nome, rotulo, ajuda, origem, atualizadoEm, secreto = true, valorAtual,
}: {
  nome: string;
  rotulo: string;
  ajuda?: string;
  origem: "painel" | "servidor" | null;
  atualizadoEm?: string | null;
  secreto?: boolean;
  valorAtual?: string | null;
}) {
  const quando = atualizadoEm
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Maceio" }).format(new Date(atualizadoEm))
    : null;
  const situacao =
    origem === "painel" ? `Salva por aqui${quando ? ` em ${quando}` : ""}`
    : origem === "servidor" ? "Veio do servidor (ainda não trocada por aqui)"
    : "Ainda não salva";

  return (
    <details style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
      <summary style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, listStyle: "none" }}>
        <span style={{ fontWeight: 600 }}>{rotulo}</span>
        <span className={`badge ${origem ? "b-ok" : "b-warn"}`}>{origem ? "Salva" : "Falta"} · trocar</span>
      </summary>
      <form action={salvarChave} className="stack" style={{ marginTop: 12, gap: 10 }} autoComplete="off">
        <input type="hidden" name="nome" value={nome} />
        <div className="fld">
          <label htmlFor={`k-${nome}`}>Novo valor</label>
          <input
            id={`k-${nome}`}
            name="valor"
            className="inp"
            type={secreto ? "password" : "text"}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            required
            defaultValue={secreto ? "" : valorAtual ?? ""}
            placeholder={secreto ? "Cole aqui" : ""}
          />
          <small>{situacao}. {ajuda}</small>
        </div>
        <div className="row"><button className="btn btn-p btn-sm">Salvar</button></div>
      </form>
    </details>
  );
}
