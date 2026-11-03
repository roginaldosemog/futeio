import 'reflect-metadata';
import { randomInt, randomUUID } from 'node:crypto';
import { Controller, Get, UseGuards, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';
import { PrismaService } from '../src/database/prisma.service';
import { AUTH_CONFIGURATION, type AuthConfiguration } from '../src/modules/access/auth-configuration';
import { AUTH_CLOCK, type Clock } from '../src/modules/access/clock';
import { SESSION_TTL_MS, RATE_WINDOW_MS } from '../src/modules/access/auth-policy';
import { newSecret, secretHash } from '../src/modules/access/auth-secrets';
import { hashPassword } from '../src/modules/access/password';
import { AdminGuard } from '../src/modules/access/admin.guard';
import { AccessModule } from '../src/modules/access/access.module';
import { requireTestDatabaseUrl } from '../scripts/test-database.cjs';

class ManualClock implements Clock {
  // Persisted rate limits must not make a repeat run depend on an earlier run.
  value = Date.UTC(2100, 0, 1) + randomInt(0, 1_000_000) * RATE_WINDOW_MS;
  now(): Date { return new Date(this.value); }
  async sleep(milliseconds: number): Promise<void> { this.value += milliseconds; }
  advance(milliseconds: number): void { this.value += milliseconds; }
  nextWindow(): void { this.value = (Math.floor(this.value / RATE_WINDOW_MS) + 1) * RATE_WINDOW_MS + 1000; }
}
@Controller('test-admin')
class ProtectedTestController {
  @Get() @UseGuards(AdminGuard) read(): { allowed: boolean } { return { allowed: true }; }
}

describe('Administrator password access', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const clock = new ManualClock();
  const email = `admin-${randomUUID()}@example.test`;
  const password = 'Independent fixture password 2026!';
  const configuration: AuthConfiguration = {
    adminEmail: email, passwordHash: '', origin: 'http://localhost:3000', secureCookies: false,
    secret: Buffer.alloc(32, 5),
  };
  type Browser = { agent: ReturnType<typeof request.agent>; csrf: string; originalCookie: string };
  async function browser(): Promise<Browser> {
    const agent = request.agent(app.getHttpServer());
    const response = await agent.get('/api/v1/auth/csrf').expect(200);
    const cookie = (response.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
    return { agent, csrf: response.body.csrfToken as string, originalCookie: cookie };
  }
  async function login(context: Browser, address = email, value = password) {
    return context.agent.post('/api/v1/auth/admin/login').set('Origin', configuration.origin).set('x-csrf-token', context.csrf).send({ email: address, password: value });
  }
  beforeAll(async () => {
    configuration.passwordHash = await hashPassword(password);
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = requireTestDatabaseUrl(process.env);
    try {
      const module = await Test.createTestingModule({ imports: [AppModule, AccessModule], controllers: [ProtectedTestController] })
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
  beforeEach(() => { clock.nextWindow(); });
  afterAll(async () => {
    if (prisma) await prisma.identity.deleteMany({ where: { email } });
    await app?.close();
  });
  it('issues a no-store browser context without granting administrative access', async () => {
    const context = await browser();
    const response = await context.agent.get('/api/v1/auth/csrf').expect(200);
    expect(response.headers['cache-control']).toContain('no-store');
    expect(response.body.csrfToken).toBe(context.csrf);
    expect(context.originalCookie).toMatch(/^futeio_session=[A-Za-z0-9_-]{43}$/);
    await context.agent.get('/api/v1/auth/me').expect(401);
    await context.agent.get('/api/v1/test-admin').expect(401);
  });
  it('returns the same safe rejection for unknown email and wrong password', async () => {
    const context = await browser();
    const unknown = await login(context, 'unknown@example.test');
    const wrong = await login(context, email, 'wrong fixture');
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.code).toBe(wrong.body.code);
    expect(unknown.body.message).toBe(wrong.body.message);
    expect(await prisma.identity.count({ where: { email: 'unknown@example.test' } })).toBe(0);
    await context.agent.get('/api/v1/auth/me').expect(401);
  });
  it('rejects missing, null or foreign Origin and missing/invalid CSRF', async () => {
    const context = await browser();
    for (const origin of ['null', 'https://other.example.test']) {
      await context.agent.post('/api/v1/auth/admin/login').set('Origin', origin).set('x-csrf-token', context.csrf).send({ email, password }).expect(403);
    }
    await context.agent.post('/api/v1/auth/admin/login').set('x-csrf-token', context.csrf).send({ email, password }).expect(403);
    await context.agent.post('/api/v1/auth/admin/login').set('Origin', configuration.origin).send({ email, password }).expect(403);
    await context.agent.post('/api/v1/auth/admin/login').set('Origin', configuration.origin).set('x-csrf-token', 'bad').send({ email, password }).expect(403);
  });
  it('rejects extra privilege fields, invalid email and absent or oversized password', async () => {
    const context = await browser();
    for (const body of [{ email, password, role: 'ADMIN' }, { email: 'invalid', password }, { email }, { email, password: '' }, { email, password: 'a'.repeat(257) }]) {
      await context.agent.post('/api/v1/auth/admin/login').set('Origin', configuration.origin).set('x-csrf-token', context.csrf).send(body).expect(400);
    }
  });
  it('rotates the cookie, persists only its hash and grants access to the configured administrator', async () => {
    const context = await browser();
    const result = await login(context, email.toUpperCase());
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ role: 'ADMIN', email, identityId: expect.any(String), groupId: '00000000-0000-4000-8000-000000000001' });
    const header = (result.headers['set-cookie'] as unknown as string[])[0]!;
    expect(header).toContain('HttpOnly'); expect(header).toContain('SameSite=Lax');
    expect(header).not.toContain('; Secure');
    const token = header.split(';')[0]!.split('=')[1]!;
    expect(`futeio_session=${token}`).not.toBe(context.originalCookie);
    const stored = await prisma.accessSession.findUniqueOrThrow({ where: { tokenHash: secretHash(token) } });
    expect(stored.expiresAt.getTime() - clock.value).toBe(SESSION_TTL_MS);
    expect(JSON.stringify(result.body)).not.toContain(token);
    expect(JSON.stringify(result.body)).not.toContain(configuration.passwordHash);
    await context.agent.get('/api/v1/auth/me').expect(200).expect(result.body);
    await context.agent.get('/api/v1/test-admin').expect(200).expect({ allowed: true });
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Cookie', context.originalCookie).expect(401);
  });
  it('requires a fresh CSRF header after session rotation', async () => {
    const context = await browser();
    expect((await login(context)).status).toBe(200);
    await context.agent.post('/api/v1/auth/logout').set('Origin', configuration.origin).set('x-csrf-token', context.csrf).send({}).expect(403);
    const csrf = await context.agent.get('/api/v1/auth/csrf').expect(200);
    await context.agent.post('/api/v1/auth/logout').set('Origin', configuration.origin).set('x-csrf-token', csrf.body.csrfToken).send({}).expect(200);
    await context.agent.get('/api/v1/auth/me').expect(401);
  });
  it('preserves an existing authenticated session after an incorrect password attempt', async () => {
    const context = await browser();
    expect((await login(context)).status).toBe(200);
    const csrf = await context.agent.get('/api/v1/auth/csrf').expect(200);
    context.csrf = csrf.body.csrfToken as string;
    expect((await login(context, email, 'incorrect fixture password')).status).toBe(401);
    await context.agent.get('/api/v1/auth/me').expect(200);
  });
  it('allows only one simultaneous rotation of the same anonymous session', async () => {
    const context = await browser();
    const attempts = await Promise.all([0, 1].map(() => request(app.getHttpServer()).post('/api/v1/auth/admin/login').set('Cookie', context.originalCookie).set('Origin', configuration.origin).set('x-csrf-token', context.csrf).send({ email, password })));
    expect(attempts.map((result) => result.status).sort()).toEqual([200, 401]);
  });
  it('expires the session after eight hours', async () => {
    const context = await browser(); expect((await login(context)).status).toBe(200);
    clock.advance(SESSION_TTL_MS + 1);
    await context.agent.get('/api/v1/auth/me').expect(401);
  });
  it('invalidates existing sessions when the configured credential changes', async () => {
    const context = await browser(); expect((await login(context)).status).toBe(200);
    const original = configuration.passwordHash;
    configuration.passwordHash = await hashPassword('A different fixture password');
    try { await context.agent.get('/api/v1/auth/me').expect(401); }
    finally { configuration.passwordHash = original; }
  });
  it('denies administrative actions to a player session', async () => {
    const identity = await prisma.identity.create({ data: { memberships: { create: { groupId: '00000000-0000-4000-8000-000000000001', role: 'PLAYER' } } } });
    const token = newSecret();
    try {
      await prisma.accessSession.create({ data: { tokenHash: secretHash(token), role: 'PLAYER', groupId: '00000000-0000-4000-8000-000000000001', identityId: identity.id, expiresAt: new Date(clock.value + 60000) } });
      await request(app.getHttpServer()).get('/api/v1/test-admin').set('Cookie', `futeio_session=${token}`).expect(403);
    } finally { await prisma.identity.delete({ where: { id: identity.id } }); }
  });
  it('uses Secure cookies for the configured HTTPS origin', async () => {
    configuration.secureCookies = true;
    try {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/csrf').expect(200);
      expect((response.headers['set-cookie'] as unknown as string[])[0]).toContain('; Secure');
    } finally { configuration.secureCookies = false; }
  });
  it('limits each email including unknown addresses before password verification', async () => {
    const context = await browser();
    for (let attempt = 0; attempt < 5; attempt++) expect((await login(context, 'limited@example.test')).status).toBe(401);
    expect((await login(context, 'limited@example.test')).status).toBe(429);
    clock.nextWindow();
    expect((await login(context, 'limited@example.test')).status).toBe(401);
  });
  it('does not trust spoofed forwarding headers to bypass the peer quota', async () => {
    const context = await browser();
    for (let attempt = 0; attempt < 10; attempt++) {
      await context.agent.post('/api/v1/auth/admin/login').set('Origin', configuration.origin).set('x-csrf-token', context.csrf).set('x-forwarded-for', `192.0.2.${attempt}`).set('cf-connecting-ip', `192.0.2.${attempt}`).send({ email: `unknown-${attempt}@example.test`, password }).expect(401);
    }
    const blocked = await login(context, 'last@example.test');
    expect(blocked.status).toBe(429); expect(blocked.headers['retry-after']).toBeDefined();
  });
  it('keeps the deferred email endpoints unavailable', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/admin/request-link').send({ email }).expect(404);
    await request(app.getHttpServer()).post('/api/v1/auth/admin/redeem').send({ token: newSecret() }).expect(404);
  });
});
