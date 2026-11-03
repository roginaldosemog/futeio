import process from 'node:process';
import { randomInt } from 'node:crypto';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { createAdminFixture, TEST_ADMIN_EMAIL } from './admin-fixture.mjs';

const require = createRequire(import.meta.url);
const { requireTestDatabaseUrl } = require('../../scripts/test-database.cjs');
let app;
let prisma;
let stopping = false;

async function stop(exitCode) {
  if (stopping) return;
  stopping = true;
  try {
    // This identity belongs exclusively to this fixture, after the test-database guard.
    if (prisma) await prisma.identity.deleteMany({ where: { email: TEST_ADMIN_EMAIL } });
  } catch {
    process.stderr.write('The isolated E2E API could not finish its fixture cleanup.\n');
    exitCode = 1;
  }
  try {
    if (app) await app.close();
  } catch {
    process.stderr.write('The isolated E2E API could not close its connections.\n');
    exitCode = 1;
  }
  process.exit(exitCode);
}

try {
  const databaseUrl = requireTestDatabaseUrl(process.env);
  Object.assign(process.env, createAdminFixture('http://127.0.0.1:3100'), {
    DATABASE_URL: databaseUrl,
    NODE_ENV: 'test',
    API_HOST: '127.0.0.1',
    API_PORT: '3101',
  });

  const { Test } = require('@nestjs/testing');
  const { AppModule } = require('../../dist/app.module.js');
  const { configureApplication } = require('../../dist/app.setup.js');
  const { AUTH_CLOCK } = require('../../dist/modules/access/clock.js');
  const { PrismaService } = require('../../dist/database/prisma.service.js');
  // A separate future window keeps persisted rate limits independent across runs.
  // The clock still advances with real time; authentication and expiry remain real.
  const runStart = Date.UTC(2100, 0, 1) + randomInt(0, 1_000_000) * 15 * 60 * 1000;
  const offset = runStart - Date.now();
  const clock = { now: () => new Date(Date.now() + offset), sleep: (milliseconds) => delay(milliseconds) };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AUTH_CLOCK).useValue(clock)
    .setLogger({ log() {}, error() {}, warn() {} })
    .compile();
  app = moduleRef.createNestApplication({ logger: false });
  configureApplication(app);
  prisma = app.get(PrismaService);
  process.once('SIGINT', () => { void stop(0); });
  process.once('SIGTERM', () => { void stop(0); });
  process.on('message', (message) => {
    if (message?.type === 'futeio-test-shutdown') void stop(0);
  });
  await app.listen(3101, '127.0.0.1');
} catch {
  process.stderr.write('The isolated E2E API could not start. Verify the build, migrations and test database.\n');
  await stop(1);
}
