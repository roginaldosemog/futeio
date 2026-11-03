import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { AccessError, loginAdministrator } from "./access-client";
import { AdminLogin } from "./admin-login";

jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));
jest.mock("./access-client", () => ({ ...jest.requireActual("./access-client"), loginAdministrator: jest.fn() }));

const replace = jest.fn();
const loginMock = jest.mocked(loginAdministrator);

beforeEach(() => {
  jest.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);
  loginMock.mockReset();
});

async function fillCredentials() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("E-mail"), "admin@example.com");
  await user.type(screen.getByLabelText("Senha"), "senha-exclusiva-do-teste");
  await user.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("AdminLogin", () => {
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
