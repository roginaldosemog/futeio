import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminLoginForm } from "./admin-login-form";

describe("AdminLoginForm", () => {
  it("lets the administrator enter credentials with the keyboard and clears the password after success", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue(true);
    render(<AdminLoginForm onSubmit={onSubmit} pending={false} />);

    await user.tab();
    const email = screen.getByLabelText("E-mail");
    expect(email).toHaveFocus();
    await user.type(email, "admin@example.com");
    await user.tab();
    const password = screen.getByLabelText("Senha");
    expect(password).toHaveFocus();
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "current-password");
    expect(password.closest("form")).toHaveAttribute("method", "post");
    await user.keyboard("senha-exclusiva-do-teste");
    await user.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledWith("admin@example.com", "senha-exclusiva-do-teste");
    await waitFor(() => expect(password).toHaveValue(""));
  });

  it("prevents a second request while the first one is pending", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<AdminLoginForm onSubmit={onSubmit} pending />);

    expect(screen.getByLabelText("E-mail")).toBeDisabled();
    expect(screen.getByLabelText("Senha")).toBeDisabled();
    const submit = screen.getByRole("button", { name: "Entrando..." });
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("requires both credentials before submitting", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<AdminLoginForm onSubmit={onSubmit} pending={false} />);

    await user.type(screen.getByLabelText("E-mail"), "admin@example.com");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Senha")).toBeInvalid();
  });

  it("announces a request failure and keeps the form available for recovery", () => {
    render(
      <AdminLoginForm
        onSubmit={jest.fn()}
        pending={false}
        errorMessage="E-mail ou senha inválidos."
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("E-mail ou senha inválidos.");
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
    expect(screen.getByLabelText("Senha")).toHaveAccessibleDescription("E-mail ou senha inválidos.");
  });
});
