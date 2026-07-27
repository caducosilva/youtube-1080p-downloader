import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Baixador de videos do YouTube",
  description:
    "Cole o link de um video ou playlist, escolha MP4 ou MP3 e baixe com qualidade e FPS definidos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col app-shell">{children}</body>
    </html>
  );
}
