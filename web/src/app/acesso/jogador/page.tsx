import type { Metadata } from "next";
import { AccessFrame } from "@/features/access/access-frame";
import { PlayerAccess } from "@/features/access/player-access";

export const metadata: Metadata = {
  title: "Acesso do jogador | Futeio",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function PlayerAccessPage() {
  return (
    <AccessFrame title="Entre na sua pelada">
      <PlayerAccess />
    </AccessFrame>
  );
}
