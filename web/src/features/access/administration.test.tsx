import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { AccessError, currentSession, logout } from "./access-client";
import { Administration } from "./administration";

jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));
jest.mock("./access-client", () => ({ ...jest.requireActual("./access-client"), currentSession: jest.fn(), logout: jest.fn() }));

const replace = jest.fn();
const sessionMock = jest.mocked(currentSession);
const logoutMock = jest.mocked(logout);
const session = { role: "ADMIN" as const, identityId: "test-identity", groupId: "test-group", email: "admin@example.com" };

beforeEach(() => {
  jest.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);
  sessionMock.mockReset();
  logoutMock.mockReset();
});

describe("Administration", () => {
  it("shows no administrator data before the current session is confirmed", async () => {
    sessionMock.mockResolvedValue(session);
    render(<Administration />);
    expect(screen.getByRole("status")).toHaveTextContent("Verificando seu acesso");
    expect(screen.queryByRole("button", { name: "Sair" })).not.toBeInTheDocument();
    expect(await screen.findByText("admin@example.com")).toBeInTheDocument();
  });

  it("redirects an expired or missing session to login without showing administration", async () => {
    sessionMock.mockRejectedValue(new AccessError(401));
    render(<Administration />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/entrar"));
    expect(screen.queryByRole("button", { name: "Sair" })).not.toBeInTheDocument();
  });

  it("does not allow a player session into administration", async () => {
    sessionMock.mockResolvedValue({ ...session, role: "PLAYER" });
    render(<Administration />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/entrar"));
    expect(screen.queryByText("admin@example.com")).not.toBeInTheDocument();
  });

  it("offers a retry when session verification is unavailable", async () => {
    const user = userEvent.setup();
    sessionMock.mockRejectedValueOnce(new AccessError(503)).mockResolvedValueOnce(session);
    render(<Administration />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível verificar seu acesso");
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("admin@example.com")).toBeInTheDocument();
  });

  it("returns to login after logout is confirmed", async () => {
    const user = userEvent.setup();
    sessionMock.mockResolvedValue(session);
    logoutMock.mockResolvedValue(undefined);
    render(<Administration />);
    await user.click(await screen.findByRole("button", { name: "Sair" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/entrar"));
  });

  it("keeps the session visible and allows recovery when logout fails", async () => {
    const user = userEvent.setup();
    sessionMock.mockResolvedValue(session);
    logoutMock.mockRejectedValue(new AccessError(503));
    render(<Administration />);
    await user.click(await screen.findByRole("button", { name: "Sair" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível sair");
    expect(screen.getByText("admin@example.com")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
