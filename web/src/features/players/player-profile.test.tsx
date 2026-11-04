import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { currentSession, AccessError } from "../access/access-client";
import { getEvaluations, getPlayer, ratePlayer } from "./players-client";
import { PlayerProfile } from "./player-profile";

jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));
jest.mock("../access/access-client", () => ({
  ...jest.requireActual("../access/access-client"),
  currentSession: jest.fn(),
}));
jest.mock("./players-client", () => ({
  getPlayer: jest.fn(),
  getEvaluations: jest.fn(),
  ratePlayer: jest.fn(),
}));
const replace = jest.fn();
beforeEach(() => {
  replace.mockClear();
  jest.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);
  jest
    .mocked(currentSession)
    .mockResolvedValue({ role: "PLAYER", identityId: "identity", groupId: "group" });
  jest
    .mocked(getPlayer)
    .mockResolvedValue({
      id: "player",
      name: "Beto",
      rating: 8,
      isOwnProfile: false,
      canEdit: false,
    });
  jest.mocked(getEvaluations).mockResolvedValue({
    rating: 8,
    evaluationCount: 2,
    discardedPerSide: 0,
    calculationVersion: "trimmed-mean-v1",
    evaluations: [
      { rating: 7, isOwn: false },
      { rating: 9, isOwn: true, authorName: "Ana" },
    ],
  });
  jest.mocked(ratePlayer).mockReset();
});
it("renders only the viewer's authorship and does not offer editing another player's profile", async () => {
  render(<PlayerProfile id="player" />);
  const table = await screen.findByRole("table", { name: "Notas recebidas por Beto" });
  expect(within(table).getByText("Avaliação anônima")).toBeInTheDocument();
  expect(within(table).getByText("Você · Ana")).toBeInTheDocument();
  expect(screen.getByRole("combobox")).toHaveValue("9");
  expect(screen.queryByRole("textbox", { name: "Nome" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Gerar novo link" })).not.toBeInTheDocument();
});
it("updates one contribution and refreshes the consolidated rating", async () => {
  const user = userEvent.setup();
  jest.mocked(ratePlayer).mockResolvedValue(undefined);
  render(<PlayerProfile id="player" />);
  await user.selectOptions(await screen.findByRole("combobox"), "10");
  await user.click(screen.getByRole("button", { name: "Atualizar avaliação" }));
  expect(await screen.findByText("Avaliação salva.")).toBeInTheDocument();
  expect(ratePlayer).toHaveBeenCalledWith("player", 10);
  expect(getEvaluations).toHaveBeenCalledTimes(2);
});
it("hides private content when the session is revoked during an evaluation", async () => {
  const user = userEvent.setup();
  jest.mocked(ratePlayer).mockRejectedValue(new AccessError(401));
  render(<PlayerProfile id="player" />);
  await user.click(await screen.findByRole("button", { name: "Atualizar avaliação" }));
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/entrar"));
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Beto" })).not.toBeInTheDocument();
});
