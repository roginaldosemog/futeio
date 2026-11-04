import { expect, test, type Page } from './fixtures';
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from '../../api/test/support/admin-fixture.mjs';

test.use({ actionTimeout: 15_000 });

async function expectNoHorizontalScroll(page: Page) {
  const bounds = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll('body *')].filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && (rect.right > window.innerWidth + 1 || rect.left < -1);
    }).slice(0, 8).map((element) => ({ tag: element.tagName, class: element.className })),
  }));
  expect(bounds.document, JSON.stringify(bounds)).toBeLessThanOrEqual(bounds.viewport);
}

async function capturePage(page: Page, path: string) {
  // Full-page Chrome captures can paint fixed offscreen skip links at the
  // previous scroll offset. Reset the camera without changing focus or styles.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path, fullPage: true });
}

test.beforeAll(() => {
  if (process.env.FUTEIO_E2E_ISOLATED !== '1') throw new Error('Run the complete MVP journeys with pnpm test:e2e.');
});

test('explains an incomplete personal link without exposing group data', async ({ page }) => {
  const response = await page.goto('/acesso/jogador#token=incomplete');
  expect(response?.headers()['x-frame-options']).toBe('DENY');
  expect(response?.headers()['referrer-policy']).toBe('no-referrer');
  await expect(page.getByRole('heading', { name: 'Link indisponível' })).toBeVisible();
  expect(new URL(page.url()).hash).toBe('');
  expect((await page.request.get('/api/v1/players')).status()).toBe(401);
});

test('completes private profiles, current evaluations, a recorded draw and access recovery', async ({ page, browser }, testInfo) => {
  test.setTimeout(150_000);
  const origin = new URL(testInfo.project.use.baseURL!).origin;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/entrar');
  await page.getByLabel('E-mail', { exact: true }).fill(TEST_ADMIN_EMAIL);
  await page.getByLabel('Senha', { exact: true }).fill(TEST_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/administracao$/);
  const adminCsrf = (await (await page.request.get('/api/v1/auth/csrf')).json()).csrfToken as string;
  const headers = { Origin: origin, 'x-csrf-token': adminCsrf };
  const participants: { id: string; name: string; accessUrl: string }[] = [];
  // Populate only the owned test namespace through the real registration API.
  for (let index = 0; index < 20; index++) {
    const name = index === 1 ? `MVP ${'Jogador'.repeat(13)}` : `MVP Camisa ${String(index + 1).padStart(2, '0')}`;
    const response = await page.request.post('/api/v1/players', { headers, data: { name, initialRating: index % 11 } });
    expect(response.status()).toBe(201);
    const body = await response.json();
    participants.push({ id: body.player.id, name, accessUrl: body.accessUrl });
  }
  const first = participants[0]!;
  const colleague = participants[1]!;
  const memberContext = await browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 } });
  try {
    const member = await memberContext.newPage();
    await member.goto(first.accessUrl);
    await expect(member.getByRole('button', { name: 'Entrar na pelada', exact: true })).toBeVisible();
    expect(new URL(member.url()).hash).toBe('');
    await member.getByRole('button', { name: 'Entrar na pelada', exact: true }).click();
    await expect(member).toHaveURL(new RegExp(`/jogadores/${first.id}$`));
    expect((await (await member.request.get('/api/v1/auth/me')).json()).role).toBe('PLAYER');
    await member.getByLabel('Nome', { exact: true }).fill('MVP Jogador atualizado');
    await member.getByRole('button', { name: 'Salvar nome', exact: true }).click();
    await expect(member.getByRole('heading', { name: 'MVP Jogador atualizado', exact: true })).toBeVisible();
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWNQKHZRKHZhgFAAFwIDXaggaA8AAAAASUVORK5CYII=', 'base64');
    await member.getByLabel('Foto do perfil', { exact: true }).setInputFiles({ name: 'synthetic-avatar.png', mimeType: 'image/png', buffer: png });
    await member.getByRole('button', { name: 'Enviar foto', exact: true }).click();
    await expect(member.getByRole('img', { name: 'Foto de MVP Jogador atualizado' })).toBeVisible();
    const photo = await member.request.get(`/api/v1/players/${first.id}/photo`);
    expect(photo.status()).toBe(200);
    expect(photo.headers()['content-type']).toContain('image/jpeg');
    expect(photo.headers()['cache-control']).toContain('no-store');
    expect((await page.request.get(`/api/v1/players/${first.id}/photo`)).status()).toBe(200);
    const anonymous = await browser.newContext();
    try { expect((await anonymous.request.get(`${origin}/api/v1/players/${first.id}/photo`)).status()).toBe(401); }
    finally { await anonymous.close(); }

    await member.getByLabel('Sua nota para este jogador', { exact: true }).selectOption('9');
    await member.getByRole('button', { name: 'Salvar avaliação', exact: true }).click();
    await expect(member.getByRole('status').filter({ hasText: 'Avaliação salva.' })).toBeVisible();
    await member.getByRole('link', { name: 'Jogadores e avaliações', exact: true }).click();
    await member.getByLabel('Buscar jogador', { exact: true }).fill(colleague.name);
    await expect(member.getByRole('list', { name: 'Jogadores da pelada' })).toContainText('Avaliação pendente');
    await member.getByRole('link').filter({ hasText: colleague.name }).click();
    await member.getByLabel('Sua nota para este jogador', { exact: true }).selectOption('8');
    await member.getByRole('button', { name: 'Salvar avaliação', exact: true }).click();
    await expect(member.getByRole('button', { name: 'Atualizar avaliação', exact: true })).toBeVisible();
    await member.getByLabel('Sua nota para este jogador', { exact: true }).selectOption('6');
    await member.getByRole('button', { name: 'Atualizar avaliação', exact: true }).click();
    await expect(member.getByText('Sua nota vigente é 6.', { exact: false })).toBeVisible();
    const memberTable = await (await member.request.get(`/api/v1/players/${colleague.id}/evaluations`)).json();
    expect(memberTable.evaluationCount).toBe(2);
    expect(memberTable.rating).toBe(3.5);
    expect(memberTable.evaluations.filter((row: { isOwn: boolean }) => !row.isOwn)).toEqual([{ rating: 1, isOwn: false }]);
    expect(memberTable.evaluations.find((row: { isOwn: boolean }) => row.isOwn).authorName).toBe('MVP Jogador atualizado');
    await expect(member.getByRole('table')).toContainText('Avaliação anônima');
    await expect(member.getByRole('button', { name: 'Salvar nome', exact: true })).toHaveCount(0);
    const playerCsrf = (await (await member.request.get('/api/v1/auth/csrf')).json()).csrfToken as string;
    const playerHeaders = { Origin: origin, 'x-csrf-token': playerCsrf };
    expect((await member.request.post('/api/v1/players', { headers: playerHeaders, data: { name: 'Forbidden', initialRating: 7 } })).status()).toBe(403);
    expect((await member.request.post('/api/v1/draws', { headers: playerHeaders, data: { playerIds: participants.map((player) => player.id) } })).status()).toBe(403);
    await capturePage(member, testInfo.outputPath('mobile-private-evaluations.png'));
    await expectNoHorizontalScroll(member);
    await member.setViewportSize({ width: 320, height: 812 });
    await expectNoHorizontalScroll(member);
    await capturePage(member, testInfo.outputPath('small-mobile-private-evaluations.png'));
    await member.setViewportSize({ width: 390, height: 844 });

    await page.goto(`/jogadores/${colleague.id}`);
    await expect(page.getByRole('table')).toContainText('MVP Jogador atualizado');
    await expect(page.getByRole('table')).toContainText('Administrador');
    await page.goto('/administracao/sorteios');
    // Selection controls must expose each participant name to keyboard/screen reader users.
    for (const player of participants) {
      const name = player.id === first.id ? 'MVP Jogador atualizado' : player.name;
      await page.getByRole('checkbox', { name, exact: false }).check();
    }
    const drawResponse = page.waitForResponse((response) => response.url().endsWith('/api/v1/draws') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Sortear 4 times', exact: true }).click();
    const created = await drawResponse;
    expect(created.status()).toBe(201);
    const draw = await created.json();
    await expect(page).toHaveURL(new RegExp(`/sorteios/${draw.id}$`));
    for (let number = 1; number <= 4; number++) await expect(page.getByRole('heading', { name: `Time ${number}`, exact: true })).toBeVisible();
    expect(draw.teams.map((team: { players: unknown[] }) => team.players.length)).toEqual([5, 5, 5, 5]);
    expect(new Set(draw.teams.flatMap((team: { players: { id: string }[] }) => team.players.map((player) => player.id))).size).toBe(20);
    await capturePage(page, testInfo.outputPath('desktop-draw-result.png'));
    expect((await page.request.post(`/api/v1/players/${colleague.id}/evaluations`, { headers, data: { rating: 10 } })).status()).toBe(200);
    const recorded = await (await page.request.get(`/api/v1/draws/${draw.id}`)).json();
    expect(recorded).toEqual(draw);
    await member.goto(`/sorteios/${draw.id}`);
    await expect(member.getByRole('heading', { name: 'Time 1', exact: true })).toBeVisible();
    await capturePage(member, testInfo.outputPath('mobile-draw-result.png'));
    await expectNoHorizontalScroll(member);
    await member.setViewportSize({ width: 320, height: 812 });
    await expectNoHorizontalScroll(member);
    await capturePage(member, testInfo.outputPath('small-mobile-draw-result.png'));
    await member.setViewportSize({ width: 390, height: 844 });

    await page.goto(`/jogadores/${first.id}`);
    await page.getByRole('button', { name: 'Revogar acesso', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar revogação', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Acesso revogado.' })).toBeVisible();
    expect((await member.request.get('/api/v1/auth/me')).status()).toBe(401);
    await member.goto(first.accessUrl);
    await member.getByRole('button', { name: 'Entrar na pelada', exact: true }).click();
    await expect(member.getByRole('heading', { name: 'Link indisponível' })).toBeVisible();
    await page.getByRole('button', { name: 'Gerar novo link', exact: true }).click();
    const rotationResponse = page.waitForResponse((response) => response.url().endsWith(`/players/${first.id}/access-link/rotate`) && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Confirmar novo link', exact: true }).click();
    const newLink = (await (await rotationResponse).json()).accessUrl as string;
    expect(newLink === first.accessUrl).toBe(false);
    await page.getByRole('button', { name: 'Ocultar link', exact: true }).click();
    await member.goto(newLink);
    await member.getByRole('button', { name: 'Entrar na pelada', exact: true }).click();
    await expect(member).toHaveURL(new RegExp(`/jogadores/${first.id}$`));
    await member.getByRole('button', { name: 'Remover foto', exact: true }).click();
    await expect(member.getByRole('img', { name: 'Foto de MVP Jogador atualizado' })).toHaveCount(0);
    await member.getByRole('button', { name: 'Sair', exact: true }).click();
    await expect(member).toHaveURL(/\/entrar$/);
    await member.goto(newLink);
    await member.getByRole('button', { name: 'Entrar na pelada', exact: true }).click();
    await expect(member).toHaveURL(new RegExp(`/jogadores/${first.id}$`));
  } finally { await memberContext.close(); }
});
