import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createProcessGroup } from './process-group.mjs';
import { assertPortsAvailable } from './ports.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const mode = process.argv[2];
if (!['integration', 'e2e'].includes(mode)) throw new Error('Choose integration or e2e.');
const environment = Object.fromEntries(Object.entries(process.env).filter(([name]) => /^(PATH|Path|PATHEXT|SystemRoot|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|JAVA_HOME|CI|GITHUB_ACTIONS|HTTP_PROXY|HTTPS_PROXY|NO_PROXY)$/i.test(name)));
Object.assign(environment, {
  FUTEIO_TEST_MODE: mode, FUTEIO_E2E_ISOLATED: '1', FUTEIO_ISOLATED_BUILD: '1',
  FUTEIO_FIREBASE_MODE: 'emulator', FIREBASE_PROJECT_ID: 'demo-futeio-test',
  GCLOUD_PROJECT: 'demo-futeio-test', FIREBASE_STORAGE_BUCKET: 'demo-futeio-test.firebasestorage.app',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9299', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8280',
  FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9399', FIREBASE_WEB_API_KEY: 'demo-test-key',
  FIREBASE_ADMIN_UID: 'futeio-emulator-admin', ADMIN_EMAIL: 'e2e-admin@example.test',
  AUTH_SECRET: 'isolated-test-only-secret-000000000000000000000000', APP_ORIGIN: 'http://127.0.0.1:3100',
  E2E_BASE_URL: 'http://127.0.0.1:3100', NEXT_TELEMETRY_DISABLED: '1',
});
const emulators = JSON.parse(await readFile(new URL('../firebase.test.json', import.meta.url), 'utf8')).emulators;
await assertPortsAvailable([{ host: '127.0.0.1', port: 3100 }, { host: '127.0.0.1', port: emulators.firestore.websocketPort }, ...Object.values(emulators).filter((entry) => entry.port).map(({ host, port }) => ({ host, port }))]);
const group = createProcessGroup();
try {
  if (mode === 'e2e') await group.run('Isolated website build', ['node_modules/next/dist/bin/next', 'build'], `${root}/web`, environment, { showOutput: true });
  await group.run('Firebase isolated validation', ['node_modules/firebase-tools/lib/bin/firebase.js', 'emulators:exec', '--project', 'demo-futeio-test', '--config', 'firebase.test.json', '--only', 'auth,firestore,storage', 'node scripts/test-with-emulators.mjs'], root, environment, { showOutput: true });
} finally { await group.stop(); }
