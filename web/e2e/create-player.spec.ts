import { expect, test, type Page } from './fixtures';
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from '../../api/test/support/admin-fixture.mjs';

test.beforeAll(() => {
  if (process.env.FUTEIO_E2E_ISOLATED !== '1') throw new Error('Run these journeys with pnpm test:e2e.');
});

async function signIn(page: Page) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail', { exact: true }).fill(TEST_ADMIN_EMAIL);
  await page.getByLabel('Senha', { exact: true }).fill(TEST_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/administracao$/);
  await page.getByRole('link', { name: 'Gerenciar jogadores' }).click();
  await expect(page).toHaveURL(/\/administracao\/jogadores$/);
}

async function register(page: Page, name: string, rating: number, ownProfile = false) {
  await page.getByLabel('Nome', { exact: true }).fill(name);
  await page.getByLabel('Nota inicial', { exact: true }).fill(String(rating));
  if (ownProfile) await page.getByLabel('Este é o meu perfil', { exact: true }).check();
  const response = page.waitForResponse((result) => result.url().endsWith('/api/v1/players') && result.request().method() === 'POST');
  await page.getByRole('button', { name: 'Cadastrar jogador', exact: true }).click();
  return response;
}

test('keeps player registration private', async ({ page }) => {
  await page.goto('/administracao/jogadores');
  await expect(page).toHaveURL(/\/entrar$/);
  expect((await page.request.get('/api/v1/players')).status()).toBe(401);
});

test('registers equal names with distinct profiles and keeps the personal link out of the roster', async ({ page }) => {
  let copied = '';
  await page.exposeFunction('captureTestClipboard', (value: string) => { copied = value; });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: {
      writeText: (value: string) => (window as unknown as { captureTestClipboard(value: string): Promise<void> }).captureTestClipboard(value),
    } });
  });
  await signIn(page);
  const result = await register(page, 'Participante do teste E3', 0);
  expect(result.status()).toBe(201);
  await expect(page.getByRole('heading', { name: 'Jogador cadastrado', exact: true })).toBeFocused();
  const first = await result.json() as { player: { id: string }; accessUrl: string };
  const access = new URL(first.accessUrl);
  expect(access.pathname).toBe('/acesso/jogador');
  expect(access.search).toBe('');
  const token = new URLSearchParams(access.hash.slice(1)).get('token')!;
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  await page.getByRole('button', { name: 'Copiar link', exact: true }).click();
  await expect.poll(() => copied === first.accessUrl).toBe(true);
  const roster = page.getByRole('list', { name: 'Jogadores cadastrados' });
  await expect(roster).toContainText('Participante do teste E3');
  await expect(roster).toContainText('Nota: 0');
  expect((await roster.textContent())?.includes(token)).toBe(false);
  const list = await page.request.get('/api/v1/players');
  expect(list.status()).toBe(200);
  expect((await list.text()).includes(token)).toBe(false);

  await page.getByRole('button', { name: 'Cadastrar outro jogador', exact: true }).click();
  await expect(page.getByLabel('Nome', { exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Copiar link', exact: true })).toHaveCount(0);
  const secondResponse = await register(page, 'Participante do teste E3', 10);
  expect(secondResponse.status()).toBe(201);
  const second = await secondResponse.json() as { player: { id: string } };
  expect(first.player.id === second.player.id).toBe(false);
  await expect(roster.getByRole('listitem').filter({ hasText: 'Participante do teste E3' })).toHaveCount(2);
  await expect(roster).toContainText('Nota: 10');
  await page.reload();
  await expect(page.getByLabel('Nome', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copiar link', exact: true })).toHaveCount(0);
});

test('links the administrator profile once and keeps registration usable on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  const result = await register(page, 'Administrador do teste E3', 7, true);
  expect(result.status()).toBe(201);
  const roster = page.getByRole('list', { name: 'Jogadores cadastrados' });
  const own = roster.getByRole('listitem').filter({ hasText: 'Administrador do teste E3' });
  await expect(own).toContainText('Seu perfil');
  await expect(own).toContainText('Nota: 7');
  await page.getByRole('button', { name: 'Cadastrar outro jogador', exact: true }).click();
  await expect(page.getByLabel('Este é o meu perfil', { exact: true })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
