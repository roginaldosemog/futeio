import { fileURLToPath } from 'node:url';
import { createProcessGroup } from './process-group.mjs';
import { seedEmulator } from './seed-emulator.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
if (process.env.FIREBASE_PROJECT_ID !== 'demo-futeio-test' || process.env.FUTEIO_E2E_ISOLATED !== '1') throw new Error('Use pnpm test:integration or pnpm test:e2e.');
const group = createProcessGroup();
try {
  await seedEmulator();
  if (process.env.FUTEIO_TEST_MODE === 'integration') {
    await group.run('Firebase integration tests', ['--conditions=react-server', '--test', 'web/test/firebase.test.ts'], root, process.env, { showOutput: true });
  } else if (process.env.FUTEIO_TEST_MODE === 'e2e') {
    group.start('Isolated website', ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3100'], `${root}/web`, process.env, { showOutput: true });
    await group.waitForHttp(`${process.env.APP_ORIGIN}/api/v1/health/ready`);
    await group.run('Chrome journeys', ['node_modules/@playwright/test/cli.js', 'test'], `${root}/web`, process.env, { showOutput: true });
  } else throw new Error('Invalid test mode.');
} finally {
  await group.stop();
  // Release Admin SDK sockets before emulators:exec owns emulator shutdown.
  const { createRequire } = await import('node:module');
  const require = createRequire(new URL('../web/package.json', import.meta.url));
  const { getApps, deleteApp } = require('firebase-admin/app');
  await Promise.all(getApps().map(deleteApp));
}
