import 'reflect-metadata';
import { randomInt, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import sharp from 'sharp';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';
import { PrismaService } from '../src/database/prisma.service';
import { AUTH_CONFIGURATION, type AuthConfiguration } from '../src/modules/access/auth-configuration';
import { AUTH_CLOCK, type Clock } from '../src/modules/access/clock';
import { PILOT_GROUP_ID, PLAYER_SESSION_TTL_MS, RATE_WINDOW_MS, SESSION_TTL_MS } from '../src/modules/access/auth-policy';
import { newSecret, secretHash } from '../src/modules/access/auth-secrets';
import { hashPassword } from '../src/modules/access/password';
import { requireTestDatabaseUrl } from '../scripts/test-database.cjs';

class NativeClock implements Clock {
  value = Date.UTC(2140, 0, 1) + randomInt(0, 100_000) * RATE_WINDOW_MS;
  now(): Date { return new Date(this.value); }
  async sleep(milliseconds: number): Promise<void> { this.value += milliseconds; }
  nextWindow(): void { this.value += RATE_WINDOW_MS; }
}
type CreatedPlayer = { id: string; token: string };

describe('Native opaque sessions', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let memberToken: string;
  let first: CreatedPlayer;
  let second: CreatedPlayer;
  const players: string[] = [];
  const clock = new NativeClock();
  const email = `native-${randomUUID()}@example.test`;
  const password = 'Native independent fixture password!';
  const configuration: AuthConfiguration = { adminEmail: email, passwordHash: '', origin: 'http://localhost:3000', secureCookies: false, secret: Buffer.alloc(32, 19) };

  function nativeLogin(address = email, value = password) {
    return request(app.getHttpServer()).post('/api/v1/auth/native/admin/login').send({ email: address, password: value });
  }
  function nativeRedeem(token: string) {
    return request(app.getHttpServer()).post('/api/v1/auth/native/player/redeem').send({ token });
  }
  function read(path: string, token = adminToken) {
    return request(app.getHttpServer()).get(`/api/v1/${path}`).set('Authorization', `Bearer ${token}`);
  }
  function mutate(path: string, body: object = {}, token = adminToken, method: 'post' | 'delete' = 'post') {
    return request(app.getHttpServer())[method](`/api/v1/${path}`).set('Authorization', `Bearer ${token}`).send(body);
  }
  async function create(name = 'Jogador nativo', own = false): Promise<CreatedPlayer> {
    const response = await mutate('players', { name, initialRating: 7, ...(own ? { linkToCurrentAdministrator: true } : {}) }).expect(201);
    const id = response.body.player.id as string;
    players.push(id);
    return { id, token: new URLSearchParams(new URL(response.body.accessUrl as string).hash.slice(1)).get('token')! };
  }

  beforeAll(async () => {
    configuration.passwordHash = await hashPassword(password);
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = requireTestDatabaseUrl(process.env);
    try {
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(AUTH_CONFIGURATION).useValue(configuration)
        .overrideProvider(AUTH_CLOCK).useValue(clock).compile();
      app = module.createNestApplication({ logger: false });
      configureApplication(app);
      await app.init();
      prisma = app.get(PrismaService);
    } finally {
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
  beforeEach(async () => {
    clock.nextWindow();
    const login = await nativeLogin().expect(200);
    adminToken = login.body.token as string;
    first = await create('Primeiro nativo');
    second = await create('Segundo nativo');
    memberToken = (await nativeRedeem(first.token).expect(200)).body.token as string;
  });
  afterEach(async () => {
    if (!prisma) return;
    const rows = await prisma.player.findMany({ where: { id: { in: players } }, select: { identityId: true } });
    await prisma.draw.deleteMany({ where: { createdBy: (await prisma.identity.findUnique({ where: { email } }))?.id ?? randomUUID() } });
    await prisma.player.deleteMany({ where: { id: { in: players.splice(0) } } });
    await prisma.identity.deleteMany({ where: { id: { in: rows.map((row) => row.identityId) }, email: null } });
  });
  afterAll(async () => {
    if (prisma) await prisma.identity.deleteMany({ where: { email } });
    await app?.close();
  });

  it('returns a native administrator session without cookies and persists only its hash', async () => {
    const response = await nativeLogin(email.toUpperCase()).expect(200);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.headers['cache-control']).toContain('no-store');
    expect(response.body).toEqual({ token: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/), session: { role: 'ADMIN', email, identityId: expect.any(String), groupId: PILOT_GROUP_ID } });
    const token = response.body.token as string;
    const stored = await prisma.accessSession.findUniqueOrThrow({ where: { tokenHash: secretHash(token) } });
    expect(stored.expiresAt.getTime() - clock.value).toBe(SESSION_TTL_MS);
    expect(JSON.stringify(stored)).not.toContain(token);
    await read('auth/me', token).expect(200).expect(response.body.session);
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('returns a player session with the same membership and seven-day revocation policy', async () => {
    const response = await nativeRedeem(first.token).expect(200);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.body.session).toMatchObject({ role: 'PLAYER', playerId: first.id, groupId: PILOT_GROUP_ID });
    expect(response.body.session.email).toBeUndefined();
    const session = await prisma.accessSession.findUniqueOrThrow({ where: { tokenHash: secretHash(response.body.token as string) } });
    expect(session.expiresAt.getTime() - clock.value).toBe(PLAYER_SESSION_TTL_MS);
    expect(session.playerCredentialId).toBeTruthy();
    await read('auth/me', response.body.token as string).expect(200).expect(response.body.session);
  });

  it('rejects browser Origin, Cookie and ambient Authorization on both native entry points', async () => {
    for (const route of ['admin/login', 'player/redeem']) {
      const body = route === 'admin/login' ? { email, password } : { token: first.token };
      for (const origin of [configuration.origin, 'https://foreign.example.test', 'null']) {
        await request(app.getHttpServer()).post(`/api/v1/auth/native/${route}`).set('Origin', origin).send(body).expect(403);
      }
      await request(app.getHttpServer()).post(`/api/v1/auth/native/${route}`).set('Cookie', `futeio_session=${adminToken}`).send(body).expect(403);
      await request(app.getHttpServer()).post(`/api/v1/auth/native/${route}`).set('Cookie', 'unrelated=ambient').send(body).expect(403);
      await request(app.getHttpServer()).post(`/api/v1/auth/native/${route}`).set('Authorization', `Bearer ${adminToken}`).send(body).expect(403);
    }
  });

  it('rejects malformed, duplicate and conflicting Authorization without cookie fallback', async () => {
    for (const authorization of ['Basic anything', 'Bearer bad', `Bearer ${newSecret()}`, `Bearer ${adminToken}, Bearer ${adminToken}`]) {
      await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', authorization).expect(401);
      await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', authorization).set('Cookie', `futeio_session=${adminToken}`).expect(401);
    }
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${adminToken}`).set('Cookie', `futeio_session=${adminToken}`).expect(401);
    await request(app.getHttpServer()).get('/api/v1/auth/me').set({ Authorization: [`Bearer ${adminToken}`, `Bearer ${adminToken}`] }).expect(401);
    await request(app.getHttpServer()).post('/api/v1/auth/logout').set('Authorization', 'Bearer bad').send({}).expect(401);
    await read('auth/me').expect(200);
  });

  it('never treats an anonymous browser cookie as an authenticated bearer', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/auth/csrf').expect(200);
    const cookie = (response.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
    const token = cookie.split('=')[1]!;
    await read('auth/me', token).expect(401);
    await mutate('auth/logout', {}, token).expect(401);
  });

  it('keeps browser mutations protected by exact Origin and cookie-bound CSRF', async () => {
    const cookie = `futeio_session=${adminToken}`;
    const csrf = await request(app.getHttpServer()).get('/api/v1/auth/csrf').set('Cookie', cookie).expect(200);
    await request(app.getHttpServer()).post('/api/v1/auth/logout').set('Cookie', cookie).send({}).expect(403);
    await request(app.getHttpServer()).post('/api/v1/auth/logout').set('Cookie', cookie).set('Origin', 'https://foreign.example.test').set('x-csrf-token', csrf.body.csrfToken as string).send({}).expect(403);
    await request(app.getHttpServer()).post('/api/v1/auth/logout').set('Cookie', cookie).set('Origin', configuration.origin).send({}).expect(403);
    await read('auth/me').expect(200);
  });

  it('validates credentials and DTOs without exposing passwords or privilege escalation', async () => {
    await nativeLogin('unknown@example.test').expect(401);
    await nativeLogin(email, 'wrong fixture').expect(401);
    for (const body of [{ email, password, role: 'ADMIN' }, { email: 'invalid', password }, { email }, { email, password: '' }]) {
      await request(app.getHttpServer()).post('/api/v1/auth/native/admin/login').send(body).expect(400);
    }
    await nativeRedeem('bad').expect(400);
    await nativeRedeem(newSecret()).expect(401);
    await request(app.getHttpServer()).post('/api/v1/auth/native/player/redeem').send({ token: first.token, role: 'ADMIN' }).expect(400);
  });

  it('shares the email login budget across native and browser endpoints', async () => {
    const unknown = `limited-${randomUUID()}@example.test`;
    for (let index = 0; index < 4; index++) await nativeLogin(unknown).expect(401);
    const agent = request.agent(app.getHttpServer());
    const csrf = (await agent.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
    await agent.post('/api/v1/auth/admin/login').set('Origin', configuration.origin).set('x-csrf-token', csrf).send({ email: unknown, password }).expect(401);
    const limited = await nativeLogin(unknown).expect(429);
    expect(limited.headers['retry-after']).toBeDefined();
  });

  it('shares the peer login budget and ignores spoofed forwarding headers', async () => {
    for (let index = 0; index < 9; index++) {
      await nativeLogin(`peer-${index}-${randomUUID()}@example.test`).set('x-forwarded-for', `192.0.2.${index}`).expect(401);
    }
    const agent = request.agent(app.getHttpServer());
    const csrf = (await agent.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
    await agent.post('/api/v1/auth/admin/login').set('Origin', configuration.origin).set('x-csrf-token', csrf).send({ email: 'peer-last@example.test', password }).expect(429);
  });

  it('shares the player redemption budget between browser and native entry points', async () => {
    for (let index = 0; index < 59; index++) await nativeRedeem(newSecret()).expect(401);
    const agent = request.agent(app.getHttpServer());
    const csrf = (await agent.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
    await agent.post('/api/v1/auth/player/redeem').set('Origin', configuration.origin).set('x-csrf-token', csrf).send({ token: first.token }).expect(429);
  });

  it('revokes only the current native session at logout without emitting cookies', async () => {
    const another = (await nativeRedeem(first.token).expect(200)).body.token as string;
    const response = await mutate('auth/logout', {}, memberToken).expect(200);
    expect(response.headers['set-cookie']).toBeUndefined();
    await read('auth/me', memberToken).expect(401);
    await read('auth/me', another).expect(200);
    await nativeRedeem(first.token).expect(200);
  });

  it('expires administrator and player sessions without extending them through requests', async () => {
    clock.value += SESSION_TTL_MS + 1;
    await read('auth/me').expect(401);
    await read('auth/me', memberToken).expect(200);
    clock.value += PLAYER_SESSION_TTL_MS;
    await read('auth/me', memberToken).expect(401);
  });

  it('checks the administrator credential version on every bearer request', async () => {
    const original = configuration.passwordHash;
    configuration.passwordHash = await hashPassword('A new native fixture password!');
    try { await read('auth/me').expect(401); }
    finally { configuration.passwordHash = original; }
  });

  it('invalidates browser and native player sessions together when rotating or revoking a link', async () => {
    const browser = request.agent(app.getHttpServer());
    const csrf = (await browser.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
    await browser.post('/api/v1/auth/player/redeem').set('Origin', configuration.origin).set('x-csrf-token', csrf).send({ token: first.token }).expect(200);
    const rotation = await mutate(`players/${first.id}/access-link/rotate`).expect(200);
    await read('auth/me', memberToken).expect(401);
    await browser.get('/api/v1/auth/me').expect(401);
    await nativeRedeem(first.token).expect(401);
    const replacement = new URLSearchParams(new URL(rotation.body.accessUrl as string).hash.slice(1)).get('token')!;
    const refreshed = (await nativeRedeem(replacement).expect(200)).body.token as string;
    await mutate(`players/${first.id}/access-link`, {}, adminToken, 'delete').expect(200);
    await read('auth/me', refreshed).expect(401);
    await nativeRedeem(replacement).expect(401);
  });

  it('keeps administrator-associated personal links restricted to player privileges', async () => {
    const own = await create('Administrador como jogador', true);
    const response = await nativeRedeem(own.token).expect(200);
    expect(response.body.session.role).toBe('PLAYER');
    await mutate('players', { name: 'Forbidden', initialRating: 7 }, response.body.token as string).expect(403);
  });

  it('preserves profile permissions, private photos and anonymous evaluation authorship', async () => {
    await mutate(`players/${first.id}/profile`, { name: 'Meu novo nome' }, memberToken).expect(200);
    await mutate(`players/${second.id}/profile`, { name: 'Forbidden' }, memberToken).expect(403);
    await mutate(`players/${second.id}/evaluations`, { rating: 9 }, memberToken).expect(200);
    await mutate(`players/${first.id}/evaluations`, { rating: 5 }, memberToken).expect(200);
    const table = await read(`players/${second.id}/evaluations`, memberToken).expect(200);
    expect(table.body.evaluations).toEqual([{ rating: 7, isOwn: false }, { rating: 9, isOwn: true, authorName: 'Meu novo nome' }]);
    const adminTable = await read(`players/${second.id}/evaluations`).expect(200);
    expect(adminTable.body.evaluations.every((row: { authorName?: string }) => row.authorName)).toBe(true);
    const photo = (await sharp({ create: { width: 2, height: 2, channels: 3, background: '#123456' } }).png().toBuffer()).toString('base64');
    await mutate(`players/${first.id}/photo`, { data: photo }, memberToken).expect(200);
    await read(`players/${first.id}/photo`, memberToken).expect(200);
    await request(app.getHttpServer()).get(`/api/v1/players/${first.id}/photo`).expect(401);
    await mutate(`players/${second.id}/photo`, { data: photo }, memberToken).expect(403);
  });

  it('uses the existing backend draw rules and denies player creation of draws', async () => {
    const ids = [first.id, second.id];
    for (let index = 2; index < 20; index++) ids.push((await create(`Participante ${index}`)).id);
    await mutate('draws', { playerIds: ids }, memberToken).expect(403);
    const draw = await mutate('draws', { playerIds: ids }).expect(201);
    expect(draw.body.teams).toHaveLength(4);
    expect(draw.body.teams.every((team: { players: unknown[] }) => team.players.length === 5)).toBe(true);
    await read(`draws/${draw.body.id as string}`, memberToken).expect(200).expect(draw.body);
    await mutate('draws', { playerIds: ids.slice(1) }).expect(400);
  });
});
