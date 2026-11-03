import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// Fixed OWASP scrypt profile; never accept cost parameters from a request or hash.
const PROFILE = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const PREFIX = 'scrypt$32768$8$3$';
const FORMAT = /^scrypt\$32768\$8\$3\$([A-Za-z0-9_-]{22})\$([A-Za-z0-9_-]{86})$/;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, PROFILE, (error, key) => error ? reject(error) : resolve(key));
  });
}

export function isPasswordHash(encoded: string): boolean {
  const match = FORMAT.exec(encoded);
  return !!match && [match[1]!, match[2]!].every((value) => Buffer.from(value, 'base64url').toString('base64url') === value);
}

export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length > 256) throw new Error('Password must contain between 1 and 256 characters.');
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `${PREFIX}${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  if (!password || password.length > 256 || !isPasswordHash(encoded)) return false;
  const match = FORMAT.exec(encoded)!;
  const key = await derive(password, Buffer.from(match[1]!, 'base64url'));
  return timingSafeEqual(key, Buffer.from(match[2]!, 'base64url'));
}
