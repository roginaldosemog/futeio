import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('Firebase Auth and RSA JWKS work when the runtime disables require(esm)', () => {
  const source = `
    import { createRequire } from 'node:module';
    import { generateKeyPairSync, sign, verify } from 'node:crypto';
    import assert from 'node:assert/strict';
    const req = createRequire(new URL('./web/package.json', import.meta.url));
    const entry = req.resolve('firebase-admin/auth');
    assert.equal(typeof req('firebase-admin/auth').getAuth, 'function');
    const jwks = createRequire(entry)('jwks-rsa');
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const client = jwks({ fetcher: async () => ({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'probe', alg: 'RS256', use: 'sig' }] }) });
    const key = await client.getSigningKey('probe');
    const message = Buffer.from('synthetic runtime compatibility check');
    assert.ok(verify('RSA-SHA256', message, key.getPublicKey(), sign('RSA-SHA256', message, privateKey)));
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'probe' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'synthetic' })).toString('base64url');
    const signingInput = header + '.' + payload;
    const token = signingInput + '.' + sign('RSA-SHA256', Buffer.from(signingInput), privateKey).toString('base64url');
    const provider = jwks.passportJwtSecret({ jwksUri: 'https://synthetic.invalid/jwks', fetcher: async () => ({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'probe', alg: 'RS256', use: 'sig' }] }) });
    const suppliedKey = await new Promise((resolve, reject) => provider({}, token, (error, value) => error ? reject(error) : resolve(value)));
    assert.ok(verify('RSA-SHA256', message, suppliedKey, sign('RSA-SHA256', message, privateKey)));
    const malformedKey = await new Promise((resolve, reject) => provider({}, 'invalid', (error, value) => error ? reject(error) : resolve(value)));
    assert.equal(malformedKey, null);
    console.log('firebase-auth-and-jwks-ok');
  `;
  const output = execFileSync(process.execPath, ['--no-experimental-require-module', '--input-type=module', '-'], {
    input: source, encoding: 'utf8', cwd: new URL('..', import.meta.url), windowsHide: true, timeout: 20_000,
  });
  assert.match(output, /firebase-auth-and-jwks-ok/);
});
