import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';
import { AUTH_CONFIGURATION } from '../src/modules/access/auth-configuration';
import { requireTestDatabaseUrl } from '../scripts/test-database.cjs';

async function createTestApp(databaseUrl: string): Promise<INestApplication> {
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = databaseUrl;
  try {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AUTH_CONFIGURATION).useValue({ adminEmail: 'health@example.test', passwordHash: 'unused fixture', origin: 'http://localhost:3000', secureCookies: false, secret: Buffer.alloc(32, 1) }).compile();
    const app = module.createNestApplication({ logger: false });
    configureApplication(app);
    await app.init();
    return app;
  } finally {
    if (previousUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousUrl;
    }
  }
}

async function unusedLocalPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = (server.address() as AddressInfo).port;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

describe('Health endpoints', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp(requireTestDatabaseUrl(process.env));
  });

  afterAll(async () => {
    await app?.close();
  });

  it('reports that the process is alive', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('assigns a server-generated request identifier', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .set('x-request-id', 'untrusted-caller-value')
      .expect(200);

    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(response.headers['x-request-id']).not.toBe('untrusted-caller-value');
  });

  it('reports ready only after a real PostgreSQL query succeeds', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('keeps liveness available and returns a safe 503 when PostgreSQL is unavailable', async () => {
    const databaseUrl = new URL(requireTestDatabaseUrl(process.env));
    databaseUrl.hostname = '127.0.0.1';
    databaseUrl.port = String(await unusedLocalPort());
    databaseUrl.password = randomUUID();
    const offlineApp = await createTestApp(databaseUrl.toString());

    try {
      await request(offlineApp.getHttpServer()).get('/api/v1/health/live').expect(200);
      const response = await request(offlineApp.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(503);

      expect(response.body).toMatchObject({
        statusCode: 503,
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database is temporarily unavailable.',
        requestId: response.headers['x-request-id'],
      });
      const publicBody = JSON.stringify(response.body);
      expect(publicBody).not.toContain(databaseUrl.password);
      expect(publicBody).not.toContain(databaseUrl.toString());
      expect(publicBody).not.toContain('stack');
    } finally {
      await offlineApp.close();
    }
  });
});
