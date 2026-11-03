import { loadAuthConfiguration } from './auth-configuration';

const valid = {
  ADMIN_EMAIL: 'Owner@Example.test',
  APP_ORIGIN: 'http://localhost:3000',
  ADMIN_PASSWORD_HASH: `scrypt$32768$8$3$${Buffer.alloc(16, 1).toString('base64url')}$${Buffer.alloc(64, 2).toString('base64url')}`,
  AUTH_SECRET: Buffer.alloc(32, 7).toString('base64url'),
};

describe('Auth configuration', () => {
  it('normalizes the configured administrator address without requiring email delivery', () => {
    const result = loadAuthConfiguration(valid);
    expect(result.adminEmail).toBe('owner@example.test');
    expect(result.secureCookies).toBe(false);
  });
  it('requires secure cookies for HTTPS independent of proxy headers', () => {
    expect(loadAuthConfiguration({ ...valid, APP_ORIGIN: 'https://futeio.example.test' }).secureCookies).toBe(true);
  });
  it.each(['ADMIN_EMAIL', 'ADMIN_PASSWORD_HASH', 'AUTH_SECRET', 'APP_ORIGIN'])('rejects missing %s', (key) => {
    expect(() => loadAuthConfiguration({ ...valid, [key]: '' })).toThrow();
  });
  it.each(['http://outside.example.test', 'https://user:fixture@', 'https://user:fixture@example.test', 'https://example.test/path', 'https://example.test?fixture=private', 'ftp://localhost:3000'])('rejects unsafe origin without retaining its value: %s', (origin) => {
    try {
      loadAuthConfiguration({ ...valid, APP_ORIGIN: origin });
      throw new Error('Expected configuration rejection');
    } catch (error) {
      expect((error as Error).message).toBe('APP_ORIGIN must be an HTTPS origin, or HTTP on loopback, without credentials or a path.');
      expect(Object.hasOwn(error as object, 'input')).toBe(false);
      expect(Object.hasOwn(error as object, 'cause')).toBe(false);
    }
  });
  it('rejects a weak CSRF signing secret', () => {
    expect(() => loadAuthConfiguration({ ...valid, AUTH_SECRET: 'short' })).toThrow('AUTH_SECRET');
  });
  it('rejects malformed administrator addresses and plaintext passwords', () => {
    expect(() => loadAuthConfiguration({ ...valid, ADMIN_EMAIL: 'not-an-email' })).toThrow('ADMIN_EMAIL');
    expect(() => loadAuthConfiguration({ ...valid, ADMIN_PASSWORD_HASH: 'fixture plaintext' })).toThrow('ADMIN_PASSWORD_HASH');
  });
});
