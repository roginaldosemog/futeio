import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { assertPortsAvailable, readPort } from './ports.mjs';
import { createProcessGroup } from './process-group.mjs';

const apiPort = readPort(process.env.SMOKE_API_PORT ?? process.env.API_PORT ?? '3001', 'SMOKE_API_PORT');
const webPort = readPort(process.env.SMOKE_WEB_PORT ?? '3000', 'SMOKE_WEB_PORT');
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const webOrigin = `http://127.0.0.1:${webPort}`;
const group = createProcessGroup();
const environment = {
  ...process.env,
  NODE_ENV: 'production',
  NEXT_TELEMETRY_DISABLED: '1',
  API_PORT: String(apiPort),
  API_HOST: '127.0.0.1',
  API_ORIGIN: apiOrigin,
};

try {
  await assertPortsAvailable([{ host: '127.0.0.1', port: apiPort }, { host: '127.0.0.1', port: webPort }]);
  group.start('Smoke API', ['dist/main.js'], fileURLToPath(new URL('../api/', import.meta.url)), environment);
  group.start('Smoke web', ['node_modules/next/dist/bin/next', 'start', '--port', String(webPort), '--hostname', '127.0.0.1'], fileURLToPath(new URL('../web/', import.meta.url)), environment);
  await group.waitForHttp(`${apiOrigin}/api/v1/health/ready`);
  const home = await group.waitForHttp(webOrigin);
  assert.match(await home.text(), /Futeio/);
  const forwarded = await group.waitForHttp(`${webOrigin}/api/v1/health/ready`);
  assert.match(forwarded.headers.get('content-type') ?? '', /application\/json/);
  assert.ok(forwarded.headers.get('x-request-id'), 'API request identifier must survive the web forwarding');
  console.log('Smoke passed: production web, API, PostgreSQL and same-origin forwarding.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'The production smoke validation failed.');
  process.exitCode = 1;
} finally {
  await group.stop();
}
