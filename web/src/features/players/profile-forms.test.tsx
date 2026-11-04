import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileEditor, RatingForm } from "./profile-forms";
import { updatePlayer, uploadPhoto } from "./players-client";

jest.mock("./players-client", () => ({
  updatePlayer: jest.fn(),
  uploadPhoto: jest.fn(),
  removePhoto: jest.fn(),
}));
it("updates the current contribution instead of presenting it as another vote", async () => {
  const user = userEvent.setup();
  const save = jest.fn().mockResolvedValue(undefined);
  render(<RatingForm current={7} pending={false} onSave={save} />);
  const rating = screen.getByRole("combobox", { name: "Sua nota para este jogador" });
  expect(screen.getByLabelText("Sua nota para este jogador", { exact: true })).toBe(rating);
  expect(rating).toHaveValue("7");
  await user.selectOptions(rating, "0");
  await user.click(screen.getByRole("button", { name: "Atualizar avaliação" }));
  expect(save).toHaveBeenCalledWith(0);
  expect(screen.getByText(/substitui a anterior/)).toBeInTheDocument();
});
it("requires a rating and prevents submissions while saving", () => {
  const { rerender } = render(<RatingForm pending={false} onSave={jest.fn()} />);
  expect(screen.getByRole("button", { name: "Salvar avaliação" })).toBeDisabled();
  rerender(<RatingForm current={10} pending onSave={jest.fn()} />);
  expect(screen.getByRole("combobox")).toBeDisabled();
});
it("edits a name through the profile endpoint and confirms the update", async () => {
  const user = userEvent.setup();
  const saved = jest.fn().mockResolvedValue(undefined);
  jest.mocked(updatePlayer).mockResolvedValue(undefined);
  render(
    <ProfileEditor id="player" name="Ana" hasPhoto={false} onSaved={saved} onFailure={jest.fn()} />,
  );
  await user.clear(screen.getByRole("textbox", { name: "Nome" }));
  await user.type(screen.getByRole("textbox", { name: "Nome" }), "Ana Silva");
  await user.click(screen.getByRole("button", { name: "Salvar nome" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Nome atualizado.");
  expect(updatePlayer).toHaveBeenCalledWith("player", "Ana Silva");
  expect(saved).toHaveBeenCalled();
});
it("rejects unsupported photos before sending their contents", async () => {
  const user = userEvent.setup({ applyAccept: false });
  jest.mocked(uploadPhoto).mockClear();
  render(
    <ProfileEditor
      id="player"
      name="Ana"
      hasPhoto={false}
      onSaved={jest.fn()}
      onFailure={jest.fn()}
    />,
  );
  await user.upload(
    screen.getByLabelText("Foto do perfil"),
    new File(["not an image"], "avatar.svg", { type: "image/svg+xml" }),
  );
  await user.click(screen.getByRole("button", { name: "Enviar foto" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("JPEG ou PNG de até 2 MB");
  expect(uploadPhoto).not.toHaveBeenCalled();
});
