import 'reflect-metadata';
import { randomInt, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Client } from 'pg';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';
import { PrismaService } from '../src/database/prisma.service';
import type { Prisma } from '../src/generated/prisma/client';
import { AUTH_CONFIGURATION, type AuthConfiguration } from '../src/modules/access/auth-configuration';
import { AUTH_CLOCK, type Clock } from '../src/modules/access/clock';
import { csrfFor, newSecret, secretHash } from '../src/modules/access/auth-secrets';
import { PILOT_GROUP_ID, RATE_WINDOW_MS } from '../src/modules/access/auth-policy';
import { hashPassword } from '../src/modules/access/password';
import { PlayerCredentialService } from '../src/modules/access/player-credential.service';
import { InitialRatingService } from '../src/modules/evaluations/initial-rating.service';
import { requireTestDatabaseUrl } from '../scripts/test-database.cjs';

class RegistrationClock implements Clock {
  value = Date.UTC(2100, 0, 1) + randomInt(0, 1_000_000) * RATE_WINDOW_MS;
  now(): Date { return new Date(this.value); }
  async sleep(milliseconds: number): Promise<void> { this.value += milliseconds; }
  nextWindow(): void { this.value += RATE_WINDOW_MS; }
}
type FailedCreation = { playerId: string; identityId: string };
class ControlledInitialRatings extends InitialRatingService {
  fail = false;
  failed?: FailedCreation;
  override async create(transaction: Prisma.TransactionClient, groupId: string, playerId: string, evaluatorIdentityId: string, rating: number): Promise<void> {
    await super.create(transaction, groupId, playerId, evaluatorIdentityId, rating);
    if (this.fail) {
      const player = await transaction.player.findUniqueOrThrow({ where: { id: playerId } });
      this.failed = { playerId, identityId: player.identityId };
      throw new Error('Controlled initial contribution failure');
    }
  }
}
class ControlledCredentials extends PlayerCredentialService {
  fail = false;
  failed?: FailedCreation;
  override async create(transaction: Prisma.TransactionClient, groupId: string, playerId: string): Promise<string> {
    const url = await super.create(transaction, groupId, playerId);
    if (this.fail) {
      const player = await transaction.player.findUniqueOrThrow({ where: { id: playerId } });
      this.failed = { playerId, identityId: player.identityId };
      throw new Error('Controlled credential failure');
    }
    return url;
  }
}

describe('Player registration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let agent: ReturnType<typeof request.agent>;
  let csrf: string;
  let adminId: string;
  const clock = new RegistrationClock();
  const email = `players-${randomUUID()}@example.test`;
  const password = 'Player registration fixture password!';
  const configuration: AuthConfiguration = { adminEmail: email, passwordHash: '', origin: 'http://localhost:3000', secureCookies: false, secret: Buffer.alloc(32, 11) };
  const ratings = new ControlledInitialRatings();
  const credentials = new ControlledCredentials(configuration);
  const name = `Fixture ${randomUUID()}`;
  async function create(body: object = { name, initialRating: 7 }) {
    return agent.post('/api/v1/players').set('Origin', configuration.origin).set('x-csrf-token', csrf).send(body);
  }
  async function assertRollback(failed: FailedCreation | undefined): Promise<void> {
    expect(failed).toBeDefined();
    expect(await prisma.player.findUnique({ where: { id: failed!.playerId } })).toBeNull();
    expect(await prisma.identity.findUnique({ where: { id: failed!.identityId } })).toBeNull();
    expect(await prisma.evaluation.count({ where: { playerId: failed!.playerId } })).toBe(0);
    expect(await prisma.playerAccessCredential.count({ where: { playerId: failed!.playerId } })).toBe(0);
  }
  async function cleanupPlayers(): Promise<void> {
    const rows = await prisma.player.findMany({ where: { evaluations: { some: { evaluatorIdentityId: adminId } } }, select: { id: true, identityId: true } });
    await prisma.player.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
    await prisma.identity.deleteMany({ where: { id: { in: rows.map((row) => row.identityId).filter((id) => id !== adminId) } } });
  }
  beforeAll(async () => {
    configuration.passwordHash = await hashPassword(password);
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = requireTestDatabaseUrl(process.env);
    try {
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(AUTH_CONFIGURATION).useValue(configuration)
        .overrideProvider(AUTH_CLOCK).useValue(clock)
        .overrideProvider(InitialRatingService).useValue(ratings)
        .overrideProvider(PlayerCredentialService).useValue(credentials).compile();
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
    clock.nextWindow(); ratings.fail = false; ratings.failed = undefined; credentials.fail = false; credentials.failed = undefined;
    agent = request.agent(app.getHttpServer());
    csrf = (await agent.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
    const login = await agent.post('/api/v1/auth/admin/login').set('Origin', configuration.origin).set('x-csrf-token', csrf).send({ email, password }).expect(200);
    adminId = login.body.identityId as string;
    csrf = (await agent.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
  });
  afterEach(async () => { if (prisma && adminId) await cleanupPlayers(); });
  afterAll(async () => { if (prisma) await prisma.identity.deleteMany({ where: { email } }); await app?.close(); });

  it('creates a player, initial contribution and hashed personal credential together', async () => {
    const response = await create({ name: `  ${name}  `, initialRating: 7 });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ player: { id: expect.any(String), name, rating: 7, isOwnProfile: false }, accessUrl: expect.any(String) });
    expect(response.headers['cache-control']).toContain('no-store');
    const url = new URL(response.body.accessUrl as string);
    expect(url.origin).toBe(configuration.origin);
    expect(url.pathname).toBe('/acesso/jogador');
    expect(url.search).toBe('');
    const token = new URLSearchParams(url.hash.slice(1)).get('token')!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const stored = await prisma.player.findUniqueOrThrow({ where: { id: response.body.player.id as string }, include: { membership: { include: { identity: true } }, evaluations: true, credentials: true } });
    expect(stored.membership.identity.email).toBeNull();
    expect(stored.membership.role).toBe('PLAYER');
    expect(stored.identityId).not.toBe(adminId);
    expect(stored.groupId).toBe(PILOT_GROUP_ID);
    expect(stored.evaluations).toHaveLength(1);
    expect(stored.evaluations[0]).toMatchObject({ evaluatorIdentityId: adminId, rating: 7, groupId: PILOT_GROUP_ID });
    expect(stored.credentials).toHaveLength(1);
    expect(stored.credentials[0]!.tokenHash).toBe(secretHash(token));
    expect(JSON.stringify(stored)).not.toContain(token);
    const listed = await agent.get('/api/v1/players').expect(200);
    expect(listed.body).toEqual([response.body.player]);
    expect(JSON.stringify(listed.body)).not.toContain(token);
    expect(JSON.stringify(listed.body)).not.toContain(stored.credentials[0]!.tokenHash);
    expect(Object.keys(listed.body[0] as object).sort()).toEqual(['id', 'isOwnProfile', 'name', 'rating']);
  });
  it.each([0, 10])('accepts boundary initial rating %i', async (initialRating) => {
    const response = await create({ name, initialRating });
    expect(response.status).toBe(201); expect(response.body.player.rating).toBe(initialRating);
  });
  it('rejects absent, noninteger, out-of-range or silently coercible ratings', async () => {
    for (const initialRating of [undefined, null, -1, 11, 7.5, '7', '7.5', true]) {
      expect((await create({ name, initialRating })).status).toBe(400);
    }
    expect(await prisma.player.count({ where: { name } })).toBe(0);
  });
  it('rejects blank, absent, nonstring and oversized names', async () => {
    for (const invalidName of ['', '   ', undefined, null, 123, 'a'.repeat(101)]) {
      expect((await create({ name: invalidName, initialRating: 5 })).status).toBe(400);
    }
  });
  it('rejects a null or nonboolean administrator-link option', async () => {
    for (const linkToCurrentAdministrator of [null, 'false', 0, 1]) {
      expect((await create({ name, initialRating: 5, linkToCurrentAdministrator })).status).toBe(400);
    }
  });
  it('rejects client-provided authors, identities, group and role fields', async () => {
    for (const extra of [{ evaluatorIdentityId: randomUUID() }, { identityId: adminId }, { groupId: randomUUID() }, { role: 'ADMIN' }]) {
      expect((await create({ name, initialRating: 5, ...extra })).status).toBe(400);
    }
  });
  it('allows different players to share a name', async () => {
    const first = await create(); const second = await create();
    expect(first.status).toBe(201); expect(second.status).toBe(201);
    expect(first.body.player.id).not.toBe(second.body.player.id);
    expect(first.body.accessUrl).not.toBe(second.body.accessUrl);
    expect((await agent.get('/api/v1/players').expect(200)).body).toHaveLength(2);
  });
  it('links the administrator profile without duplicating or downgrading identity', async () => {
    const response = await create({ name, initialRating: 6, linkToCurrentAdministrator: true });
    expect(response.status).toBe(201); expect(response.body.player.isOwnProfile).toBe(true);
    const player = await prisma.player.findUniqueOrThrow({ where: { id: response.body.player.id as string }, include: { membership: { include: { identity: true } }, evaluations: true } });
    expect(player.identityId).toBe(adminId); expect(player.membership.role).toBe('ADMIN'); expect(player.membership.identity.email).toBe(email);
    expect(player.evaluations).toHaveLength(1); expect(player.evaluations[0]!.evaluatorIdentityId).toBe(adminId);
    expect((await create({ name: 'Another own profile', initialRating: 8, linkToCurrentAdministrator: true })).status).toBe(409);
    expect(await prisma.player.count({ where: { identityId: adminId, groupId: PILOT_GROUP_ID } })).toBe(1);
  });
  it('permits only one administrator profile under concurrent registrations', async () => {
    const attempts = await Promise.all([create({ name, initialRating: 5, linkToCurrentAdministrator: true }), create({ name, initialRating: 9, linkToCurrentAdministrator: true })]);
    expect(attempts.map((result) => result.status).sort()).toEqual([201, 409]);
    const player = await prisma.player.findUniqueOrThrow({ where: { groupId_identityId: { groupId: PILOT_GROUP_ID, identityId: adminId } }, include: { evaluations: true, credentials: true } });
    expect(player.evaluations).toHaveLength(1); expect(player.credentials).toHaveLength(1);
  });
  it('requires an authenticated administrator for list and creation', async () => {
    await request(app.getHttpServer()).get('/api/v1/players').expect(401);
    await request(app.getHttpServer()).post('/api/v1/players').send({ name, initialRating: 7 }).expect(401);
  });
  it('denies a player session even with a valid CSRF header', async () => {
    const identity = await prisma.identity.create({ data: { memberships: { create: { groupId: PILOT_GROUP_ID, role: 'PLAYER' } } } });
    const token = newSecret();
    try {
      await prisma.accessSession.create({ data: { tokenHash: secretHash(token), groupId: PILOT_GROUP_ID, identityId: identity.id, role: 'PLAYER', expiresAt: new Date(clock.value + 60000) } });
      const cookie = `futeio_session=${token}`;
      await request(app.getHttpServer()).get('/api/v1/players').set('Cookie', cookie).expect(403);
      await request(app.getHttpServer()).post('/api/v1/players').set('Cookie', cookie).set('Origin', configuration.origin).set('x-csrf-token', csrfFor(token, configuration.secret)).send({ name, initialRating: 7 }).expect(403);
    } finally { await prisma.identity.delete({ where: { id: identity.id } }); }
  });
  it('requires trusted Origin and CSRF on creation', async () => {
    await agent.post('/api/v1/players').set('Origin', configuration.origin).send({ name, initialRating: 7 }).expect(403);
    await agent.post('/api/v1/players').set('x-csrf-token', csrf).send({ name, initialRating: 7 }).expect(403);
    await agent.post('/api/v1/players').set('Origin', 'https://untrusted.example.test').set('x-csrf-token', csrf).send({ name, initialRating: 7 }).expect(403);
  });
  it('rolls back identity, player and evaluation if initial-rating creation fails', async () => {
    ratings.fail = true;
    expect((await create()).status).toBe(500);
    await assertRollback(ratings.failed);
  });
  it('rolls back every record if credential creation fails after its write', async () => {
    credentials.fail = true;
    expect((await create()).status).toBe(500);
    await assertRollback(credentials.failed);
  });
  it('does not list players from another group', async () => {
    const group = await prisma.group.create({ data: { slug: `other-${randomUUID()}`, name: 'Isolated fixture group' } });
    const identity = await prisma.identity.create({ data: { memberships: { create: { groupId: group.id, role: 'PLAYER' } } } });
    try {
      const foreign = await prisma.player.create({ data: { groupId: group.id, identityId: identity.id, name: 'Private foreign-group player' } });
      await prisma.evaluation.create({ data: { groupId: group.id, playerId: foreign.id, evaluatorIdentityId: identity.id, rating: 4 } });
      const listed = await agent.get('/api/v1/players').expect(200);
      expect(listed.body).toEqual([]);
    } finally { await prisma.group.delete({ where: { id: group.id } }); await prisma.identity.delete({ where: { id: identity.id } }); }
  });
  it('enforces rating and active-credential invariants in PostgreSQL', async () => {
    const response = await create(); expect(response.status).toBe(201);
    const playerId = response.body.player.id as string;
    const database = new Client({ connectionString: requireTestDatabaseUrl(process.env) });
    await database.connect();
    try {
      await expect(database.query('UPDATE evaluations SET rating = 11 WHERE group_id = $1 AND player_id = $2', [PILOT_GROUP_ID, playerId])).rejects.toMatchObject({ code: '23514', constraint: 'evaluations_rating_check' });
      await expect(database.query('INSERT INTO player_access_credentials (id, group_id, player_id, token_hash) VALUES ($1, $2, $3, $4)', [randomUUID(), PILOT_GROUP_ID, playerId, secretHash(newSecret())])).rejects.toMatchObject({ code: '23505', constraint: 'player_access_credentials_one_active_key' });
    } finally { await database.end(); }
    expect(await prisma.evaluation.count({ where: { playerId } })).toBe(1);
    expect(await prisma.playerAccessCredential.count({ where: { playerId, revokedAt: null } })).toBe(1);
  });
});
