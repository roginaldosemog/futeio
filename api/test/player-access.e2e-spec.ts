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
import { PILOT_GROUP_ID, PLAYER_SESSION_TTL_MS, RATE_WINDOW_MS } from '../src/modules/access/auth-policy';
import { hashPassword } from '../src/modules/access/password';
import { newSecret, secretHash } from '../src/modules/access/auth-secrets';
import { requireTestDatabaseUrl } from '../scripts/test-database.cjs';

class PlayerClock implements Clock {
  value = Date.UTC(2120, 0, 1) + randomInt(0, 100_000) * RATE_WINDOW_MS;
  now(): Date { return new Date(this.value); }
  async sleep(milliseconds: number): Promise<void> { this.value += milliseconds; }
  nextWindow(): void { this.value += RATE_WINDOW_MS; }
}
type Agent = ReturnType<typeof request.agent>;
type CreatedPlayer = { id: string; token: string; accessUrl: string };

describe('Player links and private profiles', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Agent;
  let member: Agent;
  let first: CreatedPlayer;
  let second: CreatedPlayer;
  let adminId: string;
  const createdIds: string[] = [];
  const clock = new PlayerClock();
  const email = `access-profiles-${randomUUID()}@example.test`;
  const password = 'Private player fixture password!';
  const configuration: AuthConfiguration = { adminEmail: email, passwordHash: '', origin: 'http://localhost:3000', secureCookies: false, secret: Buffer.alloc(32, 13) };

  async function mutate(agent: Agent, path: string, body: object = {}, method: 'post' | 'delete' = 'post') {
    const csrf = (await agent.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
    return agent[method](`/api/v1/${path}`).set('Origin', configuration.origin).set('x-csrf-token', csrf).send(body);
  }
  async function create(name: string, own = false): Promise<CreatedPlayer> {
    const response = await mutate(admin, 'players', { name, initialRating: 7, ...(own ? { linkToCurrentAdministrator: true } : {}) });
    expect(response.status).toBe(201);
    const id = response.body.player.id as string;
    createdIds.push(id);
    const accessUrl = response.body.accessUrl as string;
    return { id, accessUrl, token: new URLSearchParams(new URL(accessUrl).hash.slice(1)).get('token')! };
  }
  async function redeem(token: string, expected = 200): Promise<Agent> {
    const agent = request.agent(app.getHttpServer());
    const response = await mutate(agent, 'auth/player/redeem', { token });
    expect(response.status).toBe(expected);
    return agent;
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
    admin = request.agent(app.getHttpServer());
    const response = await mutate(admin, 'auth/admin/login', { email, password });
    expect(response.status).toBe(200);
    adminId = response.body.identityId as string;
    first = await create('Primeiro jogador');
    second = await create('Segundo jogador');
    member = await redeem(first.token);
  });
  afterEach(async () => {
    if (!prisma) return;
    const rows = await prisma.player.findMany({ where: { id: { in: createdIds } }, select: { identityId: true } });
    await prisma.player.deleteMany({ where: { id: { in: createdIds.splice(0) } } });
    await prisma.identity.deleteMany({ where: { id: { in: rows.map((row) => row.identityId).filter((id) => id !== adminId) } } });
  });
  afterAll(async () => {
    if (prisma) await prisma.identity.deleteMany({ where: { email } });
    await app?.close();
  });

  it('establishes a restricted seven-day session and stores only credential/session hashes', async () => {
    const response = await member.get('/api/v1/auth/me').expect(200);
    expect(response.body).toMatchObject({ role: 'PLAYER', playerId: first.id, groupId: PILOT_GROUP_ID });
    expect(response.body.email).toBeUndefined();
    const session = await prisma.accessSession.findFirstOrThrow({ where: { identityId: response.body.identityId as string, role: 'PLAYER', revokedAt: null } });
    expect(session.expiresAt.getTime() - session.createdAt.getTime()).toBe(PLAYER_SESSION_TTL_MS);
    expect(session.playerCredentialId).toBeTruthy();
    const credential = await prisma.playerAccessCredential.findUniqueOrThrow({ where: { id: session.playerCredentialId! } });
    expect(credential.tokenHash).toBe(secretHash(first.token));
    expect(JSON.stringify([session, credential])).not.toContain(first.token);
    expect(response.headers['cache-control']).toContain('no-store');
  });

  it('requires exact origin and a CSRF token and rejects malformed or unknown credentials', async () => {
    const anonymous = request.agent(app.getHttpServer());
    await anonymous.get('/api/v1/auth/csrf').expect(200);
    await anonymous.post('/api/v1/auth/player/redeem').set('Origin', configuration.origin).send({ token: first.token }).expect(403);
    const csrf = (await anonymous.get('/api/v1/auth/csrf')).body.csrfToken as string;
    await anonymous.post('/api/v1/auth/player/redeem').set('Origin', 'https://other.example.test').set('x-csrf-token', csrf).send({ token: first.token }).expect(403);
    expect((await mutate(anonymous, 'auth/player/redeem', { token: 'bad' })).status).toBe(400);
    expect((await mutate(anonymous, 'auth/player/redeem', { token: newSecret() })).status).toBe(401);
    expect((await mutate(anonymous, 'auth/player/redeem', { token: first.token, role: 'ADMIN' })).status).toBe(400);
  });

  it('reuses a link across browsers while logout revokes only the current session', async () => {
    const another = await redeem(first.token);
    expect((await mutate(member, 'auth/logout')).status).toBe(200);
    await member.get('/api/v1/auth/me').expect(401);
    await another.get('/api/v1/auth/me').expect(200);
    const reopened = await redeem(first.token);
    await reopened.get('/api/v1/auth/me').expect(200);
  });

  it('limits authenticated CSRF per session without blocking another member behind the same proxy', async () => {
    const another = await redeem(second.token);
    for (let count = 0; count < 60; count++) await member.get('/api/v1/auth/csrf').expect(200);
    const blocked = await member.get('/api/v1/auth/csrf').expect(429);
    expect(blocked.headers['retry-after']).toEqual(expect.any(String));
    await another.get('/api/v1/auth/csrf').expect(200);
    await admin.get('/api/v1/auth/csrf').expect(200);
    clock.nextWindow();
    await member.get('/api/v1/auth/csrf').expect(200);
  });

  it('expires a player session after seven days without expiring the reusable link', async () => {
    clock.value += PLAYER_SESSION_TTL_MS + 1;
    await member.get('/api/v1/auth/me').expect(401);
    const reopened = await redeem(first.token);
    await reopened.get('/api/v1/auth/me').expect(200);
  });

  it('never grants administrative rights through an administrator-associated player link', async () => {
    const own = await create('Administrador em campo', true);
    const limited = await redeem(own.token);
    const response = await limited.get('/api/v1/auth/me').expect(200);
    expect(response.body).toMatchObject({ role: 'PLAYER', identityId: adminId, playerId: own.id });
    expect(response.body.email).toBeUndefined();
    expect((await mutate(limited, 'players', { name: 'Negado', initialRating: 7 })).status).toBe(403);
    expect((await mutate(limited, `players/${first.id}/access-link/rotate`)).status).toBe(403);
    expect((await mutate(limited, `players/${first.id}/access-link`, {}, 'delete')).status).toBe(403);
    await admin.get('/api/v1/auth/me').expect(200);
  });

  it('rotates a link and invalidates every old session without changing the profile or rating', async () => {
    const another = await redeem(first.token);
    const response = await mutate(admin, `players/${first.id}/access-link/rotate`);
    expect(response.status).toBe(200);
    expect(response.body.accessUrl).not.toBe(first.accessUrl);
    await member.get('/api/v1/auth/me').expect(401);
    await another.get('/api/v1/auth/me').expect(401);
    await redeem(first.token, 401);
    const token = new URLSearchParams(new URL(response.body.accessUrl as string).hash.slice(1)).get('token')!;
    await (await redeem(token)).get(`/api/v1/players/${first.id}`).expect(200);
    expect(await prisma.playerAccessCredential.count({ where: { playerId: first.id, revokedAt: null } })).toBe(1);
    const profile = await admin.get(`/api/v1/players/${first.id}`).expect(200);
    expect(profile.body).toMatchObject({ id: first.id, name: 'Primeiro jogador', rating: 7 });
  });

  it('revokes without replacement and can subsequently generate a new usable link', async () => {
    expect((await mutate(admin, `players/${first.id}/access-link`, {}, 'delete')).status).toBe(200);
    expect(await prisma.playerAccessCredential.count({ where: { playerId: first.id, revokedAt: null } })).toBe(0);
    await member.get('/api/v1/auth/me').expect(401);
    await redeem(first.token, 401);
    const rotated = await mutate(admin, `players/${first.id}/access-link/rotate`);
    expect(rotated.status).toBe(200);
    const token = new URLSearchParams(new URL(rotated.body.accessUrl as string).hash.slice(1)).get('token')!;
    await (await redeem(token)).get('/api/v1/auth/me').expect(200);
  });

  it('serializes redemption against rotation so old credentials leave no usable sessions', async () => {
    const concurrent = request.agent(app.getHttpServer());
    const csrf = (await concurrent.get('/api/v1/auth/csrf')).body.csrfToken as string;
    const adminCsrf = (await admin.get('/api/v1/auth/csrf')).body.csrfToken as string;
    const [redeemed, rotated] = await Promise.all([
      concurrent.post('/api/v1/auth/player/redeem').set('Origin', configuration.origin).set('x-csrf-token', csrf).send({ token: first.token }),
      admin.post(`/api/v1/players/${first.id}/access-link/rotate`).set('Origin', configuration.origin).set('x-csrf-token', adminCsrf).send({}),
    ]);
    expect([200, 401]).toContain(redeemed.status);
    expect(rotated.status).toBe(200);
    await concurrent.get('/api/v1/auth/me').expect(401);
    await member.get('/api/v1/auth/me').expect(401);
    const activeOldSessions = await prisma.accessSession.count({ where: { playerCredential: { tokenHash: secretHash(first.token) }, revokedAt: null } });
    expect(activeOldSessions).toBe(0);
  });

  it('requires a valid matching credential even when an unexpired session row exists', async () => {
    const firstPlayer = await prisma.player.findUniqueOrThrow({ where: { id: first.id } });
    const foreignCredential = await prisma.playerAccessCredential.findFirstOrThrow({ where: { playerId: second.id } });
    for (const playerCredentialId of [null, foreignCredential.id]) {
      const token = newSecret();
      await prisma.accessSession.create({ data: { tokenHash: secretHash(token), role: 'PLAYER', groupId: PILOT_GROUP_ID, identityId: firstPlayer.identityId, playerCredentialId, expiresAt: new Date(clock.value + 60_000) } });
      await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', `futeio_session=${token}`).expect(401);
    }
    await prisma.playerAccessCredential.updateMany({ where: { playerId: first.id }, data: { revokedAt: clock.now() } });
    await member.get('/api/v1/auth/me').expect(401);
  });

  it('limits profiles to the group and never returns personal links or internal authors', async () => {
    await request(app.getHttpServer()).get(`/api/v1/players/${first.id}`).expect(401);
    await member.get(`/api/v1/players/${randomUUID()}`).expect(404);
    const own = await member.get(`/api/v1/players/${first.id}`).expect(200);
    expect(own.body).toEqual({ id: first.id, name: 'Primeiro jogador', rating: 7, isOwnProfile: true, canEdit: true });
    const peer = await member.get(`/api/v1/players/${second.id}`).expect(200);
    expect(peer.body).toMatchObject({ id: second.id, canEdit: false, isOwnProfile: false });
    const list = await member.get('/api/v1/players').expect(200);
    for (const body of [list.body, own.body, peer.body]) {
      const json = JSON.stringify(body);
      for (const secret of [first.token, second.token, 'tokenHash', 'identityId', 'evaluatorIdentityId', email]) expect(json).not.toContain(secret);
    }
    const group = await prisma.group.create({ data: { slug: `private-${randomUUID()}`, name: 'Other fixture' } });
    const identity = await prisma.identity.create({ data: { memberships: { create: { groupId: group.id, role: 'PLAYER' } } } });
    try {
      const player = await prisma.player.create({ data: { groupId: group.id, identityId: identity.id, name: 'Other group' } });
      await admin.get(`/api/v1/players/${player.id}`).expect(404);
      await member.get(`/api/v1/players/${player.id}/photo`).expect(404);
      expect((await mutate(admin, `players/${player.id}/access-link/rotate`)).status).toBe(404);
      expect((await mutate(member, `players/${player.id}/profile`, { name: 'Intruder' })).status).toBe(404);
    } finally {
      await prisma.group.delete({ where: { id: group.id } });
      await prisma.identity.delete({ where: { id: identity.id } });
    }
  });

  it('allows only the owner and administrator to maintain a profile name', async () => {
    const renamed = await mutate(member, `players/${first.id}/profile`, { name: '  Nome atualizado  ' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe('Nome atualizado');
    expect((await mutate(member, `players/${second.id}/profile`, { name: 'Negado' })).status).toBe(403);
    expect((await mutate(admin, `players/${second.id}/profile`, { name: 'Corrigido pelo administrador' })).status).toBe(200);
    for (const body of [{ name: '  ' }, { name: 'x'.repeat(101) }, { name: 'Válido', identityId: adminId }, { name: 8 }]) expect((await mutate(member, `players/${first.id}/profile`, body)).status).toBe(400);
  });

  it('decodes, resizes and strips photo metadata while serving images only to members', async () => {
    const bytes = await sharp({ create: { width: 600, height: 900, channels: 3, background: '#224466' } }).jpeg().withExif({ IFD0: { Artist: 'Private fixture author' } }).toBuffer();
    const uploaded = await mutate(member, `players/${first.id}/photo`, { data: bytes.toString('base64') });
    expect(uploaded.status).toBe(200);
    expect(uploaded.body.photoUrl).toBe(`/api/v1/players/${first.id}/photo`);
    await request(app.getHttpServer()).get(uploaded.body.photoUrl as string).expect(401);
    const photo = await member.get(uploaded.body.photoUrl as string).expect(200);
    expect(photo.headers['content-type']).toContain('image/jpeg');
    expect(photo.headers['cache-control']).toContain('no-store');
    expect(photo.headers['x-content-type-options']).toBe('nosniff');
    const normalized = await sharp(photo.body as Buffer).metadata();
    expect(normalized.height).toBe(512);
    expect(normalized.width).toBeLessThanOrEqual(512);
    expect(normalized.exif).toBeUndefined();
    expect(normalized.icc).toBeUndefined();
    await (await redeem(second.token)).get(uploaded.body.photoUrl as string).expect(200);
    expect((await mutate(member, `players/${first.id}/photo`, {}, 'delete')).status).toBe(200);
    await member.get(`/api/v1/players/${first.id}/photo`).expect(404);
  });

  it('accepts a real PNG and rejects non-images, forged headers, noncanonical or oversized base64', async () => {
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#123456' } }).png().toBuffer();
    expect((await mutate(member, `players/${first.id}/photo`, { data: png.toString('base64') })).status).toBe(200);
    const webp = await sharp(png).webp().toBuffer();
    for (const data of ['!!!!', 'AB==', 'data:image/png;base64,' + png.toString('base64'), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64'), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]).toString('base64'), webp.toString('base64'), Buffer.alloc(2 * 1024 * 1024 + 1).toString('base64')]) {
      expect((await mutate(member, `players/${first.id}/photo`, { data })).status).toBe(400);
    }
    const photo = await member.get(`/api/v1/players/${first.id}/photo`).expect(200);
    expect((await sharp(photo.body as Buffer).metadata()).format).toBe('jpeg');
  });

  it('rejects oversized HTTP bodies before image decoding with a request identifier', async () => {
    const csrf = (await member.get('/api/v1/auth/csrf')).body.csrfToken as string;
    const response = await member.post(`/api/v1/players/${first.id}/photo`).set('Origin', configuration.origin).set('x-csrf-token', csrf).send({ data: 'A'.repeat(3 * 1024 * 1024 + 1) });
    expect(response.status).toBe(413);
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('forbids editing or deleting another player photo while permitting administrative maintenance', async () => {
    const data = (await sharp({ create: { width: 2, height: 2, channels: 3, background: '#334455' } }).png().toBuffer()).toString('base64');
    expect((await mutate(member, `players/${second.id}/photo`, { data })).status).toBe(403);
    expect((await mutate(member, `players/${second.id}/photo`, {}, 'delete')).status).toBe(403);
    expect((await mutate(admin, `players/${second.id}/photo`, { data })).status).toBe(200);
    expect((await mutate(admin, `players/${second.id}/photo`, {}, 'delete')).status).toBe(200);
    expect((await member.get(`/api/v1/players/${second.id}`)).body.photoUrl).toBeUndefined();
  });
});
