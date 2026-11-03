import { newSecret, secretHash, csrfFor, validCsrf, readSessionCookie } from './auth-secrets';

describe('Opaque credentials and CSRF', () => {
  const key = Buffer.alloc(32, 9);
  it('generates independent 256-bit URL-safe credentials', () => {
    const values = Array.from({ length: 20 }, newSecret);
    expect(new Set(values).size).toBe(20);
    expect(values.every((value) => /^[A-Za-z0-9_-]{43}$/.test(value))).toBe(true);
  });
  it('stores a hash rather than the raw credential', () => {
    const token = newSecret();
    expect(secretHash(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(secretHash(token)).not.toBe(token);
    expect(secretHash(token)).toBe(secretHash(token));
  });
  it('binds CSRF to both the current session and the server key', () => {
    const token = newSecret();
    const csrf = csrfFor(token, key);
    expect(validCsrf(csrf, token, key)).toBe(true);
    expect(validCsrf(csrf, newSecret(), key)).toBe(false);
    expect(validCsrf(csrf, token, Buffer.alloc(32, 1))).toBe(false);
    expect(validCsrf(undefined, token, key)).toBe(false);
    expect(validCsrf('wrong', token, key)).toBe(false);
  });
  it('rejects ambiguous, encoded or malformed session cookies', () => {
    const token = newSecret();
    expect(readSessionCookie(`other=value; futeio_session=${token}`)).toBe(token);
    expect(readSessionCookie(`futeio_session=${token}; futeio_session=${token}`)).toBeUndefined();
    expect(readSessionCookie('futeio_session=%61')).toBeUndefined();
    expect(readSessionCookie(undefined)).toBeUndefined();
  });
});
