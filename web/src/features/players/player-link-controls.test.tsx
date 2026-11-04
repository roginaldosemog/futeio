import { render, screen } from "@testing-library/react";
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
