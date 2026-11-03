"use client";

export interface AdminSessionPanelProps {
  email?: string;
  onLogout: () => void;
  pending: boolean;
  errorMessage?: string;
}

export function AdminSessionPanel({
  email,
  onLogout,
  pending,
  errorMessage,
}: AdminSessionPanelProps) {
  return (
    <div aria-busy={pending}>
      <p className="text-base leading-relaxed text-[#3c5b4b]">
        {email ? (
          <>
            Você entrou com{" "}
            <span className="font-semibold break-all text-[#163b2a]">{email}</span>.
          </>
        ) : (
          "Você entrou como administrador."
        )}
      </p>
      <p className="mt-5 text-base leading-relaxed text-[#3c5b4b]">
        O cadastro de jogadores será disponibilizado em uma próxima atualização.
      </p>
      <button
        className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl border border-[#6b8576] px-5 py-3 text-base font-semibold text-[#163b2a] transition-colors hover:bg-[#e7efea] disabled:cursor-wait disabled:bg-[#d6e2db] disabled:text-[#3c5b4b] motion-reduce:transition-none"
        type="button"
        disabled={pending}
        onClick={onLogout}
      >
        {pending ? "Saindo..." : "Sair"}
      </button>
      {errorMessage ? (
        <p className="mt-5 text-base leading-relaxed text-[#8b3028]" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
