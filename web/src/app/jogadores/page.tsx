import type { Metadata } from "next";
import { AccessFrame } from "@/features/access/access-frame";
import { Roster } from "@/features/players/roster";

export const metadata: Metadata = {
  title: "Jogadores e avaliações | Futeio",
  robots: { index: false, follow: false },
};
export default function RosterPage() {
  return (
    <AccessFrame
      title="A turma da pelada"
      description="As notas ajudam a montar os próximos times."
      wide
    >
      <Roster />
    </AccessFrame>
  );
}
