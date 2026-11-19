import { expect, test } from './fixtures';
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from '../test/admin-fixture.mjs';

test.beforeAll(() => {
  if (process.env.FUTEIO_E2E_ISOLATED !== '1') throw new Error('Use the isolated E2E orchestrator.');
});

test('native sessions use the same private profiles, evaluations, photos and recorded draws as the website', async ({ playwright }, testInfo) => {
  test.setTimeout(120_000);
  const origin = new URL(testInfo.project.use.baseURL!).origin;
  const native = await playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { 'X-Futeio-Client': 'native' } });
  const member = await playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { 'X-Futeio-Client': 'native' } });
  const web = await playwright.request.newContext({ baseURL: origin });
  try {
    const login = await native.post('/api/v1/auth/native/admin/login', { data: { email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD } });
    expect(login.status()).toBe(200);
    expect(login.headers()['set-cookie']).toBeUndefined();
    expect((await native.storageState()).cookies).toEqual([]);
    const access = await login.json();
    const adminHeaders = { Authorization: `Bearer ${access.token}` };
    expect((await native.get('/api/v1/auth/me', { headers: adminHeaders })).status()).toBe(200);
    const participants: { id: string; accessUrl: string }[] = [];
    for (let index = 0; index < 20; index++) {
      const created = await native.post('/api/v1/players', { headers: adminHeaders, data: { name: `Nativo compartilhado ${index}`, initialRating: index === 0 ? 5 : index % 11 } });
      expect(created.status()).toBe(201);
      const body = await created.json();
      participants.push({ id: body.player.id, accessUrl: body.accessUrl });
    }
    const target = participants[0]!;
    const personalToken = new URLSearchParams(new URL(target.accessUrl).hash.slice(1)).get('token');
    const redeemed = await member.post('/api/v1/auth/native/player/redeem', { data: { token: personalToken } });
    expect(redeemed.status()).toBe(200);
    expect(redeemed.headers()['set-cookie']).toBeUndefined();
    const player = await redeemed.json();
    const playerHeaders = { Authorization: `Bearer ${player.token}` };
    const rated = await member.post(`/api/v1/players/${target.id}/evaluations`, { headers: playerHeaders, data: { rating: 9 } });
    expect(rated.status()).toBe(200);
    const notes = await rated.json();
    expect(notes.rating).toBe(7);
    expect(notes.evaluations.find((row: { isOwn: boolean }) => !row.isOwn)).toEqual({ rating: 5, isOwn: false });
    expect((await member.post('/api/v1/players', { headers: playerHeaders, data: { name: 'Proibido', initialRating: 5 } })).status()).toBe(403);
    expect((await member.post(`/api/v1/players/${participants[1]!.id}/profile`, { headers: playerHeaders, data: { name: 'Proibido' } })).status()).toBe(403);
    expect((await member.post('/api/v1/draws', { headers: playerHeaders, data: { playerIds: participants.map(row => row.id) } })).status()).toBe(403);
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWNQKHZRKHZhgFAAFwIDXaggaA8AAAAASUVORK5CYII=';
    expect((await member.post(`/api/v1/players/${target.id}/photo`, { headers: playerHeaders, data: { data: png } })).status()).toBe(200);
    const photo = await member.get(`/api/v1/players/${target.id}/photo`, { headers: playerHeaders });
    expect(photo.status()).toBe(200);
    expect(photo.headers()['content-type']).toBe('image/jpeg');
    expect(photo.headers()['cache-control']).toContain('no-store');
    expect((await web.get(`/api/v1/players/${target.id}/photo`)).status()).toBe(401);
    const anonymous = await web.get('/api/v1/auth/csrf');
    const csrf = (await anonymous.json()).csrfToken;
    expect((await web.post('/api/v1/auth/admin/login', { headers: { Origin: origin, 'x-csrf-token': csrf }, data: { email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD } })).status()).toBe(200);
    const list = await web.get('/api/v1/players');
    expect(list.status()).toBe(200);
    expect((await list.json()).find((row: { id: string }) => row.id === target.id).rating).toBe(7);
    const createdDraw = await native.post('/api/v1/draws', { headers: adminHeaders, data: { playerIds: participants.map(row => row.id), seed: 'shared-native-api' } });
    expect(createdDraw.status()).toBe(201);
    const draw = await createdDraw.json();
    expect(draw.teams.map((team: { players: unknown[] }) => team.players.length)).toEqual([5, 5, 5, 5]);
    const browserDraw = await web.get(`/api/v1/draws/${draw.id}`);
    expect(browserDraw.status()).toBe(200);
    expect(await browserDraw.json()).toEqual(draw);
    expect((await member.get(`/api/v1/draws/${draw.id}`, { headers: playerHeaders })).status()).toBe(200);
    expect((await member.delete(`/api/v1/players/${target.id}/photo`, { headers: playerHeaders })).status()).toBe(200);
    expect((await native.post(`/api/v1/players/${target.id}/access-link/rotate`, { headers: adminHeaders, data: {} })).status()).toBe(200);
    expect((await member.get('/api/v1/players', { headers: playerHeaders })).status()).toBe(401);
    expect((await native.post('/api/v1/auth/logout', { headers: adminHeaders })).status()).toBe(200);
    expect((await native.get('/api/v1/auth/me', { headers: adminHeaders })).status()).toBe(401);
    expect((await web.get('/api/v1/auth/me')).status()).toBe(200);
  } finally { await Promise.all([native.dispose(), member.dispose(), web.dispose()]); }
});

test('HTTP transport boundaries reject ambient cookies and preserve website CSRF checks', async ({ playwright }, testInfo) => {
  const origin = new URL(testInfo.project.use.baseURL!).origin;
  const native = await playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { 'X-Futeio-Client': 'native' } });
  const web = await playwright.request.newContext({ baseURL: origin });
  const bare = await playwright.request.newContext({ baseURL: origin });
  try {
    const initial = await web.get('/api/v1/auth/csrf');
    const csrf = (await initial.json()).csrfToken;
    const signedIn = await web.post('/api/v1/auth/admin/login', { headers: { Origin: origin, 'x-csrf-token': csrf }, data: { email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD } });
    expect(signedIn.status()).toBe(200);
    const cookie = (await web.storageState()).cookies.find(row => row.name === 'futeio_session')!;
    const login = await native.post('/api/v1/auth/native/admin/login', { data: { email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD } });
    expect(login.status()).toBe(200);
    const { token } = await login.json();
    expect((await bare.get('/api/v1/auth/me', { headers: { Cookie: `futeio_session=${token}` } })).status()).toBe(401);
    expect((await native.get('/api/v1/auth/me', { headers: { Authorization: `Bearer ${cookie.value}` } })).status()).toBe(401);
    expect((await native.get('/api/v1/auth/me', { headers: { Authorization: `Bearer ${token}`, Cookie: `futeio_session=${cookie.value}` } })).status()).toBe(400);
    expect((await native.get('/api/v1/auth/me', { headers: { Authorization: `Bearer ${token}`, Origin: origin } })).status()).toBe(403);
    expect((await bare.get('/api/v1/auth/me', { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(401);
    expect((await native.post('/api/v1/auth/native/admin/login', { headers: { Origin: origin }, data: { email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD } })).status()).toBe(403);
    expect((await web.post('/api/v1/players', { headers: { Origin: origin }, data: { name: 'Sem CSRF', initialRating: 5 } })).status()).toBe(403);
    expect((await web.get('/api/v1/auth/me')).status()).toBe(200);
  } finally { await Promise.all([native.dispose(), web.dispose(), bare.dispose()]); }
});
