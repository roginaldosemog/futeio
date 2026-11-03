import { hashPassword, isPasswordHash, verifyPassword } from './password';

describe('Administrator password storage', () => {
  it('uses unique salts and verifies the entire unmodified password', async () => {
    const password = 'Fixture password 2026!';
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).not.toBe(second);
    expect(isPasswordHash(first)).toBe(true);
    expect(first).not.toContain(password);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword(`${password} `, first)).toBe(false);
    expect(await verifyPassword('Wrong fixture password', first)).toBe(false);
  });
  it.each(['', 'plaintext', 'scrypt$2$8$1$bad$bad'])('rejects invalid hashes without deriving attacker supplied parameters', async (encoded) => {
    expect(isPasswordHash(encoded)).toBe(false);
    expect(await verifyPassword('fixture', encoded)).toBe(false);
  });
  it('rejects empty and oversized passwords during provisioning', async () => {
    await expect(hashPassword('')).rejects.toThrow();
    await expect(hashPassword('a'.repeat(257))).rejects.toThrow();
  });
});
