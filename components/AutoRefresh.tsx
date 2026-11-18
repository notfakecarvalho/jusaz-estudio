"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Atualiza a página sozinha para mostrar comentários e mensagens novos.
export function AutoRefresh({ segundos = 30 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), segundos * 1000);
    return () => clearInterval(t);
  }, [router, segundos]);
  return null;
}
