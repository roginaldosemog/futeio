import { expect, test } from "./fixtures";
import { openGoogleAccountPicker } from "./google-popup";
import { TEST_ADMIN_EMAIL } from "../test/admin-fixture.mjs";

test.beforeAll(() => {
  if (process.env.FUTEIO_E2E_ISOLATED !== "1") throw new Error("Run Google journeys with pnpm test:e2e and the isolated Auth emulator.");
});

test("Google creates an administrator cookie through the real Auth emulator popup", async ({ page, context }) => {
  // Diagnose the failing boundary without printing credentials or response bodies.
  const boundaries: { path: string; status: number }[] = [];
  page.on("response", response => {
    const path = new URL(response.url()).pathname;
    if (path.startsWith("/api/v1/auth/")) boundaries.push({ path, status: response.status() });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/entrar");
  const button = page.getByRole("button", { name: "Entrar com Google", exact: true });
  await expect(button).toBeEnabled({ timeout: 30_000 });
  await page.screenshot({ path: test.info().outputPath("mobile-google-login.png"), fullPage: true });
  const popup = await openGoogleAccountPicker(page);
  await popup.getByText(TEST_ADMIN_EMAIL, { exact: true }).click();
  try {
    await expect(page).toHaveURL(/\/administracao$/, { timeout: 20_000 });
  } catch (error) {
    console.log(`[google-login-diagnostic] ${JSON.stringify({ path: new URL(page.url()).pathname, boundaries, alerts: await page.getByRole("alert").allTextContents(), popupClosed: popup.isClosed(), buttonEnabled: await button.isEnabled(), cookieNames: (await context.cookies()).map(cookie => cookie.name) })}`);
    throw error;
  }
  const session = (await context.cookies()).find((cookie) => cookie.name === "futeio_session");
  expect(session?.httpOnly).toBe(true);
  expect((await (await page.request.get("/api/v1/auth/me")).json()).role).toBe("ADMIN");
  expect(await page.evaluate(() => Object.keys(localStorage).some((key) => key.startsWith("firebase:authUser:")))).toBe(false);
  await page.screenshot({ path: test.info().outputPath("mobile-google-administrator.png"), fullPage: true });
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  expect((await page.request.get("/api/v1/auth/me")).status()).toBe(401);
});

test("an unapproved Google account cannot view the group and can recover the login form", async ({ page }) => {
  await page.goto("/entrar");
  const button = page.getByRole("button", { name: "Entrar com Google", exact: true });
  const popup = await openGoogleAccountPicker(page);
  await popup.getByRole("button", { name: "Add new account" }).click();
  await popup.locator("#email-input").fill("unapproved-browser@example.test");
  await popup.locator("#display-name-input").fill("Conta sem acesso");
  await popup.getByRole("button", { name: /^Sign in with Google/ }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("Esta conta Google não tem acesso à administração.");
  await expect(page).toHaveURL(/\/entrar$/);
  expect((await page.request.get("/api/v1/players")).status()).toBe(401);
  await expect(button).toBeEnabled();
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeEnabled();
});
