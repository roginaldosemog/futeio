import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, TEST_ADMIN_UID } from '../web/test/admin-fixture.mjs';
const require = createRequire(new URL('../web/package.json', import.meta.url));

export async function seedEmulator() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (process.env.FUTEIO_FIREBASE_MODE !== 'emulator' || !projectId?.startsWith('demo-') || !/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '')) throw new Error('This fixture only runs against a loopback Auth emulator and demo project.');
  if (process.env.ADMIN_EMAIL !== TEST_ADMIN_EMAIL || process.env.FIREBASE_ADMIN_UID !== TEST_ADMIN_UID) throw new Error('Use the synthetic admin from .env.example when seeding the emulator.');
  const { initializeApp, getApps } = require('firebase-admin/app');
  const { getAuth } = require('firebase-admin/auth');
  const app = getApps().find((candidate) => candidate.name === 'fixture') ?? initializeApp({ projectId, credential: { getAccessToken: async () => ({ access_token: 'owner', expires_in: 3600 }) } }, 'fixture');
  const auth = getAuth(app);
  try { await auth.getUser(TEST_ADMIN_UID); }
  catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    await auth.createUser({ uid: TEST_ADMIN_UID, email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD, emailVerified: true });
  }
  console.log('Synthetic administrator ready in the local emulator. Credentials: web/test/admin-fixture.mjs.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await seedEmulator();
  const { getApps, deleteApp } = require('firebase-admin/app');
  await Promise.all(getApps().map(deleteApp));
}
