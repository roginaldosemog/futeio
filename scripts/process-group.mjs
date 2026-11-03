import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

export function createProcessGroup() {
  const records = [];
  let stopPromise;

  function start(label, args, cwd, environment, options = {}) {
    const stdio = options.showOutput ? ['ignore', 'inherit', 'inherit'] : ['ignore', 'pipe', 'pipe'];
    if (options.ipc) stdio.push('ipc');
    const child = spawn(process.execPath, args, {
      cwd, env: environment, windowsHide: true,
      stdio,
    });
    const record = { child, label, failed: false, persistent: options.persistent ?? true, ipc: Boolean(options.ipc) };
    child.once('error', () => { record.failed = true; });
    child.stdout?.resume();
    child.stderr?.resume();
    records.push(record);
    return record;
  }

  async function run(label, args, cwd, environment, options = {}) {
    const record = start(label, args, cwd, environment, { ...options, persistent: false });
    await new Promise((resolve) => {
      record.child.once('close', resolve);
    });
    if (record.failed || record.child.exitCode !== 0) {
      throw new Error(`${label} failed${record.child.exitCode === null ? '' : ` (exit ${record.child.exitCode})`}.`);
    }
  }

  function assertRunning() {
    for (const { child, label, failed, persistent } of records) {
      if (!persistent) continue;
      if (failed || child.exitCode !== null || child.signalCode !== null) {
        throw new Error(`${label} stopped before the validation completed.`);
      }
    }
  }

  async function waitForHttp(url) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      assertRunning();
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
        if (response.ok) return response;
      } catch { /* A server may still be starting. */ }
      await delay(500);
    }
    throw new Error('A local validation endpoint did not become ready. Check the build and test database.');
  }

  async function stopRecords() {
    const running = () => records.filter(({ child }) => child.exitCode === null && child.signalCode === null && child.pid);
    const closing = running();
    for (const { child, ipc } of closing) {
      if (ipc && child.connected) {
        try { child.send({ type: 'futeio-test-shutdown' }, () => {}); } catch { child.kill('SIGTERM'); }
      } else child.kill('SIGTERM');
    }
    for (let attempt = 0; attempt < 40 && running().length; attempt += 1) await delay(100);
    for (const { child } of running()) child.kill('SIGKILL');
    for (let attempt = 0; attempt < 10 && running().length; attempt += 1) await delay(100);
    if (running().length || closing.some(({ child, ipc }) => ipc && child.exitCode !== 0)) {
      throw new Error('An isolated validation process did not finish its cleanup.');
    }
  }

  function stop() {
    stopPromise ??= stopRecords();
    return stopPromise;
  }

  return { start, run, waitForHttp, stop };
}
