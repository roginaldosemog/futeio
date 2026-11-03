"use client";

import { useId, useState } from "react";
import type { FormEvent } from "react";

export interface AdminLoginFormProps {
  onSubmit: (email: string, password: string) => Promise<boolean>;
  pending: boolean;
  errorMessage?: string;
}

export function AdminLoginForm({
  onSubmit,
  pending,
  errorMessage,
}: AdminLoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const emailId = useId();
  const passwordId = useId();
  const hintId = `${emailId}-hint`;
  const errorId = `${emailId}-error`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending && (await onSubmit(email.trim(), password))) setPassword("");
  }

  return (
    <form method="post" onSubmit={handleSubmit} aria-busy={pending}>
      <label className="block text-base font-semibold" htmlFor={emailId}>
        E-mail
      </label>
      <p className="mt-2 text-sm leading-relaxed text-[#3c5b4b]" id={hintId}>
        Use o e-mail autorizado para administrar a pelada.
      </p>
      <input
        className="mt-3 min-h-13 w-full rounded-xl border border-[#6b8576] bg-white px-4 py-3 text-base text-[#163b2a] caret-[#286548] disabled:bg-[#edf2ef] disabled:text-[#3c5b4b]"
        id={emailId}
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        spellCheck={false}
        autoCapitalize="none"
        aria-describedby={errorMessage ? `${hintId} ${errorId}` : hintId}
        maxLength={254}
        required
        disabled={pending}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <label className="mt-6 block text-base font-semibold" htmlFor={passwordId}>
        Senha
      </label>
      <input
        className="mt-3 min-h-13 w-full rounded-xl border border-[#6b8576] bg-white px-4 py-3 text-base text-[#163b2a] caret-[#286548] disabled:bg-[#edf2ef] disabled:text-[#3c5b4b]"
        id={passwordId}
        name="password"
        type="password"
        autoComplete="current-password"
        aria-describedby={errorMessage ? errorId : undefined}
        maxLength={256}
        required
        disabled={pending}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <button
        className="mt-5 min-h-13 w-full rounded-xl bg-[#163b2a] px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-[#22533d] disabled:cursor-wait disabled:bg-[#d6e2db] disabled:text-[#3c5b4b] motion-reduce:transition-none"
        type="submit"
        disabled={pending}
      >
        {pending ? "Entrando..." : "Entrar"}
      </button>

      {errorMessage ? (
        <p className="mt-6 text-base leading-relaxed text-[#8b3028]" id={errorId} role="alert">
          {errorMessage}
        </p>
      ) : null}
      <p className="mt-6 text-sm leading-relaxed text-[#3c5b4b]">
        Acesso exclusivo ao administrador da pelada.
      </p>
    </form>
  );
}
