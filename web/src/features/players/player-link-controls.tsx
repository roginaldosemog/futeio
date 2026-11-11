"use client";

import { useMachine } from "@/lib/machine";
import { buttonClass, secondaryClass } from "../access/private-workspace";
import { initialLinkAccess, linkAccessTransition } from "./link-access-machine";
import { revokeLink, rotateLink } from "./players-client";

export function PlayerLinkControls({
  id,
  onFailure,
}: {
  id: string;
  onFailure: (error: unknown) => void;
}) {
  const [state, send] = useMachine(linkAccessTransition, initialLinkAccess);
  async function confirm() {
    // The machine is the lock: a second click is ignored while submitting.
    const submission = send({ type: "confirm" });
    if (submission?.status !== "submitting") return;
    try {
      if (submission.action === "rotate") {
        const result = await rotateLink(id);
        send({ type: "rotated", url: result.accessUrl });
      } else {
        await revokeLink(id);
        send({ type: "revoked" });
      }
    } catch (failure) {
      onFailure(failure);
      send({ type: "failed" });
    }
  }
  async function copy() {
    if (state.status !== "rotated") return;
    try {
      await navigator.clipboard.writeText(state.url);
      send({ type: "copied" });
    } catch {
      send({ type: "copyUnavailable" });
    }
  }
  const pending = state.status === "submitting";
  const action =
    state.status === "confirming" || state.status === "submitting" || state.status === "failed"
      ? state.action
      : null;
  const notice =
    state.status === "revoked"
      ? "Acesso revogado. Gere um novo link para permitir outra entrada."
      : state.status === "rotated"
        ? state.copy === "copied"
          ? "Link copiado."
          : "Novo link gerado. O acesso anterior foi encerrado."
        : undefined;
  const error =
    state.status === "failed"
      ? "Não foi possível confirmar a mudança de acesso. Tente gerar um novo link antes de compartilhá-lo."
      : state.status === "rotated" && state.copy === "unavailable"
        ? "Selecione o link e copie manualmente."
        : undefined;
  const url = state.status === "rotated" ? state.url : undefined;
  return (
    <section
      aria-labelledby="player-access-heading"
      className="mt-12 border-t border-[#d6e2db] pt-8"
      data-state={state.status}
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
          onClick={() => send({ type: "choose", action: "rotate" })}
        >
          Gerar novo link
        </button>
        <button
          className={secondaryClass}
          disabled={pending}
          onClick={() => send({ type: "choose", action: "revoke" })}
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
            <button
              className={secondaryClass}
              disabled={pending}
              onClick={() => send({ type: "cancel" })}
            >
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
              onClick={() => send({ type: "hide" })}
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
