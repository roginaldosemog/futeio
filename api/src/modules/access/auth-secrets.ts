import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'futeio_session';
export function newSecret(): string { return randomBytes(32).toString('base64url'); }
export function secretHash(value: string): string { return createHash('sha256').update(value).digest('hex'); }
export function csrfFor(session: string, key: Buffer): string {
  return createHmac('sha256', key).update(`futeio:csrf:v1:${session}`).digest('base64url');
}
export function validCsrf(value: unknown, session: string, key: Buffer): boolean {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value)) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(csrfFor(session, key)));
}
export function readSessionCookie(header: string | undefined): string | undefined {
  const values = (header ?? '').split(';').map((part) => part.trim()).filter((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (values.length !== 1) return undefined;
  const token = values[0]!.slice(SESSION_COOKIE.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
}
