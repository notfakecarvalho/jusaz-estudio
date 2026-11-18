import Link from "next/link";

// Alterna a aba Insights entre Instagram e TikTok.
export function FonteInsights({ atual }: { atual: "instagram" | "tiktok" }) {
  return (
    <div className="seg" role="group" aria-label="Rede social">
      <Link href="/insights" className={atual === "instagram" ? "on" : ""} aria-current={atual === "instagram" ? "true" : undefined}>Instagram</Link>
      <Link href="/insights?r=tiktok" className={atual === "tiktok" ? "on" : ""} aria-current={atual === "tiktok" ? "true" : undefined}>TikTok</Link>
    </div>
  );
}
