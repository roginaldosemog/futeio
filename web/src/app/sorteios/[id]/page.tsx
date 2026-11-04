import type { Metadata } from "next";
import { AccessFrame } from "@/features/access/access-frame";
import { DrawResult } from "@/features/draws/draw-result";
export const metadata: Metadata = {
  title: "Times sorteados | Futeio",
  robots: { index: false, follow: false },
};
export default async function DrawResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AccessFrame title="Times prontos para jogar" wide>
      <DrawResult id={id} />
    </AccessFrame>
  );
}
