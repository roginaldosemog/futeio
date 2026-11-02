import assert from 'node:assert/strict';
import test from 'node:test';

let version = 0;
async function readConfig(origin) {
  const previous = process.env.API_ORIGIN;
  process.env.API_ORIGIN = origin;
  try {
    const url = new URL('../web/next.config.ts', import.meta.url);
    url.searchParams.set('test', String(version += 1));
    return (await import(url.href)).default;
  } finally {
    if (previous === undefined) delete process.env.API_ORIGIN;
    else process.env.API_ORIGIN = previous;
  }
}

test('forwards only the API prefix to the configured server origin', async () => {
  const config = await readConfig('http://127.0.0.1:3001');
  assert.deepEqual(await config.rewrites(), [{ source: '/api/v1/:path*', destination: 'http://127.0.0.1:3001/api/v1/:path*' }]);
});

test('rejects malformed origins without retaining secret input in the error', async () => {
  await assert.rejects(readConfig('http://user:review-only-secret@'), (error) => {
    assert.equal(error.message, 'API_ORIGIN must be an HTTP(S) origin without a path or credentials.');
    assert.equal(Object.hasOwn(error, 'input'), false);
    assert.equal(Object.hasOwn(error, 'cause'), false);
    return true;
  });
});

test('rejects credentials, paths, queries and non-HTTP origins', async () => {
  for (const origin of ['http://user:review-only-secret@localhost:3001', 'http://localhost:3001/private', 'http://localhost:3001?token=fixture', 'ftp://localhost:3001']) {
    await assert.rejects(readConfig(origin), { message: 'API_ORIGIN must be an HTTP(S) origin without a path or credentials.' });
  }
});
