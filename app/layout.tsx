import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "edita.ai",
  description: "Edição profissional de Reels, com o seu vídeo sempre no seu computador.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
