"use client";
import { useCallback, useEffect } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { pingAgente, sb } from "@/lib/reels";

// Faixa fina no topo das telas de Reels: saldo, estado do agente local e atalho de novo Reel.
// Também faz a navegação interna dos links <a href="/reels/..."> sem recarregar a página.
export function ReelsBar() {
  const router = useRouter();
  const [saldo, setSaldo] = useState<number | null>(null);
  const [agente, setAgente] = useState<unknown>(null);

  const atualizar = useCallback(async () => {
    const [s, a] = await Promise.all([sb.rpc("saldo"), pingAgente()]);
    setSaldo(s.data as number | null);
    setAgente(a);
  }, []);

  useEffect(() => {
    atualizar();
    const t = setInterval(atualizar, 10000);
    return () => clearInterval(t);
  }, [atualizar]);

  useEffect(() => {
    const clique = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest?.("a");
      if (!a || a.target || a.hasAttribute("download")) return;
      const href = a.getAttribute("href") || "";
      if (!href.startsWith("/reels")) return;
      e.preventDefault();
      router.push(href);
    };
    document.addEventListener("click", clique);
    return () => document.removeEventListener("click", clique);
  }, [router]);

  return (
    <div className="ed-bar">
      <Link href="/reels/creditos" className="saldo-pill" aria-label={"Saldo: " + (saldo ?? "carregando") + " créditos"}>
        <b>{saldo ?? "–"}</b> créditos
      </Link>
      <Link href="/reels/agente" className="agente-st">
        <span className={"ponto " + (agente ? "on" : "off")} />
        <span>{agente ? "Agente online" : "Agente offline"}</span>
      </Link>
      <Link href="/reels/novo" className="btn escuro" style={{ height: 34, marginLeft: "auto" }}>
        Novo Reel
      </Link>
    </div>
  );
}
