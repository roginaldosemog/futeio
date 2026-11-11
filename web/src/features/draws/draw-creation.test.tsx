import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { AccessError } from "@/lib/api-client";
import { currentSession } from "../access/access-client";
import { listPlayers } from "../players/players-client";
import { createDraw } from "./draws-client";
import { DrawCreation } from "./draw-creation";

jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));
jest.mock("../access/access-client", () => ({
  ...jest.requireActual("../access/access-client"),
  currentSession: jest.fn(),
}));
jest.mock("../players/players-client", () => ({ listPlayers: jest.fn() }));
jest.mock("./draws-client", () => ({ createDraw: jest.fn() }));
const replace = jest.fn();
const push = jest.fn();
beforeEach(() => {
  replace.mockClear();
  push.mockClear();
  jest.mocked(listPlayers).mockClear();
  jest.mocked(createDraw).mockReset();
  jest
    .mocked(useRouter)
    .mockReturnValue({ replace, push } as unknown as ReturnType<typeof useRouter>);
  jest
    .mocked(currentSession)
    .mockResolvedValue({ role: "ADMIN", identityId: "admin", groupId: "group" });
  jest.mocked(listPlayers).mockResolvedValue(
    Array.from({ length: 21 }, (_, index) => ({
      id: `player-${index}`,
      name: `Jogador ${index}`,
      rating: 7,
      isOwnProfile: false,
    })),
  );
});
it("requires exactly twenty players and sends only their identifiers", async () => {
  const user = userEvent.setup();
  jest
    .mocked(createDraw)
    .mockResolvedValue({ id: "draw-id" } as Awaited<ReturnType<typeof createDraw>>);
  render(<DrawCreation />);
  const boxes = await screen.findAllByRole("checkbox");
  expect(screen.getByRole("button", { name: "Sortear 4 times" })).toBeDisabled();
  for (const box of boxes.slice(0, 20)) fireEvent.click(box);
  expect(boxes[20]).toBeDisabled();
  expect(screen.getByText("20 de 20 selecionados")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Sortear 4 times" }));
  expect(jest.mocked(createDraw).mock.calls[0]?.[0]).toEqual(
    Array.from({ length: 20 }, (_, index) => `player-${index}`),
  );
  await waitFor(() => expect(push).toHaveBeenCalledWith("/sorteios/draw-id"));
});
it("lets the administrator clear a selection without creating a draw", async () => {
  const user = userEvent.setup();
  render(<DrawCreation />);
  const boxes = await screen.findAllByRole("checkbox");
  await user.click(boxes[0]);
  await user.click(screen.getByRole("button", { name: "Limpar seleção" }));
  expect(boxes[0]).not.toBeChecked();
  expect(screen.getByText("0 de 20 selecionados")).toBeInTheDocument();
  expect(createDraw).not.toHaveBeenCalled();
});
it("keeps a player session out of the administrator selection screen", async () => {
  jest
    .mocked(currentSession)
    .mockResolvedValue({ role: "PLAYER", identityId: "player", groupId: "group" });
  render(<DrawCreation />);
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/jogadores"));
  expect(listPlayers).not.toHaveBeenCalled();
});
it("blocks a second draw after an uncertain response and points to the history", async () => {
  const user = userEvent.setup();
  jest.mocked(createDraw).mockRejectedValue(new AccessError(503));
  render(<DrawCreation />);
  const boxes = await screen.findAllByRole("checkbox");
  for (const box of boxes.slice(0, 20)) fireEvent.click(box);
  await user.click(screen.getByRole("button", { name: "Sortear 4 times" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Confira o histórico");
  expect(screen.getByRole("button", { name: "Sortear 4 times" })).toBeDisabled();
  expect(
    screen.getByRole("link", { name: "Conferir histórico antes de sortear novamente" }),
  ).toHaveAttribute("href", "/sorteios");
  expect(createDraw).toHaveBeenCalledTimes(1);
});
it("keeps the form closed after a recorded draw so a second click cannot record another", async () => {
  const user = userEvent.setup();
  jest
    .mocked(createDraw)
    .mockResolvedValue({ id: "draw-id" } as Awaited<ReturnType<typeof createDraw>>);
  render(<DrawCreation />);
  const boxes = await screen.findAllByRole("checkbox");
  for (const box of boxes.slice(0, 20)) fireEvent.click(box);
  const submit = screen.getByRole("button", { name: "Sortear 4 times" });
  await user.click(submit);
  await waitFor(() => expect(push).toHaveBeenCalledWith("/sorteios/draw-id"));
  expect(submit).toBeDisabled();
  fireEvent.submit(submit.closest("form")!);
  expect(createDraw).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("link", { name: "Ver os times" })).toHaveAttribute(
    "href",
    "/sorteios/draw-id",
  );
});
it("reopens the form after the server refuses a selection", async () => {
  const user = userEvent.setup();
  jest.mocked(createDraw).mockRejectedValue(new AccessError(400));
  render(<DrawCreation />);
  const boxes = await screen.findAllByRole("checkbox");
  for (const box of boxes.slice(0, 20)) fireEvent.click(box);
  await user.click(screen.getByRole("button", { name: "Sortear 4 times" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Confira a seleção");
  expect(screen.getByRole("button", { name: "Sortear 4 times" })).toBeEnabled();
  await user.click(screen.getByRole("button", { name: "Sortear 4 times" }));
  await waitFor(() => expect(createDraw).toHaveBeenCalledTimes(2));
});
