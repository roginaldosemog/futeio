import Link from "next/link";
import type { ReactNode } from "react";

export interface AccessFrameProps {
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}

export function AccessFrame({ title, description, children, wide = false }: AccessFrameProps) {
  return (
    <div className="flex min-h-svh flex-col">
      <a
        className="fixed top-4 left-6 z-10 -translate-y-24 rounded-lg bg-white px-4 py-3 font-semibold text-[#163b2a] underline underline-offset-4 focus:translate-y-0"
        href="#conteudo"
      >
        Pular para o conteúdo
      </a>

      <header className="mx-auto w-full max-w-6xl border-b border-[#d6e2db] px-6 py-7 sm:px-10 sm:py-9">
        <Link
          className="inline-block text-2xl font-bold tracking-tight sm:text-3xl"
          href="/"
          aria-label="Futeio — página inicial"
        >
          Futeio
        </Link>
      </header>

      <main
        className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 sm:px-10 sm:py-20"
        id="conteudo"
      >
        <div className={`mx-auto w-full ${wide ? "max-w-4xl" : "max-w-lg"}`}>
          <h1 className="text-3xl leading-tight font-bold tracking-[-0.025em] text-balance sm:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-4 text-base leading-relaxed text-[#3c5b4b] sm:text-lg">
              {description}
            </p>
          ) : null}
          <div className="mt-8">{children}</div>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-6xl border-t border-[#d6e2db] px-6 py-6 text-sm text-[#3c5b4b] sm:px-10">
        Feito com a pelada da turma em mente.
      </footer>
    </div>
  );
}
