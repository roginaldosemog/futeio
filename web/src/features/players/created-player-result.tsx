"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CreatePlayerResult } from "./players-client";

export function CreatedPlayerResult({ result, onNext }: { result: CreatePlayerResult; onNext: () => void }) {
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [copying, setCopying] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string>();
  const [copyFailed, setCopyFailed] = useState(false);
  useEffect(() => { heading.current?.focus(); }, []);

  async function copyLink() {
    setCopying(true);
    setCopyMessage(undefined);
    setCopyFailed(false);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(result.accessUrl);
      setCopyMessage("Link copiado.");
    } catch {
      setCopyFailed(true);
      setCopyMessage("Não foi possível copiar. Selecione o link e copie manualmente.");
    } finally { setCopying(false); }
  }

  return (
    <section aria-labelledby={id}>
      <h2 id={id} ref={heading} tabIndex={-1} className="text-2xl leading-tight font-bold">Jogador cadastrado</h2>
      <p className="mt-4 text-base leading-relaxed text-[#3c5b4b]"><span className="font-semibold break-words [overflow-wrap:anywhere] text-[#163b2a]">{result.player.name}</span> já está na lista, com nota {result.player.rating}.</p>
      <p className="mt-6 text-sm font-semibold">Link pessoal do jogador</p>
      <p className="mt-3 select-all rounded-xl border border-[#6b8576] bg-white p-4 text-sm leading-relaxed break-all">{result.accessUrl}</p>
      <p className="mt-4 text-sm leading-relaxed text-[#3c5b4b]">Este link aparece somente agora. O acesso dos jogadores ainda não está disponível; guarde o link para compartilhar individualmente.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" className="min-h-12 rounded-xl bg-[#163b2a] px-5 py-3 font-semibold text-white transition-colors hover:bg-[#22533d] disabled:cursor-wait disabled:bg-[#d6e2db] disabled:text-[#3c5b4b] motion-reduce:transition-none" disabled={copying} onClick={copyLink}>{copying ? "Copiando..." : "Copiar link"}</button>
        <button type="button" className="min-h-12 rounded-xl border border-[#6b8576] px-5 py-3 font-semibold transition-colors hover:bg-[#e7efea] motion-reduce:transition-none" onClick={onNext}>Cadastrar outro jogador</button>
      </div>
      {copyMessage ? <p className={`mt-4 text-sm leading-relaxed ${copyFailed ? "text-[#8b3028]" : "text-[#3c5b4b]"}`} role={copyFailed ? "alert" : "status"}>{copyMessage}</p> : null}
    </section>
  );
}
