"use client";

import { useState } from "react";

// Copia um texto para a área de transferência (a legenda do TikTok é colada pelo Erik no app).
export function Copiar({ texto, rotulo = "Copiar legenda" }: { texto: string; rotulo?: string }) {
  const [feito, setFeito] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setFeito(true);
      setTimeout(() => setFeito(false), 2000);
    } catch {
      setFeito(false);
    }
  }
  return (
    <button type="button" className="btn btn-s btn-sm" onClick={copiar} aria-live="polite">
      {feito ? "Copiado" : rotulo}
    </button>
  );
}
