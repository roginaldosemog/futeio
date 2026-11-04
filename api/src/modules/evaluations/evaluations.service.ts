import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { AccessContext } from '../access/access-context';
import { calculateRating, discardedPerSide, RATING_CALCULATION_VERSION } from './calculate-rating';
import type { PlayerEvaluationsDto } from './evaluations.dto';

@Injectable()
export class EvaluationsService {
  constructor(private readonly prisma: PrismaService) {}

  async table(playerId: string, access: AccessContext): Promise<PlayerEvaluationsDto> {
    const player = await this.prisma.player.findFirst({
      where: { id: playerId, groupId: access.groupId },
      select: { evaluations: { select: { rating: true, evaluatorIdentityId: true, evaluator: { select: { player: { select: { name: true } } } } } } },
    });
    if (!player) throw new NotFoundException();
    const ratings = player.evaluations.map((evaluation) => evaluation.rating);
    // Sorting by value exposes no stable evaluator pseudonym or time ordering.
    const evaluations = player.evaluations.map((evaluation) => {
      const isOwn = evaluation.evaluatorIdentityId === access.identityId;
      return {
        rating: evaluation.rating,
        isOwn,
        ...(isOwn || access.role === 'ADMIN' ? { authorName: evaluation.evaluator.player?.name ?? 'Administrador' } : {}),
      };
    }).sort((left, right) => left.rating - right.rating || Number(left.isOwn) - Number(right.isOwn) || (left.authorName ?? '').localeCompare(right.authorName ?? '', 'pt-BR'));
    return { evaluations, rating: calculateRating(ratings), evaluationCount: ratings.length, discardedPerSide: discardedPerSide(ratings.length), calculationVersion: RATING_CALCULATION_VERSION };
  }

  async evaluate(playerId: string, rating: number, access: AccessContext): Promise<PlayerEvaluationsDto> {
    const target = await this.prisma.player.findFirst({ where: { id: playerId, groupId: access.groupId }, select: { id: true } });
    if (!target) throw new NotFoundException();
    // The composite unique key and PostgreSQL upsert retain one current contribution.
    await this.prisma.evaluation.upsert({
      where: { groupId_playerId_evaluatorIdentityId: { groupId: access.groupId, playerId, evaluatorIdentityId: access.identityId } },
      create: { groupId: access.groupId, playerId, evaluatorIdentityId: access.identityId, rating },
      update: { rating },
    });
    return this.table(playerId, access);
  }
}
