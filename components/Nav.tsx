"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, React.ReactNode> = {
  hoje: <path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  roteiros: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4M9 12h6M9 16h6" />
    </>
  ),
  fila: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  videos: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M10 9l5 3-5 3z" />
    </>
  ),
  conexoes: <path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4" />,
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17" cy="7" r="0.6" />
    </>
  ),
  tiktok: <path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5M14 4c.4 2.4 2 4 4.5 4.2" />,
  insights: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  funil: <path d="M3 4h18l-7 9v6l-4 2v-8z" />,
  mensagens: <path d="M4 5h16v11H9l-5 4z" />,
  reels: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 3v18M17 3v18M3 12h18" />
    </>
  ),
  estilos: <path d="m12 2 10 5-10 5L2 7zM2 17l10 5 10-5M2 12l10 5 10-5" />,
  creditos: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" />
    </>
  ),
  agente: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  ideias: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" />,
};

const REELS = [
  { href: "/reels", key: "reels", label: "Reels" },
  { href: "/reels/estilos", key: "estilos", label: "Estilos" },
  { href: "/reels/creditos", key: "creditos", label: "Créditos" },
  { href: "/reels/agente", key: "agente", label: "Agente local" },
];

const ESTUDIO = [
  { href: "/", key: "hoje", label: "Hoje" },
  { href: "/roteiros", key: "roteiros", label: "Roteiros" },
  { href: "/fila", key: "fila", label: "Fila" },
  { href: "/videos", key: "videos", label: "Vídeos" },
  { href: "/instagram", key: "instagram", label: "Instagram" },
  { href: "/tiktok", key: "tiktok", label: "TikTok" },
  { href: "/insights", key: "insights", label: "Insights" },
  { href: "/funil", key: "funil", label: "Funil" },
  { href: "/mensagens", key: "mensagens", label: "Mensagens" },
  { href: "/ideias", key: "ideias", label: "Ideias" },
  { href: "/conexoes", key: "conexoes", label: "Conexões" },
];

type Item = { href: string; key: string; label: string };

export function Nav({ admin = false }: { admin?: boolean }) {
  const path = usePathname();
  const ativo = (href: string) => {
    if (href === "/") return path === "/";
    if (href === "/reels") return path.startsWith("/reels") && !["estilos", "creditos", "agente"].some((x) => path === "/reels/" + x);
    return path.startsWith(href);
  };
  const lista = (itens: Item[]) =>
    itens.map((i) => {
      const on = ativo(i.href);
      return (
        <Link key={i.href} href={i.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICONS[i.key]}
          </svg>
          {i.label}
        </Link>
      );
    });
  return (
    <nav className="nav" aria-label="Principal">
      <span className="nav-grupo">Reels</span>
      {lista(REELS)}
      {admin && (
        <>
          <span className="nav-grupo">Estúdio JusAz</span>
          {lista(ESTUDIO)}
        </>
      )}
    </nav>
  );
}
