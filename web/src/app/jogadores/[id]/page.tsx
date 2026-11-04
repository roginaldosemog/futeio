import type { Metadata } from "next";
import { AccessFrame } from "@/features/access/access-frame";
import { PlayerProfile } from "@/features/players/player-profile";

export const metadata: Metadata = {
  title: "Perfil do jogador | Futeio",
  robots: { index: false, follow: false },
};
export default async function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AccessFrame title="Perfil do jogador" wide>
      <PlayerProfile id={id} />
    </AccessFrame>
  );
}
