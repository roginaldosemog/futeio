import { HttpException, Inject, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { AUTH_CLOCK, type Clock } from './clock';
import { RATE_WINDOW_MS } from './auth-policy';
import { secretHash } from './auth-secrets';

@Injectable()
export class AuthRateLimiter {
  constructor(private readonly prisma: PrismaService, @Inject(AUTH_CLOCK) private readonly clock: Clock) {}

  async within(scope: string, subject: string, maximum: number): Promise<boolean> {
    const now = this.clock.now();
    const window = Math.floor(now.getTime() / RATE_WINDOW_MS) * RATE_WINDOW_MS;
    const id = secretHash(`${scope}:${subject}:${window}`);
    const expiresAt = new Date(window + RATE_WINDOW_MS);
    const result = await this.prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO auth_rate_limits (id, count, expires_at) VALUES (${id}, 1, ${expiresAt})
      ON CONFLICT (id) DO UPDATE SET count = LEAST(auth_rate_limits.count + 1, ${maximum + 1})
      RETURNING count`;
    await this.prisma.authRateLimit.deleteMany({ where: { expiresAt: { lte: now } } });
    if (!result[0]) throw new Error('Rate limit storage is unavailable.');
    return result[0].count <= maximum;
  }

  async peer(request: Request, response: Response, scope: string, maximum: number): Promise<void> {
    // No trust in client-supplied forwarding headers. Next peers share this budget in E2.
    const address = (request.socket.remoteAddress ?? 'unknown').replace(/^::ffff:/, '');
    const peer = address === '::1' ? '127.0.0.1' : address;
    if (!await this.within(`peer:${scope}`, peer, maximum)) {
      const remaining = RATE_WINDOW_MS - this.clock.now().getTime() % RATE_WINDOW_MS;
      response.setHeader('Retry-After', String(Math.ceil(remaining / 1000)));
      throw new HttpException('Too many requests.', 429);
    }
  }
}
