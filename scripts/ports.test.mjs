import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import test from 'node:test';
import { assertPortsAvailable } from './ports.mjs';

test('rejects an occupied port before smoke servers can start', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await assert.rejects(assertPortsAvailable([{ host: '127.0.0.1', port: server.address().port }]), /unavailable/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('releases the probe so a smoke server can actually bind', async () => {
  const reservation = createServer();
  await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  await assertPortsAvailable([{ host: '127.0.0.1', port }]);
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  await new Promise((resolve) => server.close(resolve));
});
