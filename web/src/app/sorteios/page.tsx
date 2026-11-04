import type { Metadata } from "next";
import { AccessFrame } from "@/features/access/access-frame";
import { DrawHistory } from "@/features/draws/draw-history";
export const metadata: Metadata = {
  title: "Histórico de times | Futeio",
  robots: { index: false, follow: false },
};
export default function DrawHistoryPage() {
  return (
    <AccessFrame
      title="Os times da turma"
      description="Consulte os sorteios e as notas usadas em cada resultado."
      wide
    >
      <DrawHistory />
    </AccessFrame>
  );
}
