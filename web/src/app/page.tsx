import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col">
      <a
        className="fixed left-6 top-4 z-10 -translate-y-24 rounded-lg bg-white px-4 py-3 font-semibold text-[#163b2a] underline underline-offset-4 focus:translate-y-0"
        href="#conteudo"
      >
        Pular para o conteúdo
      </a>

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-5 border-b border-[#d6e2db] px-6 py-7 sm:px-10 sm:py-9">
        <p className="text-2xl font-bold tracking-tight sm:text-3xl">Futeio</p>
        <Link
          className="inline-flex min-h-12 items-center rounded-xl border border-[#6b8576] px-5 py-3 font-semibold transition-colors hover:bg-[#e7efea] motion-reduce:transition-none"
          href="/entrar"
        >
          Entrar
        </Link>
      </header>

      <main
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-16 sm:px-10 sm:py-24"
        id="conteudo"
      >
        <h1 className="max-w-[15ch] text-4xl leading-[1.1] font-bold tracking-[-0.03em] text-balance sm:text-6xl lg:text-7xl">
          A turma se reúne. Os times se equilibram.
        </h1>
        <p className="mt-7 max-w-[52ch] text-lg leading-relaxed text-[#3c5b4b] sm:text-xl">
          Avalie quem joga com você, atualize seu perfil e acompanhe os times da próxima pelada. O
          Futeio reúne as notas da turma para ajudar no sorteio.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-5">
          <Link
            href="/jogadores"
            className="inline-flex min-h-12 items-center rounded-xl bg-[#163b2a] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#22533d] motion-reduce:transition-none"
          >
            Acessar a pelada
          </Link>
          <Link
            href="/entrar"
            className="inline-flex min-h-12 items-center font-semibold underline underline-offset-4"
          >
            Sou administrador
          </Link>
        </div>
        <p className="mt-6 max-w-[60ch] text-sm leading-relaxed text-[#3c5b4b]">
          É jogador e ainda não entrou? Abra o link pessoal enviado pelo administrador. Os perfis e
          as avaliações ficam dentro do grupo.
        </p>
      </main>

      <footer className="mx-auto w-full max-w-6xl border-t border-[#d6e2db] px-6 py-6 text-sm text-[#3c5b4b] sm:px-10">
        Feito com a pelada da turma em mente.
      </footer>
    </div>
  );
}
