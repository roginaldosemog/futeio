import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Futeio | Futebol com a sua turma",
  description:
    "O Futeio está em construção. Estamos preparando a primeira versão para ajudar na organização da pelada da turma.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
