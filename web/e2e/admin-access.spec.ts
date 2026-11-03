import { expect, test, type Page } from '@playwright/test';
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from '../../api/test/support/admin-fixture.mjs';

test.beforeAll(() => {
  if (process.env.FUTEIO_E2E_ISOLATED !== '1') {
    throw new Error('Run these tests with pnpm test:e2e to use isolated servers and credentials.');
  }
});

async function attemptLogin(page: Page, email: string, password: string) {
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  const result = page.waitForResponse((response) => (
    response.url().endsWith('/api/v1/auth/admin/login') && response.request().method() === 'POST'
  ));
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  return result;
}

test('protects administration without a session and keeps the login usable on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/administracao');
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  expect((await page.request.get('/api/v1/auth/me')).status()).toBe(401);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByLabel('E-mail', { exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Senha', { exact: true })).toBeFocused();
});

test('rejects a wrong password and an unknown email with the same recoverable message', async ({ page }) => {
  await page.goto('/entrar');
  expect((await attemptLogin(page, TEST_ADMIN_EMAIL, 'A-different-fixture-password!')).status()).toBe(401);
  const alert = page.locator('form').getByRole('alert');
  await expect(alert).toBeVisible();
  const genericMessage = await alert.innerText();
  expect(genericMessage.length).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled();

  expect((await attemptLogin(page, 'unknown-admin@example.test', TEST_ADMIN_PASSWORD)).status()).toBe(401);
  await expect(alert).toHaveText(genericMessage);
  await expect(page).toHaveURL(/\/entrar$/);
  expect((await page.request.get('/api/v1/auth/me')).status()).toBe(401);
});

test('creates a protected session, rejects logout without CSRF and revokes access when leaving', async ({ page, context }) => {
  await page.goto('/entrar');
  expect((await attemptLogin(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)).status()).toBe(200);
  await expect(page).toHaveURL(/\/administracao$/);
  await expect(page.getByRole('button', { name: 'Sair', exact: true })).toBeVisible();
  expect((await page.request.get('/api/v1/auth/me')).status()).toBe(200);

  const session = (await context.cookies()).find((cookie) => cookie.name === 'futeio_session');
  expect(Boolean(session)).toBe(true);
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe('Lax');
  const denied = await page.request.post('/api/v1/auth/logout', {
    headers: { Origin: new URL(page.url()).origin },
  });
  expect(denied.status()).toBe(403);
  expect((await page.request.get('/api/v1/auth/me')).status()).toBe(200);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Sair', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  expect((await page.request.get('/api/v1/auth/me')).status()).toBe(401);
  await page.goto('/administracao');
  await expect(page).toHaveURL(/\/entrar$/);
});
