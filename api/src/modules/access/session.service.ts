import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AccessSession } from '../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AUTH_CONFIGURATION, type AuthConfiguration, credentialVersion } from './auth-configuration';
import { AUTH_CLOCK, type Clock } from './clock';
import { ANONYMOUS_TTL_MS, PILOT_GROUP_ID } from './auth-policy';
import { newSecret, readSessionCookie, secretHash, SESSION_COOKIE } from './auth-secrets';
import type { AccessContext, BrowserContext } from './access-context';
import { SESSION_INCLUDE } from './access-context';
import type { SessionResponseDto } from './access.dto';

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService, @Inject(AUTH_CONFIGURATION) private readonly configuration: AuthConfiguration, @Inject(AUTH_CLOCK) private readonly clock: Clock) {}

  async fromToken(token: string): Promise<BrowserContext> {
    const session = await this.prisma.accessSession.findUnique({ where: { tokenHash: secretHash(token) }, include: SESSION_INCLUDE });
    const now = this.clock.now();
    if (!session || session.revokedAt || session.expiresAt <= now) throw new UnauthorizedException();
    if (session.role !== 'ANONYMOUS') {
      const member = session.membership;
      if (!member || session.groupId !== PILOT_GROUP_ID || (session.role === 'ADMIN' && (member.role !== 'ADMIN' || member.identity.email !== this.configuration.adminEmail || session.credentialVersion !== credentialVersion(this.configuration)))) throw new UnauthorizedException();
      if (session.role === 'PLAYER') {
        const credential = session.playerCredential;
        if (!credential || credential.revokedAt || credential.groupId !== session.groupId || credential.player.identityId !== session.identityId || credential.player.id !== member.player?.id) throw new UnauthorizedException();
      }
    }
    return { session, token };
  }

  async requireBrowser(request: Request): Promise<BrowserContext> {
    const token = readSessionCookie(request.headers.cookie);
    if (!token) throw new UnauthorizedException();
    return this.fromToken(token);
  }

  async getBrowser(request: Request, response: Response): Promise<BrowserContext> {
    const token = readSessionCookie(request.headers.cookie);
    if (token) {
      try { return await this.fromToken(token); } catch (error) { if (!(error instanceof UnauthorizedException)) throw error; }
    }
    const now = this.clock.now();
    // Expired hashes have no product history value; this bounds anonymous context retention.
    await this.prisma.accessSession.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } });
    const freshToken = newSecret();
    const session = await this.prisma.accessSession.create({ data: { tokenHash: secretHash(freshToken), role: 'ANONYMOUS', createdAt: now, expiresAt: new Date(now.getTime() + ANONYMOUS_TTL_MS) }, include: SESSION_INCLUDE });
    this.setCookie(response, freshToken, session);
    return { token: freshToken, session };
  }

  authenticated(context: BrowserContext): AccessContext {
    const { session } = context;
    if (session.role === 'ANONYMOUS' || !session.identityId || !session.groupId) throw new UnauthorizedException();
    return { identityId: session.identityId, groupId: session.groupId, role: session.role, sessionId: session.id };
  }

  view(context: BrowserContext): SessionResponseDto {
    const access = this.authenticated(context);
    const playerId = context.session.membership?.player?.id;
    return { role: access.role, identityId: access.identityId, groupId: access.groupId, ...(playerId ? { playerId } : {}), ...(access.role === 'ADMIN' ? { email: context.session.membership!.identity.email! } : {}) };
  }

  setCookie(response: Response, token: string, session: Pick<AccessSession, 'expiresAt'>): void {
    response.cookie(SESSION_COOKIE, token, { httpOnly: true, secure: this.configuration.secureCookies, sameSite: 'lax', path: '/', maxAge: Math.max(0, session.expiresAt.getTime() - this.clock.now().getTime()) });
  }

  async logout(context: BrowserContext, response: Response): Promise<void> {
    this.authenticated(context);
    await this.prisma.accessSession.update({ where: { id: context.session.id }, data: { revokedAt: this.clock.now() } });
    response.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: this.configuration.secureCookies, sameSite: 'lax', path: '/' });
  }
}
