import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { AUTH_CONFIGURATION, type AuthConfiguration, credentialVersion } from './auth-configuration';
import { AUTH_CLOCK, type Clock } from './clock';
import { newSecret, secretHash } from './auth-secrets';
import { PILOT_GROUP_ID, SESSION_TTL_MS } from './auth-policy';
import { SessionService } from './session.service';
import { verifyPassword } from './password';
import type { BrowserContext } from './access-context';
import { SESSION_INCLUDE } from './access-context';
import type { SessionResponseDto } from './access.dto';
import type { NativeSessionResponseDto } from './access.dto';

@Injectable()
export class AdminLoginService {
  constructor(private readonly prisma: PrismaService, private readonly sessions: SessionService, @Inject(AUTH_CONFIGURATION) private readonly configuration: AuthConfiguration, @Inject(AUTH_CLOCK) private readonly clock: Clock) {}

  async login(email: string, password: string, browser: BrowserContext, response: Response): Promise<SessionResponseDto> {
    const context = await this.createSession(email, password, browser);
    this.sessions.setCookie(response, context.token, context.session);
    return this.sessions.view(context);
  }

  async loginNative(email: string, password: string): Promise<NativeSessionResponseDto> {
    const context = await this.createSession(email, password);
    return { session: this.sessions.view(context), token: context.token };
  }

  private async createSession(email: string, password: string, browser?: BrowserContext): Promise<BrowserContext> {
    // Derive for unknown addresses too. Failed attempts never create identities.
    const matches = await verifyPassword(password, this.configuration.passwordHash);
    if (email.trim().toLowerCase() !== this.configuration.adminEmail || !matches) throw new UnauthorizedException();
    const now = this.clock.now();
    const token = newSecret();
    const created = await this.prisma.$transaction(async (transaction) => {
      if (browser) {
        const revoked = await transaction.accessSession.updateMany({ where: { id: browser.session.id, revokedAt: null, expiresAt: { gt: now } }, data: { revokedAt: now } });
        if (revoked.count !== 1) throw new UnauthorizedException();
      }
      const identity = await transaction.identity.upsert({ where: { email: this.configuration.adminEmail }, update: {}, create: { email: this.configuration.adminEmail } });
      await transaction.membership.upsert({ where: { groupId_identityId: { groupId: PILOT_GROUP_ID, identityId: identity.id } }, update: { role: 'ADMIN' }, create: { groupId: PILOT_GROUP_ID, identityId: identity.id, role: 'ADMIN' } });
      return transaction.accessSession.create({ data: {
        tokenHash: secretHash(token), role: 'ADMIN', identityId: identity.id, groupId: PILOT_GROUP_ID,
        credentialVersion: credentialVersion(this.configuration),
        expiresAt: new Date(now.getTime() + SESSION_TTL_MS), createdAt: now,
      }, include: SESSION_INCLUDE });
    });
    return { token, session: created };
  }
}
