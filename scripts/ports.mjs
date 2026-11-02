import { createServer } from 'node:net';

export async function assertPortsAvailable(endpoints) {
  for (const { host, port } of endpoints) {
    const probe = createServer();
    await new Promise((resolve, reject) => {
      probe.once('error', (cause) => reject(new Error(`Smoke port ${host}:${port} is unavailable; stop the existing server before testing.`, { cause })));
      probe.listen(port, host, resolve);
    });
    await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  }
}
