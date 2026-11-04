import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { currentSession, AccessError } from "../access/access-client";
import { listPlayers } from "./players-client";
import { Roster } from "./roster";

jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));
jest.mock("../access/access-client", () => ({
  ...jest.requireActual("../access/access-client"),
  currentSession: jest.fn(),
}));
jest.mock("./players-client", () => ({ listPlayers: jest.fn() }));
const replace = jest.fn();
beforeEach(() => {
  replace.mockClear();
  jest.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);
  jest
    .mocked(currentSession)
    .mockResolvedValue({ role: "PLAYER", identityId: "identity", groupId: "group" });
  jest.mocked(listPlayers).mockResolvedValue([
    { id: "1", name: "Ana", rating: 7.25, isOwnProfile: true, myRating: 8 },
    { id: "2", name: "Beto", rating: 6, isOwnProfile: false, myRating: null },
  ]);
});
it("shows own contributions, pending evaluations and accessible profile links", async () => {
  render(<Roster />);
  expect(await screen.findByRole("link", { name: /Ana/ })).toHaveAttribute("href", "/jogadores/1");
  expect(screen.getByText("Seu perfil · Sua avaliação: 8")).toBeInTheDocument();
  expect(screen.getByText("Avaliação pendente")).toBeInTheDocument();
  expect(screen.getByText("7,25")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Administração" })).not.toBeInTheDocument();
});
it("filters by name and explains an empty search result", async () => {
  const user = userEvent.setup();
  render(<Roster />);
  const search = await screen.findByRole("searchbox", { name: "Buscar jogador" });
  await user.type(search, "ana");
  expect(screen.queryByRole("link", { name: /Beto/ })).not.toBeInTheDocument();
  await user.clear(search);
  await user.type(search, "ninguém");
  expect(screen.getByRole("status")).toHaveTextContent("Nenhum jogador encontrado");
});
it("does not request private players without an authenticated session", async () => {
  jest.mocked(listPlayers).mockClear();
  jest.mocked(currentSession).mockRejectedValue(new AccessError(401));
  render(<Roster />);
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/entrar"));
  expect(listPlayers).not.toHaveBeenCalled();
});
