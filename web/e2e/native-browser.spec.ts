import { createHash, randomBytes } from 'node:crypto';
import { expect, test } from './fixtures';
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from '../test/admin-fixture.mjs';

test.beforeAll(() => {
  if (process.env.FUTEIO_E2E_ISOLATED !== '1') throw new Error('Use pnpm test:e2e.');
});

test('browser Google login authorizes a PKCE-bound native session after explicit consent', async ({ page, playwright }, testInfo) => {
  const verifier = randomBytes(32).toString('base64url');
  const state = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/acesso/aplicativo?codeChallenge=${challenge}&state=${state}`);
  const button = page.getByRole('button', { name: 'Entrar com Google', exact: true });
  await expect(button).toBeEnabled({ timeout: 30_000 });
  const opened = page.waitForEvent('popup');
  await button.click();
  const popup = await opened;
  await popup.getByText(TEST_ADMIN_EMAIL, { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Autorizar aplicativo' })).toBeVisible();
  await expect(page).toHaveURL(/\/acesso\/aplicativo\?/);
  await expect(page.getByText(/se você iniciou esta entrada/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Voltar ao aplicativo' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('native-browser-consent.png'), fullPage: true });
  await page.getByRole('button', { name: 'Autorizar aplicativo' }).click();
  const callback = await page.getByRole('link', { name: 'Voltar ao aplicativo' }).getAttribute('href');
  expect(callback).toMatch(/^futeio:\/\/auth\/callback\?/);
  const url = new URL(callback!);
  expect(url.searchParams.get('state')).toBe(state);
  expect(url.searchParams.has('token')).toBe(false);
  const native = await playwright.request.newContext({ baseURL: testInfo.project.use.baseURL, extraHTTPHeaders: { 'X-Futeio-Client': 'native' } });
  try {
    const data = { code: url.searchParams.get('code'), codeVerifier: verifier, state };
    expect((await native.post('/api/v1/auth/native/admin/exchange', { data: { ...data, codeVerifier: randomBytes(32).toString('base64url') } })).status()).toBe(401);
    const exchanged = await native.post('/api/v1/auth/native/admin/exchange', { data });
    expect(exchanged.status()).toBe(200);
    expect(exchanged.headers()['set-cookie']).toBeUndefined();
    const { token } = await exchanged.json();
    expect((await native.get('/api/v1/auth/me', { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(200);
    expect((await native.post('/api/v1/auth/native/admin/exchange', { data })).status()).toBe(401);
    expect((await native.post('/api/v1/auth/logout', { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(200);
    expect((await page.request.get('/api/v1/auth/me')).status()).toBe(200);
  } finally { await native.dispose(); }
});

test('native browser entry rejects incomplete requests and supports administrator password login', async ({ page }) => {
  await page.goto('/acesso/aplicativo?state=incomplete');
  await expect(page.getByText(/Abra esta página pelo botão/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Autorizar aplicativo' })).toHaveCount(0);
  await page.goto(`/acesso/aplicativo?codeChallenge=${'c'.repeat(43)}&state=${'s'.repeat(43)}`);
  await page.getByLabel('E-mail', { exact: true }).fill(TEST_ADMIN_EMAIL);
  await page.getByLabel('Senha', { exact: true }).fill(TEST_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Autorizar aplicativo' })).toBeVisible();
  await expect(page).toHaveURL(/\/acesso\/aplicativo\?/);
});
