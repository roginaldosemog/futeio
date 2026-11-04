import 'reflect-metadata';
import { randomInt, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';
import { PrismaService } from '../src/database/prisma.service';
import { AUTH_CONFIGURATION, credentialVersion, type AuthConfiguration } from '../src/modules/access/auth-configuration';
import { AUTH_CLOCK, type Clock } from '../src/modules/access/clock';
import { csrfFor, newSecret, secretHash } from '../src/modules/access/auth-secrets';
import { PILOT_GROUP_ID, RATE_WINDOW_MS } from '../src/modules/access/auth-policy';
import { hashPassword } from '../src/modules/access/password';
import { balanceTeams } from '../src/modules/draws/balance-teams';
import type { DrawDto } from '../src/modules/draws/draws.dto';
import { requireTestDatabaseUrl } from '../scripts/test-database.cjs';

class EvaluationClock implements Clock {
  value = Date.UTC(2100, 0, 1) + randomInt(0, 1_000_000) * RATE_WINDOW_MS;
  now(): Date { return new Date(this.value); }
  async sleep(milliseconds: number): Promise<void> { this.value += milliseconds; }
}
interface Actor { id: string; token: string }

describe('Evaluations and draw snapshots', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Actor;
  const members: Actor[] = [];
  const playerIds: string[] = [];
  const clock = new EvaluationClock();
  const groupId = randomUUID();
  let foreignPlayerId: string;
  const configuration: AuthConfiguration = { adminEmail: `evaluations-${randomUUID()}@example.test`, passwordHash: '', origin: 'http://localhost:3000', secureCookies: false, secret: Buffer.alloc(32, 19) };
  const identities: string[] = [];

  function get(path: string, actor: Actor = admin) {
    return request(app.getHttpServer()).get(`/api/v1/${path}`).set('Cookie', `futeio_session=${actor.token}`);
  }
  function post(path: string, body: object, actor: Actor = admin) {
    return request(app.getHttpServer()).post(`/api/v1/${path}`).set('Cookie', `futeio_session=${actor.token}`).set('Origin', configuration.origin).set('x-csrf-token', csrfFor(actor.token, configuration.secret)).send(body);
  }
  beforeAll(async () => {
    configuration.passwordHash = await hashPassword('Synthetic evaluation administrator password!');
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = requireTestDatabaseUrl(process.env);
    try {
      const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(AUTH_CONFIGURATION).useValue(configuration).overrideProvider(AUTH_CLOCK).useValue(clock).compile();
      app = module.createNestApplication({ logger: false }); configureApplication(app); await app.init(); prisma = app.get(PrismaService);
    } finally {
      if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous;
    }
    const identity = await prisma.identity.create({ data: { email: configuration.adminEmail, memberships: { create: { groupId: PILOT_GROUP_ID, role: 'ADMIN' } } } });
    identities.push(identity.id); admin = { id: identity.id, token: newSecret() };
    await prisma.accessSession.create({ data: { tokenHash: secretHash(admin.token), role: 'ADMIN', groupId: PILOT_GROUP_ID, identityId: admin.id, credentialVersion: credentialVersion(configuration), expiresAt: new Date(clock.value + 86400000) } });
    for (let index = 0; index < 20; index++) {
      const member = await prisma.identity.create({ data: { memberships: { create: { groupId: PILOT_GROUP_ID, role: 'PLAYER' } } } }); identities.push(member.id);
      const player = await prisma.player.create({ data: { groupId: PILOT_GROUP_ID, identityId: member.id, name: `Synthetic member ${index}` } }); playerIds.push(player.id);
      await prisma.evaluation.create({ data: { groupId: PILOT_GROUP_ID, playerId: player.id, evaluatorIdentityId: admin.id, rating: 7 } });
      if (index < 2) {
        const credential = await prisma.playerAccessCredential.create({ data: { groupId: PILOT_GROUP_ID, playerId: player.id, tokenHash: secretHash(newSecret()) } });
        const actor = { id: member.id, token: newSecret() }; members.push(actor);
        await prisma.accessSession.create({ data: { tokenHash: secretHash(actor.token), role: 'PLAYER', groupId: PILOT_GROUP_ID, identityId: member.id, playerCredentialId: credential.id, expiresAt: new Date(clock.value + 86400000) } });
      }
    }
    await prisma.group.create({ data: { id: groupId, slug: `foreign-${groupId}`, name: 'Synthetic foreign group' } });
    const outsider = await prisma.identity.create({ data: { memberships: { create: { groupId, role: 'PLAYER' } } } }); identities.push(outsider.id);
    foreignPlayerId = (await prisma.player.create({ data: { groupId, identityId: outsider.id, name: 'Foreign member' } })).id;
  }, 60000);
  afterEach(async () => {
    if (!prisma || !admin) return;
    await prisma.draw.deleteMany({ where: { createdBy: admin.id } });
    await prisma.evaluation.deleteMany({ where: { groupId: PILOT_GROUP_ID, playerId: { in: playerIds }, evaluatorIdentityId: { not: admin.id } } });
    await prisma.evaluation.updateMany({ where: { groupId: PILOT_GROUP_ID, playerId: { in: playerIds }, evaluatorIdentityId: admin.id }, data: { rating: 7 } });
  });
  afterAll(async () => {
    if (prisma) {
      await prisma.player.deleteMany({ where: { id: { in: [...playerIds, foreignPlayerId].filter(Boolean) } } });
      await prisma.identity.deleteMany({ where: { id: { in: identities } } });
      await prisma.group.deleteMany({ where: { id: groupId } });
    }
    await app?.close();
  });

  it('requires membership to list ratings and draw history', async () => {
    for (const path of [`players/${playerIds[0]}/evaluations`, 'players', 'draws']) await request(app.getHttpServer()).get(`/api/v1/${path}`).expect(401);
  });
  it('allows self-rating and only returns the current viewer own authorship to players', async () => {
    const target = playerIds[0]!;
    const response = await post(`players/${target}/evaluations`, { rating: 9 }, members[0]).expect(200);
    expect(response.body).toMatchObject({ rating: 8, evaluationCount: 2, discardedPerSide: 0, calculationVersion: 'trimmed-mean-v1' });
    expect(response.body.evaluations).toEqual([{ rating: 7, isOwn: false }, { rating: 9, isOwn: true, authorName: 'Synthetic member 0' }]);
    const colleague = await get(`players/${target}/evaluations`, members[1]).expect(200);
    expect(colleague.body.evaluations).toEqual([{ rating: 7, isOwn: false }, { rating: 9, isOwn: false }]);
    expect(JSON.stringify(colleague.body)).not.toContain(admin.id);
    expect(JSON.stringify(colleague.body)).not.toContain(members[0]!.id);
    expect(JSON.stringify(colleague.body)).not.toContain(configuration.adminEmail);
    const administrator = await get(`players/${target}/evaluations`).expect(200);
    expect(administrator.body.evaluations).toEqual([{ rating: 7, isOwn: true, authorName: 'Administrador' }, { rating: 9, isOwn: false, authorName: 'Synthetic member 0' }]);
  });
  it('replaces the administrator initial contribution and member current votes without adding counts', async () => {
    const target = playerIds[2]!;
    await post(`players/${target}/evaluations`, { rating: 10 }).expect(200);
    await post(`players/${target}/evaluations`, { rating: 0 }, members[0]).expect(200);
    const response = await post(`players/${target}/evaluations`, { rating: 6 }, members[0]).expect(200);
    expect(response.body).toMatchObject({ rating: 8, evaluationCount: 2 });
    expect(await prisma.evaluation.count({ where: { playerId: target } })).toBe(2);
    const list = await get('players', members[1]).expect(200);
    expect(list.body.find((player: { id: string }) => player.id === target)).toMatchObject({ rating: 8, myRating: null, evaluationCount: 2 });
    const ownList = await get('players', members[0]).expect(200);
    expect(ownList.body.find((player: { id: string }) => player.id === target)).toMatchObject({ myRating: 6 });
  });
  it('retains one current contribution under simultaneous updates', async () => {
    const target = playerIds[2]!;
    const results = await Promise.all([post(`players/${target}/evaluations`, { rating: 2 }, members[0]), post(`players/${target}/evaluations`, { rating: 8 }, members[0])]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(await prisma.evaluation.count({ where: { playerId: target, evaluatorIdentityId: members[0]!.id } })).toBe(1);
    const current = await prisma.evaluation.findFirstOrThrow({ where: { playerId: target, evaluatorIdentityId: members[0]!.id } });
    expect([2, 8]).toContain(current.rating);
  });
  it('applies persisted evaluation cutoffs consistently in the profile table and roster', async () => {
    const playerId = playerIds[3]!;
    await prisma.evaluation.update({ where: { groupId_playerId_evaluatorIdentityId: { groupId: PILOT_GROUP_ID, playerId, evaluatorIdentityId: admin.id } }, data: { rating: 0 } });
    await prisma.evaluation.createMany({ data: [4, 6, 8, 10].map((rating, index) => ({ groupId: PILOT_GROUP_ID, playerId, evaluatorIdentityId: identities[index + 1]!, rating })) });
    expect((await get(`players/${playerId}/evaluations`, members[0]).expect(200)).body).toMatchObject({ rating: 6, evaluationCount: 5, discardedPerSide: 1 });
    await prisma.evaluation.deleteMany({ where: { playerId, evaluatorIdentityId: { not: admin.id } } });
    await prisma.evaluation.createMany({ data: Array.from({ length: 10 }, (_, index) => ({ groupId: PILOT_GROUP_ID, playerId, evaluatorIdentityId: identities[index + 1]!, rating: index + 1 })) });
    expect((await get(`players/${playerId}/evaluations`, members[0]).expect(200)).body).toMatchObject({ rating: 5, evaluationCount: 11, discardedPerSide: 2 });
    const list = await get('players', members[1]).expect(200);
    expect(list.body.find((player: { id: string }) => player.id === playerId)).toMatchObject({ rating: 5, evaluationCount: 11 });
  });
  it.each([{}, { rating: -1 }, { rating: 11 }, { rating: 7.5 }, { rating: '7' }, { rating: 7, evaluatorIdentityId: 'injected' }])('rejects malformed evaluation %j', async (body) => {
    await post(`players/${playerIds[0]}/evaluations`, body, members[0]).expect(400);
  });
  it('requires CSRF and refuses foreign targets', async () => {
    await request(app.getHttpServer()).post(`/api/v1/players/${playerIds[0]}/evaluations`).set('Cookie', `futeio_session=${members[0]!.token}`).set('Origin', configuration.origin).send({ rating: 5 }).expect(403);
    await post(`players/${foreignPlayerId}/evaluations`, { rating: 5 }, members[0]).expect(404);
    await get(`players/${foreignPlayerId}/evaluations`, members[0]).expect(404);
  });
  it('creates four teams of five from server ratings and reproduces its immutable snapshot', async () => {
    const response = await post('draws', { playerIds, seed: 'snapshot-test' }).expect(201);
    const draw = response.body as DrawDto;
    expect(draw.teams.map((team) => team.players.length)).toEqual([5, 5, 5, 5]);
    expect(draw.teams.flatMap((team) => team.players.map((player) => player.id)).sort()).toEqual([...playerIds].sort());
    expect(draw).toMatchObject({ spread: 0, variance: 0, algorithmVersion: 'seeded-greedy-swaps-v1', calculationVersion: 'trimmed-mean-v1' });
    const reproduced = balanceTeams(draw.teams.flatMap((team) => team.players), draw.seed);
    expect(reproduced.teams.map((team) => team.map((player) => player.id))).toEqual(draw.teams.map((team) => team.players.map((player) => player.id)));
    await post(`players/${playerIds[0]}/evaluations`, { rating: 0 }).expect(200);
    await prisma.player.update({ where: { id: playerIds[0] }, data: { name: 'Changed after snapshot' } });
    expect((await get(`draws/${draw.id}`, members[0]).expect(200)).body).toEqual(draw);
    expect((await get('draws', members[0]).expect(200)).body).toContainEqual(draw);
  });
  it('allows only administrators to generate teams', async () => {
    await post('draws', { playerIds }, members[0]).expect(403);
    await request(app.getHttpServer()).post('/api/v1/draws').send({ playerIds }).expect(401);
  });
  it.each([
    { playerIds: [] }, { playerIds: Array(20).fill('00000000-0000-4000-8000-000000000001') },
    { playerIds: Array(20).fill('invalid') },
  ])('rejects invalid participant selections %j', async (body) => {
    await post('draws', body).expect(400);
  });
  it('rejects missing or foreign participants and client-supplied ratings or invalid seeds', async () => {
    await post('draws', { playerIds: playerIds.slice(1) }).expect(400);
    await post('draws', { playerIds: [...playerIds.slice(1), foreignPlayerId] }).expect(404);
    await post('draws', { playerIds, ratings: Array(20).fill(10) }).expect(400);
    await post('draws', { playerIds, seed: '' }).expect(400);
    await post('draws', { playerIds, seed: null }).expect(400);
    await get(`draws/${randomUUID()}`, members[0]).expect(404);
    const foreignDraw = await prisma.draw.create({ data: { groupId, createdBy: identities[identities.length - 1]!, seed: 'foreign', algorithmVersion: 'seeded-greedy-swaps-v1', calculationVersion: 'trimmed-mean-v1', snapshot: { teams: [], spread: 0, variance: 0 } } });
    await get(`draws/${foreignDraw.id}`, members[0]).expect(404);
    expect((await get('draws', members[0]).expect(200)).body.some((draw: { id: string }) => draw.id === foreignDraw.id)).toBe(false);
  });
});
