import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';

@Injectable()
export class InitialRatingService {
  async create(transaction: Prisma.TransactionClient, groupId: string, playerId: string, evaluatorIdentityId: string, rating: number): Promise<void> {
    await transaction.evaluation.create({ data: { groupId, playerId, evaluatorIdentityId, rating } });
  }
}
