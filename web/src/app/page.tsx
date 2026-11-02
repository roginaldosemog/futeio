export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col">
      <a
        className="fixed left-6 top-4 z-10 -translate-y-24 rounded-lg bg-white px-4 py-3 font-semibold text-[#163b2a] underline underline-offset-4 focus:translate-y-0"
        href="#conteudo"
      >
        Pular para o conteúdo
      </a>

      <header className="mx-auto w-full max-w-6xl border-b border-[#d6e2db] px-6 py-7 sm:px-10 sm:py-9">
        <p className="text-2xl font-bold tracking-tight sm:text-3xl">Futeio</p>
      </header>

      <main
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-16 sm:px-10 sm:py-24"
        id="conteudo"
      >
        <h1 className="max-w-[15ch] text-4xl leading-[1.1] font-bold tracking-[-0.03em] text-balance sm:text-6xl lg:text-7xl">
          A pelada da turma, com mais organização.
        </h1>
        <p className="mt-7 max-w-[52ch] text-lg leading-relaxed text-[#3c5b4b] sm:text-xl">
          Estamos construindo o Futeio para ajudar a organizar o futebol de quem
          joga junto. A primeira versão está sendo preparada para uma pelada real.
        </p>
        <p className="mt-10 flex items-center gap-3 text-sm font-semibold text-[#286548] sm:text-base">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full bg-[#286548]"
          />
          Em desenvolvimento
        </p>
      </main>

      <footer className="mx-auto w-full max-w-6xl border-t border-[#d6e2db] px-6 py-6 text-sm text-[#3c5b4b] sm:px-10">
        Feito com a pelada da turma em mente.
      </footer>
    </div>
  );
}
