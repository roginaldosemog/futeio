import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { AccessError, loginAdministrator, loginAdministratorWithGoogle } from "./access-client";
import { AdminLogin } from "./admin-login";
import { prepareGoogleLogin } from "./google-auth";

jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));
jest.mock("./access-client", () => ({ ...jest.requireActual("./access-client"), loginAdministrator: jest.fn(), loginAdministratorWithGoogle: jest.fn() }));
jest.mock("./google-auth", () => ({ prepareGoogleLogin: jest.fn() }));

const replace = jest.fn();
const loginMock = jest.mocked(loginAdministrator);
const googleMock = jest.mocked(loginAdministratorWithGoogle);
const prepareMock = jest.mocked(prepareGoogleLogin);
const googleConfig = { apiKey: "demo", projectId: "demo-futeio", authDomain: "demo-futeio.firebaseapp.com" };
const client = { signIn: jest.fn(), clear: jest.fn(), dispose: jest.fn() };

beforeEach(() => {
  jest.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);
  loginMock.mockReset();
  googleMock.mockReset();
  client.signIn.mockReset().mockResolvedValue("synthetic-id-token");
  client.clear.mockReset().mockResolvedValue(undefined);
  client.dispose.mockReset().mockResolvedValue(undefined);
  prepareMock.mockReset().mockResolvedValue(client);
});

async function fillCredentials() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("E-mail"), "admin@example.com");
  await user.type(screen.getByLabelText("Senha"), "senha-exclusiva-do-teste");
  await user.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("AdminLogin", () => {
  it("uses Google without requiring password fields and clears the temporary Firebase user", async () => {
    googleMock.mockResolvedValue({ role: "ADMIN", identityId: "test-identity", groupId: "test-group" });
    const { unmount } = render(<AdminLogin googleConfig={googleConfig} />);
    const button = await screen.findByRole("button", { name: "Entrar com Google" });
    await userEvent.click(button);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/administracao"));
    expect(googleMock).toHaveBeenCalledWith("synthetic-id-token");
    expect(client.clear).toHaveBeenCalled();
    expect(loginMock).not.toHaveBeenCalled();
    unmount();
    expect(client.dispose).toHaveBeenCalled();
  });

  it("rejects an unapproved Google account without navigation and allows another attempt", async () => {
    googleMock.mockRejectedValue(new AccessError(401));
    render(<AdminLogin googleConfig={googleConfig} />);
    await userEvent.click(await screen.findByRole("button", { name: "Entrar com Google" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Esta conta Google não tem acesso à administração.");
    expect(replace).not.toHaveBeenCalled();
    expect(client.clear).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Entrar com Google" })).toBeEnabled();
  });

  it("explains a blocked popup without sending credentials to the backend", async () => {
    client.signIn.mockRejectedValue({ code: "auth/popup-blocked" });
    render(<AdminLogin googleConfig={googleConfig} />);
    await userEvent.click(await screen.findByRole("button", { name: "Entrar com Google" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Permita a janela de login do Google");
    expect(googleMock).not.toHaveBeenCalled();
    expect(client.clear).toHaveBeenCalled();
  });

  it("lets a failed Google SDK load be retried while password login stays usable", async () => {
    prepareMock.mockRejectedValueOnce(new Error("Synthetic offline failure"));
    render(<AdminLogin googleConfig={googleConfig} />);
    await userEvent.click(await screen.findByRole("button", { name: "Tentar carregar Google novamente" }));
    expect(await screen.findByRole("button", { name: "Entrar com Google" })).toBeEnabled();
    expect(screen.getByRole("button", { name: /^Entrar$/ })).toBeEnabled();
  });

  it("ignores a Google popup result after leaving the login page", async () => {
    let finish: (token: string) => void = () => undefined;
    client.signIn.mockReturnValue(new Promise<string>((resolve) => { finish = resolve; }));
    const { unmount } = render(<AdminLogin googleConfig={googleConfig} />);
    await userEvent.click(await screen.findByRole("button", { name: "Entrar com Google" }));
    unmount();
    finish("synthetic-stale-token");
    await waitFor(() => expect(client.clear).toHaveBeenCalled());
    expect(googleMock).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("does not navigate after leaving while the Google session exchange is pending", async () => {
    let finish: (session: Awaited<ReturnType<typeof loginAdministratorWithGoogle>>) => void = () => undefined;
    googleMock.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { unmount } = render(<AdminLogin googleConfig={googleConfig} />);
    await userEvent.click(await screen.findByRole("button", { name: "Entrar com Google" }));
    await waitFor(() => expect(googleMock).toHaveBeenCalled());
    unmount();
    finish({ role: "ADMIN", identityId: "fixture", groupId: "fixture" });
    await waitFor(() => expect(client.clear).toHaveBeenCalled());
    expect(replace).not.toHaveBeenCalled();
  });

  it("opens administration only after the API confirms an administrator session", async () => {
    loginMock.mockResolvedValue({ role: "ADMIN", identityId: "test-identity", groupId: "test-group", email: "admin@example.com" });
    render(<AdminLogin />);
    expect(replace).not.toHaveBeenCalled();
    await fillCredentials();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/administracao"));
    expect(screen.getByLabelText("Senha")).toHaveValue("");
  });

  it.each([
    [401, "E-mail ou senha inválidos."],
    [429, "Muitas tentativas. Aguarde alguns minutos e tente novamente."],
    [503, "Não foi possível entrar agora. Tente novamente em instantes."],
  ])("keeps the form recoverable after HTTP %i", async (status, message) => {
    loginMock.mockRejectedValue(new AccessError(status));
    render(<AdminLogin />);
    await fillCredentials();
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
    expect(replace).not.toHaveBeenCalled();
  });
});
