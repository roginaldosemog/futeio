import { createServer } from 'node:net';

export function readPort(value, name) {
  if (!/^\d+$/.test(value) || !Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535.`);
  }
  return Number(value);
}

export async function assertPortsAvailable(endpoints) {
  const addresses = new Set();
  for (const { host, port } of endpoints) {
    const address = `${host}:${port}`;
    if (addresses.has(address)) throw new Error('Validation servers require different ports.');
    addresses.add(address);
  }
  for (const { host, port } of endpoints) {
    const probe = createServer();
    await new Promise((resolve, reject) => {
      probe.once('error', () => reject(new Error(`Validation port ${host}:${port} is unavailable; stop the existing server before testing.`)));
      probe.listen(port, host, resolve);
    });
    await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  }
}
