import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminSessionPanel } from "./admin-session-panel";

describe("AdminSessionPanel", () => {
  it("shows the authenticated email and lets the administrator leave using the keyboard", async () => {
    const user = userEvent.setup();
    const onLogout = jest.fn();
    render(<AdminSessionPanel email="admin@example.com" onLogout={onLogout} pending={false} />);

    expect(screen.getByText("admin@example.com")).toBeInTheDocument();
    await user.tab();
    expect(screen.getByRole("link", { name: "Gerenciar jogadores" })).toHaveFocus();
    expect(screen.getByRole("link", { name: "Gerenciar jogadores" })).toHaveAttribute("href", "/administracao/jogadores");
    await user.tab();
    expect(screen.getByRole("button", { name: "Sair" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("keeps the current session visible when logout fails", () => {
    render(
      <AdminSessionPanel
        email="admin@example.com"
        onLogout={jest.fn()}
        pending={false}
        errorMessage="Não foi possível sair. Tente novamente."
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível sair");
    expect(screen.getByText("admin@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sair" })).toBeEnabled();
  });
});
