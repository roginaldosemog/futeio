"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { CreatePlayerInput } from "./players-client";

export interface CreatePlayerFormProps {
  onSubmit: (input: CreatePlayerInput) => Promise<boolean>;
  pending: boolean;
  ownProfileExists: boolean;
  blocked?: boolean;
  focusName?: boolean;
  errorMessage?: string;
  /** Guidance that is not a failure, such as "the list was refreshed". */
  notice?: string;
}

export function CreatePlayerForm({ onSubmit, pending, ownProfileExists, blocked, focusName, errorMessage, notice }: CreatePlayerFormProps) {
  const [name, setName] = useState("");
  const [rating, setRating] = useState("");
  const [ownProfile, setOwnProfile] = useState(false);
  const submitting = useRef(false);
  const nameField = useRef<HTMLInputElement>(null);
  const id = useId();
  const errorId = `${id}-error`;
  const fieldClass = "mt-3 min-h-13 w-full rounded-xl border border-[#6b8576] bg-white px-4 py-3 text-base text-[#163b2a] caret-[#286548] disabled:bg-[#edf2ef] disabled:text-[#3c5b4b]";
  useEffect(() => { if (focusName) nameField.current?.focus(); }, [focusName]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || blocked || submitting.current) return;
    submitting.current = true;
    try {
      const saved = await onSubmit({ name: name.trim(), initialRating: Number(rating), linkToCurrentAdministrator: ownProfile && !ownProfileExists });
      if (saved) { setName(""); setRating(""); setOwnProfile(false); }
    } finally { submitting.current = false; }
  }

  return (
    <form method="post" onSubmit={handleSubmit} aria-busy={pending}>
      <label className="block text-base font-semibold" htmlFor={`${id}-name`}>Nome</label>
      <input className={fieldClass} id={`${id}-name`} ref={nameField} name="name" type="text" autoComplete="off" maxLength={100} required disabled={pending} value={name} onChange={(event) => setName(event.target.value)} aria-describedby={errorMessage ? errorId : undefined} />
      <label className="mt-6 block text-base font-semibold" htmlFor={`${id}-rating`}>Nota inicial</label>
      <p className="mt-2 text-sm leading-relaxed text-[#3c5b4b]" id={`${id}-rating-hint`}>Escolha um número inteiro de 0 a 10.</p>
      <input className={fieldClass} id={`${id}-rating`} name="initialRating" type="number" inputMode="numeric" min={0} max={10} step={1} required disabled={pending} value={rating} onChange={(event) => setRating(event.target.value)} aria-describedby={errorMessage ? `${id}-rating-hint ${errorId}` : `${id}-rating-hint`} />
      <label className="mt-6 flex min-h-12 cursor-pointer items-center gap-3 text-base font-semibold" htmlFor={`${id}-own`}>
        <input className="size-5 shrink-0 accent-[#163b2a]" id={`${id}-own`} name="linkToCurrentAdministrator" type="checkbox" disabled={pending || ownProfileExists} checked={ownProfile && !ownProfileExists} onChange={(event) => setOwnProfile(event.target.checked)} />
        Este é o meu perfil
      </label>
      <p className="mt-2 text-sm leading-relaxed text-[#3c5b4b]">{ownProfileExists ? "Seu perfil já está cadastrado." : "Marque apenas ao cadastrar você como jogador da pelada."}</p>
      <button className="mt-6 min-h-13 w-full rounded-xl bg-[#163b2a] px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-[#22533d] disabled:cursor-wait disabled:bg-[#d6e2db] disabled:text-[#3c5b4b] motion-reduce:transition-none" type="submit" disabled={pending || blocked}>{pending ? "Cadastrando..." : "Cadastrar jogador"}</button>
      {errorMessage ? <p className="mt-5 text-base leading-relaxed text-[#8b3028]" role="alert" id={errorId}>{errorMessage}</p> : null}
      {notice ? <p className="mt-5 text-base leading-relaxed text-[#3c5b4b]" role="status">{notice}</p> : null}
    </form>
  );
}
