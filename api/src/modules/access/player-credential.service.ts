import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { AUTH_CONFIGURATION, type AuthConfiguration } from './auth-configuration';
import { newSecret, secretHash } from './auth-secrets';

@Injectable()
export class PlayerCredentialService {
  constructor(@Inject(AUTH_CONFIGURATION) private readonly configuration: AuthConfiguration) {}

  async create(transaction: Prisma.TransactionClient, groupId: string, playerId: string): Promise<string> {
    const token = newSecret();
    await transaction.playerAccessCredential.create({ data: { groupId, playerId, tokenHash: secretHash(token) } });
    const url = new URL('/acesso/jogador', this.configuration.origin);
    url.hash = new URLSearchParams({ token }).toString();
    return url.toString();
  }
}
