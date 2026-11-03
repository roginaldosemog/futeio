import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreatePlayerForm } from "./create-player-form";

describe("CreatePlayerForm", () => {
  it("submits labeled fields as numbers with the explicit administrator profile choice", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue(true);
    render(<CreatePlayerForm onSubmit={onSubmit} pending={false} ownProfileExists={false} />);
    const name = screen.getByRole("textbox", { name: "Nome" });
    expect(name.closest("form")).toHaveAttribute("method", "post");
    await user.type(name, "  Jogador da turma  ");
    await user.type(screen.getByRole("spinbutton", { name: "Nota inicial" }), "7");
    await user.click(screen.getByRole("checkbox", { name: "Este é o meu perfil" }));
    await user.click(screen.getByRole("button", { name: "Cadastrar jogador" }));
    expect(onSubmit).toHaveBeenCalledWith({ name: "Jogador da turma", initialRating: 7, linkToCurrentAdministrator: true });
    await waitFor(() => expect(name).toHaveValue(""));
  });
  it.each(["0", "10"])("accepts the boundary rating %s", async (rating) => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue(false);
    render(<CreatePlayerForm onSubmit={onSubmit} pending={false} ownProfileExists={false} />);
    await user.type(screen.getByRole("textbox", { name: "Nome" }), "Colega");
    await user.type(screen.getByRole("spinbutton", { name: "Nota inicial" }), rating);
    await user.click(screen.getByRole("button", { name: "Cadastrar jogador" }));
    expect(onSubmit).toHaveBeenCalledWith({ name: "Colega", initialRating: Number(rating), linkToCurrentAdministrator: false });
  });
  it("requires an integer rating and keeps entered fields after a rejected request", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue(false);
    render(<CreatePlayerForm onSubmit={onSubmit} pending={false} ownProfileExists={false} errorMessage="Confira os dados." />);
    await user.type(screen.getByRole("textbox", { name: "Nome" }), "Colega");
    const rating = screen.getByRole("spinbutton", { name: "Nota inicial" });
    await user.click(screen.getByRole("button", { name: "Cadastrar jogador" }));
    expect(onSubmit).not.toHaveBeenCalled();
    await user.type(rating, "7.5");
    await user.click(screen.getByRole("button", { name: "Cadastrar jogador" }));
    expect(onSubmit).not.toHaveBeenCalled();
    await user.clear(rating);
    await user.type(rating, "7");
    await user.click(screen.getByRole("button", { name: "Cadastrar jogador" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("textbox", { name: "Nome" })).toHaveValue("Colega");
    expect(screen.getByRole("alert")).toHaveTextContent("Confira os dados.");
  });
  it("prevents duplicate requests while saving and disables an already linked own profile", async () => {
    const onSubmit = jest.fn();
    const { rerender } = render(<CreatePlayerForm onSubmit={onSubmit} pending ownProfileExists={false} />);
    expect(screen.getByRole("button", { name: "Cadastrando..." })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Nome" })).toBeDisabled();
    rerender(<CreatePlayerForm onSubmit={onSubmit} pending={false} ownProfileExists />);
    expect(screen.getByRole("checkbox", { name: "Este é o meu perfil" })).toBeDisabled();
    expect(screen.getByText("Seu perfil já está cadastrado.")).toBeInTheDocument();
  });
});
