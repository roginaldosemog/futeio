import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccessError, apiMutation, apiRequest } from "@/lib/api-client";
import { NativeAuthorization } from "./native-authorization";

jest.mock("@/lib/api-client", () => ({ ...jest.requireActual("@/lib/api-client"), apiRequest: jest.fn(), apiMutation: jest.fn() }));
jest.mock("./admin-login", () => ({ AdminLogin: ({ onAuthenticated }: { onAuthenticated: () => void }) => <button onClick={onAuthenticated}>Login de teste</button> }));
const state = "s".repeat(43);
const codeChallenge = "p".repeat(43);
const code = "c".repeat(43);
const request = jest.mocked(apiRequest);
const mutation = jest.mocked(apiMutation);
const response = (value: unknown) => ({ json: async () => value }) as Response;
const component = () => <NativeAuthorization state={state} codeChallenge={codeChallenge} googleConfig={{ apiKey: "demo", projectId: "demo-futeio", authDomain: "demo-futeio.firebaseapp.com" }} />;

it("requires explicit consent and returns only the validated one-use callback", async () => {
  request.mockResolvedValue(response({ role: "ADMIN" }));
  mutation.mockResolvedValue(response({ redirectUrl: `futeio://auth/callback?code=${code}&state=${state}` }));
  render(component());
  const authorize = await screen.findByRole("button", { name: "Autorizar aplicativo" });
  expect(screen.getByText(/se você iniciou esta entrada/)).toBeInTheDocument();
  expect(mutation).not.toHaveBeenCalled();
  await userEvent.click(authorize);
  expect(mutation).toHaveBeenCalledWith("auth/native/admin/authorize", { codeChallenge, state });
  expect(await screen.findByRole("link", { name: "Voltar ao aplicativo" })).toHaveAttribute("href", `futeio://auth/callback?code=${code}&state=${state}`);
});

it.each(["https://attacker.example/callback", `futeio://auth/callback?code=${code}&state=wrong`, `futeio://auth/callback?code=${code}&state=${state}&state=${state}`])("rejects an unexpected callback: %s", async redirectUrl => {
  request.mockResolvedValue(response({ role: "ADMIN" }));
  mutation.mockResolvedValue(response({ redirectUrl }));
  render(component());
  await userEvent.click(await screen.findByRole("button", { name: "Autorizar aplicativo" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível autorizar");
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

it("requires administrator login and rechecks its session after authentication", async () => {
  request.mockRejectedValueOnce(new AccessError(401)).mockResolvedValue(response({ role: "ADMIN" }));
  render(component());
  await userEvent.click(await screen.findByRole("button", { name: "Login de teste" }));
  expect(await screen.findByRole("button", { name: "Autorizar aplicativo" })).toBeEnabled();
  expect(request).toHaveBeenCalledTimes(2);
});

it("ignores an authorization response after the browser flow is unmounted", async () => {
  let resolve!: (value: Response) => void;
  request.mockResolvedValue(response({ role: "ADMIN" }));
  mutation.mockImplementation(() => new Promise(done => { resolve = done; }));
  const { unmount } = render(component());
  await userEvent.click(await screen.findByRole("button", { name: "Autorizar aplicativo" }));
  unmount();
  resolve(response({ redirectUrl: `futeio://auth/callback?code=${code}&state=${state}` }));
  await waitFor(() => expect(screen.queryByRole("link")).not.toBeInTheDocument());
});
