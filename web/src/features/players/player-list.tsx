import type { PlayerSummary } from "./players-client";

export function PlayerList({ players }: { players: PlayerSummary[] }) {
  if (!players.length) return <p className="text-base leading-relaxed text-[#3c5b4b]">Nenhum jogador cadastrado ainda.</p>;
  return (
    <ul aria-label="Jogadores cadastrados" className="divide-y divide-[#d6e2db] border-y border-[#d6e2db]">
      {players.map((player) => (
        <li className="flex min-h-20 items-center justify-between gap-5 py-4" key={player.id}>
          <div className="min-w-0">
            <p className="font-semibold break-words [overflow-wrap:anywhere]">{player.name}</p>
            {player.isOwnProfile ? <p className="mt-1 text-sm text-[#3c5b4b]">Seu perfil</p> : null}
          </div>
          <p className="shrink-0 text-sm font-semibold text-[#3c5b4b] tabular-nums">Nota: {player.rating}</p>
        </li>
      ))}
    </ul>
  );
}
