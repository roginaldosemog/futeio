import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { AUTH_CLOCK, type Clock } from './clock';
import { PILOT_GROUP_ID, PLAYER_SESSION_TTL_MS } from './auth-policy';
import { newSecret, secretHash } from './auth-secrets';
import { SessionService } from './session.service';
import { SESSION_INCLUDE, type AccessContext, type BrowserContext } from './access-context';
import { PlayerCredentialService } from './player-credential.service';
import type { SessionResponseDto } from './access.dto';

@Injectable()
export class PlayerAccessService {
  constructor(private readonly prisma: PrismaService, private readonly sessions: SessionService, private readonly credentials: PlayerCredentialService, @Inject(AUTH_CLOCK) private readonly clock: Clock) {}

  async redeem(secret: string, browser: BrowserContext, response: Response): Promise<SessionResponseDto> {
    const now = this.clock.now();
    const token = newSecret();
    const tokenHash = secretHash(secret);
    const created = await this.prisma.$transaction(async (transaction) => {
      // Redemption and rotation lock the same profile, so an old credential can
      // never create a usable session after revocation has committed.
      await transaction.$queryRaw`SELECT p.id FROM players p JOIN player_access_credentials c ON c.player_id = p.id AND c.group_id = p.group_id WHERE c.token_hash = ${tokenHash} AND p.group_id = ${PILOT_GROUP_ID}::uuid FOR UPDATE OF p`;
      const credential = await transaction.playerAccessCredential.findUnique({ where: { tokenHash }, include: { player: true } });
      if (!credential || credential.revokedAt || credential.groupId !== PILOT_GROUP_ID) throw new UnauthorizedException();
      const revoked = await transaction.accessSession.updateMany({ where: { id: browser.session.id, revokedAt: null, expiresAt: { gt: now } }, data: { revokedAt: now } });
      if (revoked.count !== 1) throw new UnauthorizedException();
      return transaction.accessSession.create({ data: {
        tokenHash: secretHash(token), role: 'PLAYER', groupId: credential.groupId,
        identityId: credential.player.identityId, playerCredentialId: credential.id,
        expiresAt: new Date(now.getTime() + PLAYER_SESSION_TTL_MS), createdAt: now,
      }, include: SESSION_INCLUDE });
    });
    this.sessions.setCookie(response, token, created);
    return this.sessions.view({ token, session: created });
  }

  async changeLink(playerId: string, access: AccessContext, rotate: boolean): Promise<string | undefined> {
    return this.prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<{ id: string }[]>`SELECT id FROM players WHERE id = ${playerId}::uuid AND group_id = ${access.groupId}::uuid FOR UPDATE`;
      if (!rows.length) throw new NotFoundException();
      const now = this.clock.now();
      await transaction.playerAccessCredential.updateMany({ where: { playerId, groupId: access.groupId, revokedAt: null }, data: { revokedAt: now } });
      await transaction.accessSession.updateMany({ where: { playerCredential: { playerId, groupId: access.groupId }, revokedAt: null }, data: { revokedAt: now } });
      return rotate ? this.credentials.create(transaction, access.groupId, playerId) : undefined;
    });
  }
}
