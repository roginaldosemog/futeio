import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { apiMutation, AccessError } from "@/lib/api-client";
import { PlayerAccess } from "./player-access";

jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));
jest.mock("@/lib/api-client", () => ({
  ...jest.requireActual("@/lib/api-client"),
  apiMutation: jest.fn(),
}));
const replace = jest.fn();
const mutate = jest.mocked(apiMutation);
const token = "a".repeat(43);
beforeEach(() => {
  replace.mockClear();
  mutate.mockReset();
  jest.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);
  window.history.replaceState(null, "", `/acesso/jogador#token=${token}`);
});

it("removes the credential from the address and waits for an explicit entry before redemption", async () => {
  const user = userEvent.setup();
  mutate.mockResolvedValue({
    json: async () => ({ role: "PLAYER", playerId: "player-id" }),
  } as Response);
  render(
    <StrictMode>
      <PlayerAccess />
    </StrictMode>,
  );
  expect(window.location.hash).toBe("");
  expect(mutate).not.toHaveBeenCalled();
  expect(screen.queryByText(token)).not.toBeInTheDocument();
  await user.click(await screen.findByRole("button", { name: "Entrar na pelada" }));
  expect(mutate).toHaveBeenCalledWith("auth/player/redeem", { token });
  expect(mutate).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/jogadores/player-id"));
  expect(window.localStorage.length).toBe(0);
  expect(window.sessionStorage.length).toBe(0);
});

it("asks for a new link when the server rejects the credential without displaying its value", async () => {
  const user = userEvent.setup();
  mutate.mockRejectedValue(new AccessError(401));
  render(<PlayerAccess />);
  await user.click(await screen.findByRole("button", { name: "Entrar na pelada" }));
  expect(await screen.findByRole("heading", { name: "Link indisponível" })).toBeInTheDocument();
  expect(screen.queryByText(token)).not.toBeInTheDocument();
  expect(replace).not.toHaveBeenCalled();
});

it("does not submit an incomplete link", async () => {
  window.history.replaceState(null, "", "/acesso/jogador#token=bad");
  render(<PlayerAccess />);
  expect(await screen.findByRole("heading", { name: "Link indisponível" })).toBeInTheDocument();
  expect(mutate).not.toHaveBeenCalled();
});

it("allows a deliberate retry after a network failure", async () => {
  const user = userEvent.setup();
  mutate.mockRejectedValue(new TypeError("private diagnostics"));
  render(<PlayerAccess />);
  await user.click(await screen.findByRole("button", { name: "Entrar na pelada" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível entrar");
  expect(screen.getByRole("button", { name: "Entrar na pelada" })).toBeEnabled();
  expect(mutate).toHaveBeenCalledTimes(1);
});

it("accepts a replacement fragment after an invalid link without remounting", async () => {
  const user = userEvent.setup();
  const replacement = "b".repeat(43);
  mutate.mockRejectedValueOnce(new AccessError(401)).mockResolvedValueOnce({
    json: async () => ({ role: "PLAYER", playerId: "replacement-player" }),
  } as Response);
  render(<PlayerAccess />);
  await user.click(await screen.findByRole("button", { name: "Entrar na pelada" }));
  expect(await screen.findByRole("heading", { name: "Link indisponível" })).toBeInTheDocument();
  await act(async () => {
    window.location.hash = `token=${replacement}`;
  });
  const enter = await screen.findByRole("button", { name: "Entrar na pelada" });
  expect(enter).toBeEnabled();
  expect(window.location.hash).toBe("");
  expect(mutate).toHaveBeenCalledTimes(1);
  await user.click(enter);
  expect(mutate).toHaveBeenLastCalledWith("auth/player/redeem", { token: replacement });
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/jogadores/replacement-player"));
});

it("serializes entry attempts and ignores an old response after the fragment changes", async () => {
  const user = userEvent.setup();
  const replacement = "c".repeat(43);
  let finishOld!: (response: Response) => void;
  mutate
    .mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        finishOld = resolve;
      }),
    )
    .mockResolvedValueOnce({
      json: async () => ({ role: "PLAYER", playerId: "new-player" }),
    } as Response);
  render(<PlayerAccess />);
  await user.click(await screen.findByRole("button", { name: "Entrar na pelada" }));
  expect(screen.getByRole("button", { name: "Entrando..." })).toBeDisabled();
  await act(async () => {
    window.location.hash = `token=${replacement}`;
  });
  await waitFor(() => expect(window.location.hash).toBe(""));
  const pending = screen.getByRole("button", { name: "Entrando..." });
  expect(pending).toBeDisabled();
  fireEvent.click(pending);
  expect(mutate).toHaveBeenCalledTimes(1);
  await act(async () => {
    finishOld({ json: async () => ({ role: "PLAYER", playerId: "old-player" }) } as Response);
  });
  const enter = await screen.findByRole("button", { name: "Entrar na pelada" });
  expect(enter).toBeEnabled();
  expect(replace).not.toHaveBeenCalled();
  await user.click(enter);
  expect(mutate).toHaveBeenCalledTimes(2);
  expect(mutate).toHaveBeenLastCalledWith("auth/player/redeem", { token: replacement });
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/jogadores/new-player"));
  expect(replace).not.toHaveBeenCalledWith("/jogadores/old-player");
});
