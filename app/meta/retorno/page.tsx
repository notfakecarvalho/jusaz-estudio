import type { Metadata } from "next";

export const metadata: Metadata = { title: "Instagram · Estúdio JusAz", robots: { index: false, follow: false } };

// Endereço de retorno registrado no app da Meta. Não lê nem guarda nada que venha na URL.
export default function RetornoMeta() {
  return (
    <div className="login">
      <div className="card">
        <div className="logo">Az</div>
        <h1 style={{ fontSize: 26 }}>Tudo certo</h1>
        <p className="muted">Pode fechar esta janela e voltar ao Estúdio JusAz.</p>
      </div>
    </div>
  );
}
