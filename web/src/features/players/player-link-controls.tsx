"use client";

import { useRef, useState } from "react";
import { buttonClass, secondaryClass } from "../access/private-workspace";
import { revokeLink, rotateLink } from "./players-client";

export function PlayerLinkControls({
  id,
  onFailure,
}: {
  id: string;
  onFailure: (error: unknown) => void;
}) {
  const [action, setAction] = useState<"rotate" | "revoke" | null>(null);
  const [pending, setPending] = useState(false);
  const [url, setUrl] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const lock = useRef(false);
  async function confirm() {
    if (!action || pending || lock.current) return;
    lock.current = true;
    setPending(true);
    setUrl(undefined);
    setNotice(undefined);
    setError(undefined);
    try {
      if (action === "rotate") {
        const result = await rotateLink(id);
        setUrl(result.accessUrl);
        setNotice("Novo link gerado. O acesso anterior foi encerrado.");
      } else {
        await revokeLink(id);
        setNotice("Acesso revogado. Gere um novo link para permitir outra entrada.");
      }
      setAction(null);
    } catch (failure) {
      onFailure(failure);
      setError(
        "Não foi possível confirmar a mudança de acesso. Tente gerar um novo link antes de compartilhá-lo.",
      );
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Link copiado.");
    } catch {
      setError("Selecione o link e copie manualmente.");
    }
  }
  return (
    <section
      aria-labelledby="player-access-heading"
      className="mt-12 border-t border-[#d6e2db] pt-8"
    >
      <h2 id="player-access-heading" className="text-2xl font-bold">
        Acesso do jogador
      </h2>
      <p className="mt-4 max-w-[65ch] leading-relaxed text-[#3c5b4b]">
        Gerar outro link ou revogar o acesso encerra todas as sessões abertas com o link anterior. O
        perfil e as avaliações são preservados.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          className={secondaryClass}
          disabled={pending}
          onClick={() => {
            setAction("rotate");
            setUrl(undefined);
            setNotice(undefined);
          }}
        >
          Gerar novo link
        </button>
        <button
          className={secondaryClass}
          disabled={pending}
          onClick={() => {
            setAction("revoke");
            setUrl(undefined);
            setNotice(undefined);
          }}
        >
          Revogar acesso
        </button>
      </div>
      {action ? (
        <div className="mt-5 rounded-xl border border-[#6b8576] p-5">
          <p className="font-semibold">
            {action === "rotate"
              ? "Substituir o link atual e encerrar as sessões?"
              : "Encerrar as sessões e bloquear o link atual?"}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className={buttonClass} disabled={pending} onClick={confirm}>
              {pending
                ? "Confirmando..."
                : action === "rotate"
                  ? "Confirmar novo link"
                  : "Confirmar revogação"}
            </button>
            <button className={secondaryClass} disabled={pending} onClick={() => setAction(null)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
      {notice ? (
        <p role="status" className="mt-5">
          {notice}
        </p>
      ) : null}
      {url ? (
        <div className="mt-5">
          <p className="text-sm font-semibold">Link pessoal — compartilhe individualmente</p>
          <p className="mt-3 select-all rounded-xl border border-[#6b8576] bg-white p-4 text-sm leading-relaxed break-all">
            {url}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className={buttonClass} onClick={copy}>
              Copiar link
            </button>
            <button
              className={secondaryClass}
              onClick={() => {
                setUrl(undefined);
                setNotice(undefined);
              }}
            >
              Ocultar link
            </button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-5 text-[#8b3028]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
