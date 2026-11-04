"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type SessionResponse } from "../access/access-client";
import { PrivateWorkspace, secondaryClass, usePrivateError } from "../access/private-workspace";
import { getEvaluations, getPlayer, ratePlayer } from "./players-client";
import { formatRating } from "@/lib/format";
import { ProfileEditor, RatingForm } from "./profile-forms";
import { PlayerLinkControls } from "./player-link-controls";

function ProfileContent({ id, session }: { id: string; session: SessionResponse }) {
  const client = useQueryClient();
  const scope = [session.groupId, session.identityId, id];
  const profile = useQuery({
    queryKey: ["profile", ...scope],
    queryFn: ({ signal }) => getPlayer(id, signal),
  });
  const evaluations = useQuery({
    queryKey: ["evaluations", ...scope],
    queryFn: ({ signal }) => getEvaluations(id, signal),
  });
  const [actionError, setActionError] = useState<unknown>();
  const [saved, setSaved] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(0);
  const expired = usePrivateError(profile.error, evaluations.error, actionError);
  const rating = useMutation({
    mutationFn: (value: number) => ratePlayer(id, value),
    onError: setActionError,
  });
  async function refresh() {
    await Promise.all([profile.refetch(), evaluations.refetch()]);
    await client.invalidateQueries({ queryKey: ["roster"] });
    setPhotoVersion((value) => value + 1);
  }
  async function saveRating(value: number) {
    setSaved(false);
    setActionError(undefined);
    try {
      await rating.mutateAsync(value);
      setSaved(true);
      await refresh();
    } catch {
      /* The mutation error is presented below. */
    }
  }
  if (expired) return <p role="status">Verificando seu acesso...</p>;
  if (profile.isPending) return <p role="status">Carregando perfil...</p>;
  if (profile.isError)
    return (
      <div>
        <p role="alert" className="text-[#8b3028]">
          Não foi possível abrir este perfil. Ele pode não estar disponível no seu grupo.
        </p>
        <button className={`${secondaryClass} mt-5`} onClick={() => void profile.refetch()}>
          Tentar novamente
        </button>
      </div>
    );
  const player = profile.data;
  const table = evaluations.data;
  const ownRating = table?.evaluations.find((row) => row.isOwn)?.rating;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-6">
        {player.photoUrl ? (
          <div className="size-24 shrink-0 overflow-hidden rounded-xl bg-[#d6e2db]">
            {/* Private images must use the authenticated same-origin endpoint directly. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${player.photoUrl}?v=${photoVersion}`}
              alt={`Foto de ${player.name}`}
              width={96}
              height={96}
              className="size-full object-cover"
            />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-3xl font-bold break-words [overflow-wrap:anywhere]">{player.name}</h2>
          <p className="mt-2 text-[#3c5b4b]">
            {player.isOwnProfile ? "Seu perfil" : "Jogador da pelada"}
          </p>
        </div>
      </div>
      <div className="mt-8 border-y border-[#d6e2db] py-6">
        <p className="text-sm text-[#3c5b4b]">Nota consolidada</p>
        <p className="mt-1 text-4xl font-bold tabular-nums">
          {formatRating(table?.rating ?? player.rating)}
          <span className="ml-2 text-base font-normal text-[#3c5b4b]">/ 10</span>
        </p>
        {table ? (
          <p className="mt-3 text-sm leading-relaxed text-[#3c5b4b]">
            {table.evaluationCount}{" "}
            {table.evaluationCount === 1 ? "avaliação vigente" : "avaliações vigentes"}.{" "}
            {table.discardedPerSide
              ? `O cálculo desconsidera ${table.discardedPerSide === 1 ? "a menor e a maior nota" : "as duas menores e as duas maiores notas"}.`
              : "Média das notas vigentes; com uma nota, vale a contribuição inicial."}
          </p>
        ) : null}
      </div>
      <section className="mt-8" aria-labelledby="rate-heading">
        <h2 id="rate-heading" className="mb-5 text-2xl font-bold">
          {player.isOwnProfile ? "Sua autoavaliação" : "Avaliar jogador"}
        </h2>
        {evaluations.isPending ? (
          <p role="status">Carregando sua avaliação...</p>
        ) : evaluations.isError ? (
          <div>
            <p role="alert" className="text-[#8b3028]">
              Não foi possível carregar as avaliações.
            </p>
            <button className={`${secondaryClass} mt-4`} onClick={() => void evaluations.refetch()}>
              Tentar novamente
            </button>
          </div>
        ) : (
          <RatingForm
            key={`${id}-${ownRating ?? "pending"}`}
            current={ownRating}
            pending={rating.isPending}
            onSave={saveRating}
          />
        )}
        {saved ? (
          <p role="status" className="mt-5">
            Avaliação salva.
          </p>
        ) : null}
        {rating.isError ? (
          <p role="alert" className="mt-5 text-[#8b3028]">
            Não foi possível salvar sua avaliação. Confira a nota e tente novamente.
          </p>
        ) : null}
      </section>
      {table ? (
        <section className="mt-12 border-t border-[#d6e2db] pt-8" aria-labelledby="ratings-heading">
          <h2 id="ratings-heading" className="text-2xl font-bold">
            Avaliações recebidas
          </h2>
          <p className="mt-4 max-w-[65ch] text-sm leading-relaxed text-[#3c5b4b]">
            {session.role === "ADMIN"
              ? "Como administrador, você pode ver os autores. Cada pessoa altera somente a própria nota."
              : "Somente sua autoria é identificada. As outras avaliações são anônimas para os jogadores."}
          </p>
          <table className="mt-6 w-full border-collapse text-left">
            <caption className="sr-only">Notas recebidas por {player.name}</caption>
            <thead>
              <tr className="border-b border-[#6b8576]">
                <th scope="col" className="py-3 pr-4 font-semibold">
                  Avaliador
                </th>
                <th scope="col" className="py-3 text-right font-semibold">
                  Nota
                </th>
              </tr>
            </thead>
            <tbody>
              {table.evaluations.map((row, index) => (
                <tr key={index} className="border-b border-[#d6e2db]">
                  <td className="py-4 pr-4 break-words [overflow-wrap:anywhere]">
                    {row.isOwn
                      ? `Você${row.authorName ? ` · ${row.authorName}` : ""}`
                      : (row.authorName ?? "Avaliação anônima")}
                  </td>
                  <td className="py-4 text-right font-semibold tabular-nums">{row.rating}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      {player.canEdit ? (
        <ProfileEditor
          key={player.id}
          id={id}
          name={player.name}
          hasPhoto={Boolean(player.photoUrl)}
          onSaved={refresh}
          onFailure={setActionError}
        />
      ) : null}
      {session.role === "ADMIN" ? <PlayerLinkControls id={id} onFailure={setActionError} /> : null}
    </div>
  );
}

export function PlayerProfile({ id }: { id: string }) {
  return (
    <PrivateWorkspace>
      {(session) => <ProfileContent key={id} id={id} session={session} />}
    </PrivateWorkspace>
  );
}
