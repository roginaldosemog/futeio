import assert from 'node:assert/strict';
import test from 'node:test';
import { createProcessGroup } from './process-group.mjs';

async function startFixture(group, exitCode) {
  const script = `process.on('message', (message) => {
    if (message.type === 'futeio-test-shutdown') process.exit(${exitCode});
  }); process.send({ type: 'ready' });`;
  const record = group.start('IPC fixture', ['-e', script], process.cwd(), process.env, { ipc: true });
  await new Promise((resolve, reject) => {
    record.child.once('message', resolve);
    record.child.once('error', reject);
  });
  return record.child;
}

test('asks an owned API process to clean up before terminating it, including on Windows', async () => {
  const group = createProcessGroup();
  const child = await startFixture(group, 0);
  await group.stop();
  assert.equal(child.exitCode, 0);
  assert.equal(child.signalCode, null);
  await group.stop();
});

test('reports a failed fixture cleanup instead of claiming a passing validation', async () => {
  const group = createProcessGroup();
  const child = await startFixture(group, 1);
  await assert.rejects(group.stop(), /did not finish its cleanup/);
  assert.equal(child.exitCode, 1);
});
