import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { assertPortsAvailable } from './ports.mjs';

const apiPort = process.env.API_PORT ?? '3001';
const children = [];

function launch(args, cwd) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const record = { child, output: '', failure: null };
  child.on('error', (error) => { record.failure = error; });
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (data) => { record.output = (record.output + data.toString()).slice(-20000); });
  }
  children.push(record);
}

async function waitFor(url) {
  let lastStatus = 'unreachable';
  for (let attempt = 0; attempt < 40; attempt += 1) {
    for (const { child, failure } of children) {
      if (failure) throw failure;
      if (child.exitCode !== null) throw new Error(`A smoke-test process exited with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      lastStatus = response.status;
      if (response.ok) return response;
    } catch { /* Servers may still be starting. */ }
    await delay(500);
  }
  throw new Error(`Smoke endpoint did not become ready: ${url} (${lastStatus})`);
}

try {
  await assertPortsAvailable([{ host: '127.0.0.1', port: Number(apiPort) }, { host: '127.0.0.1', port: 3000 }]);
  launch(['dist/main.js'], fileURLToPath(new URL('../api/', import.meta.url)));
  launch(['node_modules/next/dist/bin/next', 'start', '--port', '3000', '--hostname', '127.0.0.1'], fileURLToPath(new URL('../web/', import.meta.url)));
  await waitFor(`http://127.0.0.1:${apiPort}/api/v1/health/ready`);
  const home = await waitFor('http://127.0.0.1:3000');
  assert.match(await home.text(), /Futeio/);
  const forwarded = await waitFor('http://127.0.0.1:3000/api/v1/health/ready');
  assert.match(forwarded.headers.get('content-type') ?? '', /application\/json/);
  assert.ok(forwarded.headers.get('x-request-id'), 'API request identifier must survive the web forwarding');
  console.log('Smoke passed: production web, API, PostgreSQL and same-origin forwarding.');
} catch (error) {
  for (const { output } of children) if (output) console.error(output);
  throw error;
} finally {
  for (const { child } of children) if (child.exitCode === null) child.kill();
}
