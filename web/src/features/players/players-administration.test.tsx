import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { AccessError, currentSession } from "../access/access-client";
import { createPlayer, listPlayers } from "./players-client";
import { PlayersAdministration } from "./players-administration";

jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));
jest.mock("../access/access-client", () => ({ ...jest.requireActual("../access/access-client"), currentSession: jest.fn() }));
jest.mock("./players-client", () => ({ createPlayer: jest.fn(), listPlayers: jest.fn() }));
const replace = jest.fn();
const sessionMock = jest.mocked(currentSession);
const listMock = jest.mocked(listPlayers);
const createMock = jest.mocked(createPlayer);
const session = { role: "ADMIN" as const, identityId: "admin-id", groupId: "group-id", email: "admin@example.test" };
const player = { id: "player-id", name: "Colega", rating: 7, isOwnProfile: false };
const accessUrl = "https://futeio.example.test/acesso/jogador#token=fixture-secret";

beforeEach(() => {
  jest.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);
  replace.mockClear(); sessionMock.mockReset(); listMock.mockReset(); createMock.mockReset();
  sessionMock.mockResolvedValue(session); listMock.mockResolvedValue([]);
});

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByRole("textbox", { name: "Nome" }), "Colega");
  await user.type(screen.getByRole("spinbutton", { name: "Nota inicial" }), "7");
  await user.click(screen.getByRole("button", { name: "Cadastrar jogador" }));
}

describe("PlayersAdministration", () => {
  it("checks the session before reading or displaying the private roster", async () => {
    sessionMock.mockRejectedValue(new AccessError(401));
    render(<PlayersAdministration />);
    expect(screen.getByRole("status")).toHaveTextContent("Verificando seu acesso");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/entrar"));
    expect(listMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "Nome" })).not.toBeInTheDocument();
  });
  it("shows empty and loading states, then allows an authorized registration", async () => {
    render(<PlayersAdministration />);
    expect(await screen.findByText("Nenhum jogador cadastrado ainda.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cadastrar jogador" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Voltar à administração" })).toHaveAttribute("href", "/administracao");
  });
  it("shows the roster and prevents linking the administrator a second time", async () => {
    listMock.mockResolvedValue([{ ...player, rating: 7 / 3, isOwnProfile: true }]);
    render(<PlayersAdministration />);
    const roster = await screen.findByRole("list", { name: "Jogadores cadastrados" });
    expect(within(roster).getByText("Colega")).toBeInTheDocument();
    expect(within(roster).getByText("Nota: 2,33")).toBeInTheDocument();
    expect(within(roster).getByText("Seu perfil")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Este é o meu perfil" })).toBeDisabled();
  });
  it("recovers a roster failure without silently repeating a creation", async () => {
    const user = userEvent.setup();
    listMock.mockRejectedValueOnce(new AccessError(503)).mockResolvedValue([player]);
    render(<PlayersAdministration />);
    expect(await screen.findByText("Não foi possível carregar os jogadores. Tente atualizar a lista.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Atualizar lista" }));
    expect(await screen.findByRole("list", { name: "Jogadores cadastrados" })).toHaveTextContent("Colega");
    expect(createMock).not.toHaveBeenCalled();
  });
  it("removes the visible roster when a refresh reports a revoked session", async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValueOnce([player]).mockRejectedValue(new AccessError(401));
    render(<PlayersAdministration />);
    expect(await screen.findByRole("list", { name: "Jogadores cadastrados" })).toHaveTextContent("Colega");
    await user.click(screen.getByRole("button", { name: "Atualizar lista" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/entrar"));
    expect(screen.queryByRole("list", { name: "Jogadores cadastrados" })).not.toBeInTheDocument();
    expect(screen.queryByText("Colega")).not.toBeInTheDocument();
  });
  it("shows a newly generated link only in the creation result and clears it for the next player", async () => {
    const user = userEvent.setup();
    const copy = jest.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    createMock.mockResolvedValue({ player, accessUrl });
    listMock.mockResolvedValueOnce([]).mockResolvedValue([player]);
    const { unmount } = render(<PlayersAdministration />);
    await fillAndSubmit(user);
    expect(await screen.findByRole("heading", { name: "Jogador cadastrado" })).toHaveFocus();
    expect(screen.getByText(accessUrl)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Copiar link" }));
    expect(copy).toHaveBeenCalledWith(accessUrl);
    expect(await screen.findByText("Link copiado.")).toBeInTheDocument();
    const roster = screen.getByRole("list", { name: "Jogadores cadastrados" });
    expect(within(roster).queryByText(accessUrl)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cadastrar outro jogador" }));
    expect(screen.queryByText(accessUrl)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nome" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Nome" })).toHaveFocus();
    expect(createMock).toHaveBeenCalledTimes(1);
    unmount();
    render(<PlayersAdministration />);
    await screen.findByRole("textbox", { name: "Nome" });
    expect(screen.queryByText(accessUrl)).not.toBeInTheDocument();
  });
  it("preserves a confirmed registration and its link if the following roster refresh fails", async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValueOnce([]).mockRejectedValue(new AccessError(503));
    createMock.mockResolvedValue({ player, accessUrl });
    render(<PlayersAdministration />);
    await fillAndSubmit(user);
    expect(await screen.findByRole("heading", { name: "Jogador cadastrado" })).toBeInTheDocument();
    expect(screen.getByText(accessUrl)).toBeInTheDocument();
    expect(await screen.findByText("Não foi possível carregar os jogadores. Tente atualizar a lista.")).toBeInTheDocument();
    expect(screen.queryByText("Não foi possível confirmar o cadastro. Atualize a lista antes de tentar novamente.")).not.toBeInTheDocument();
    expect(createMock).toHaveBeenCalledTimes(1);
  });
  it("requires checking the roster before resubmitting a creation with an uncertain outcome", async () => {
    const user = userEvent.setup();
    createMock.mockRejectedValue(new Error("Uncertain network result"));
    render(<PlayersAdministration />);
    await fillAndSubmit(user);
    expect(await screen.findByText("Não foi possível confirmar o cadastro. Atualize a lista antes de tentar novamente.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cadastrar jogador" })).toBeDisabled();
    expect(createMock).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Atualizar lista" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Cadastrar jogador" })).toBeEnabled());
    expect(createMock).toHaveBeenCalledTimes(1);
  });
  it("explains a profile conflict and never creates automatically again", async () => {
    const user = userEvent.setup();
    createMock.mockRejectedValue(new AccessError(409));
    render(<PlayersAdministration />);
    await fillAndSubmit(user);
    expect(await screen.findByText("Seu perfil já está cadastrado. Confira a lista de jogadores.")).toBeInTheDocument();
    expect(createMock).toHaveBeenCalledTimes(1);
  });
});
