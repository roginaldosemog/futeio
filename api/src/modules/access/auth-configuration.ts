import { isEmail } from 'class-validator';
import { isPasswordHash } from './password';
import { secretHash } from './auth-secrets';

export interface AuthConfiguration {
  adminEmail: string;
  passwordHash: string;
  origin: string;
  secureCookies: boolean;
  secret: Buffer;
}

export const AUTH_CONFIGURATION = Symbol('AUTH_CONFIGURATION');
export function credentialVersion(configuration: AuthConfiguration): string {
  return secretHash(`futeio:admin:v1:${configuration.adminEmail}:${configuration.passwordHash}`);
}

export function loadAuthConfiguration(environment: NodeJS.ProcessEnv): AuthConfiguration {
  const recipient = environment.ADMIN_EMAIL?.trim() ?? '';
  if (!isEmail(recipient) || recipient.length > 254) throw new Error('ADMIN_EMAIL must be a valid administrator email.');
  let origin: URL;
  const originError = 'APP_ORIGIN must be an HTTPS origin, or HTTP on loopback, without credentials or a path.';
  try { origin = new URL(environment.APP_ORIGIN ?? ''); } catch { throw new Error(originError); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  if (!(origin.protocol === 'https:' || (origin.protocol === 'http:' && loopback)) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error(originError);
  const passwordHash = environment.ADMIN_PASSWORD_HASH ?? '';
  if (!isPasswordHash(passwordHash)) throw new Error('ADMIN_PASSWORD_HASH must contain a provisioned scrypt hash.');
  const encodedSecret = environment.AUTH_SECRET ?? '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(encodedSecret) || Buffer.from(encodedSecret, 'base64url').length !== 32) throw new Error('AUTH_SECRET must contain a 32-byte base64url secret.');
  return { adminEmail: recipient.toLowerCase(), passwordHash, origin: origin.origin, secureCookies: origin.protocol === 'https:', secret: Buffer.from(encodedSecret, 'base64url') };
}
