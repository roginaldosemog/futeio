import type { Metadata } from "next";
import { AccessFrame } from "@/features/access/access-frame";
import { DrawCreation } from "@/features/draws/draw-creation";
export const metadata: Metadata = {
  title: "Montar times | Futeio",
  robots: { index: false, follow: false },
};
export default function DrawCreationPage() {
  return (
    <AccessFrame
      title="Quem joga hoje?"
      description="20 jogadores de linha, quatro times de cinco."
      wide
    >
      <DrawCreation />
    </AccessFrame>
  );
}
