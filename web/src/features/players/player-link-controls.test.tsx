import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlayerLinkControls } from "./player-link-controls";
import { revokeLink, rotateLink } from "./players-client";

jest.mock("./players-client", () => ({ rotateLink: jest.fn(), revokeLink: jest.fn() }));
it("requires explicit confirmation and clears the new personal link on request", async () => {
  const user = userEvent.setup();
  const url = "https://futeio.example.test/acesso/jogador#token=private-fixture";
  jest.mocked(rotateLink).mockResolvedValue({ accessUrl: url });
  render(<PlayerLinkControls id="player" onFailure={jest.fn()} />);
  await user.click(screen.getByRole("button", { name: "Gerar novo link" }));
  expect(rotateLink).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Confirmar novo link" }));
  expect(await screen.findByText(url)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Ocultar link" }));
  expect(screen.queryByText(url)).not.toBeInTheDocument();
});
it("can cancel revocation without affecting access", async () => {
  const user = userEvent.setup();
  jest.mocked(revokeLink).mockClear();
  render(<PlayerLinkControls id="player" onFailure={jest.fn()} />);
  await user.click(screen.getByRole("button", { name: "Revogar acesso" }));
  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(revokeLink).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Confirmar revogação" })).not.toBeInTheDocument();
});
it("replaces a failed attempt with the next confirmation instead of showing both", async () => {
  const user = userEvent.setup();
  const onFailure = jest.fn();
  const failure = new Error("offline");
  jest.mocked(rotateLink).mockRejectedValue(failure);
  render(<PlayerLinkControls id="player" onFailure={onFailure} />);
  await user.click(screen.getByRole("button", { name: "Gerar novo link" }));
  await user.click(screen.getByRole("button", { name: "Confirmar novo link" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível confirmar");
  expect(onFailure).toHaveBeenCalledWith(failure);
  expect(screen.getByRole("button", { name: "Confirmar novo link" })).toBeEnabled();
  await user.click(screen.getByRole("button", { name: "Revogar acesso" }));
  expect(screen.getByRole("button", { name: "Confirmar revogação" })).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("sends one request when confirmation is clicked twice", async () => {
  const user = userEvent.setup();
  let finish!: (value: { accessUrl: string }) => void;
  jest.mocked(rotateLink).mockReset();
  jest.mocked(rotateLink).mockReturnValue(new Promise((resolve) => (finish = resolve)));
  render(<PlayerLinkControls id="player" onFailure={jest.fn()} />);
  await user.click(screen.getByRole("button", { name: "Gerar novo link" }));
  const confirm = screen.getByRole("button", { name: "Confirmar novo link" });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  expect(rotateLink).toHaveBeenCalledTimes(1);
  await act(async () => finish({ accessUrl: "https://futeio.example.test/acesso/jogador#token=x" }));
  expect(screen.getByRole("status")).toHaveTextContent("Novo link gerado");
});
