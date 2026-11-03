import { Buffer } from 'node:buffer';
import { scryptSync } from 'node:crypto';

// Synthetic credentials for isolated tests and contract generation only.
export const TEST_ADMIN_EMAIL = 'e2e-admin@example.test';
export const TEST_ADMIN_PASSWORD = 'Fixture-only-password-2026!';

export function createAdminFixture(origin = 'http://localhost:3000') {
  const salt = Buffer.from('futeio-test-salt', 'utf8');
  const key = scryptSync(TEST_ADMIN_PASSWORD, salt, 64, {
    N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024,
  });
  return {
    ADMIN_EMAIL: TEST_ADMIN_EMAIL,
    ADMIN_PASSWORD_HASH: `scrypt$32768$8$3$${salt.toString('base64url')}$${key.toString('base64url')}`,
    AUTH_SECRET: 'c'.repeat(43),
    APP_ORIGIN: origin,
  };
}
