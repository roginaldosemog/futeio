import type { Metadata } from "next";
import { AccessFrame } from "@/features/access/access-frame";
import { PlayersAdministration } from "@/features/players/players-administration";

export const metadata: Metadata = { title: "Jogadores | Futeio", robots: { index: false, follow: false } };

export default function PlayersPage() {
  return (
    <AccessFrame title="Jogadores da pelada" description="Cadastre quem joga com a turma e atribua uma nota inicial." wide>
      <PlayersAdministration />
    </AccessFrame>
  );
}
