import { randomBytes } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import type { AccessContext } from '../access/access-context';
import { calculateRating, RATING_CALCULATION_VERSION } from '../evaluations/calculate-rating';
import { balanceTeams, DRAW_ALGORITHM_VERSION } from './balance-teams';
import type { CreateDrawDto, DrawDto, DrawTeamDto } from './draws.dto';

@Injectable()
export class DrawsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateDrawDto, access: AccessContext): Promise<DrawDto> {
    const seed = input.seed ?? randomBytes(16).toString('hex');
    return this.prisma.$transaction(async (transaction) => {
      const participants = await transaction.player.findMany({ where: { groupId: access.groupId, id: { in: input.playerIds } }, select: { id: true, name: true, evaluations: { select: { rating: true } } } });
      if (participants.length !== 20) throw new NotFoundException('A participant is unavailable in this group.');
      const rated = participants.map((player) => ({ id: player.id, name: player.name, rating: calculateRating(player.evaluations.map((evaluation) => evaluation.rating)) }));
      const result = balanceTeams(rated, seed);
      const names = new Map(rated.map((player) => [player.id, player.name]));
      const teams: DrawTeamDto[] = result.teams.map((team, index) => {
        const players = team.map((player) => ({ ...player, name: names.get(player.id)! }));
        const total = players.reduce((sum, player) => sum + player.rating, 0);
        return { number: index + 1, players, total, average: total / 5 };
      });
      const snapshot = { teams, spread: result.spread, variance: result.variance };
      const draw = await transaction.draw.create({ data: { groupId: access.groupId, createdBy: access.identityId, seed, algorithmVersion: DRAW_ALGORITHM_VERSION, calculationVersion: RATING_CALCULATION_VERSION, snapshot: snapshot as unknown as Prisma.InputJsonValue } });
      return { id: draw.id, createdAt: draw.createdAt.toISOString(), seed, algorithmVersion: draw.algorithmVersion, calculationVersion: draw.calculationVersion, ...snapshot };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 10000 });
  }

  async list(access: AccessContext): Promise<DrawDto[]> {
    const rows = await this.prisma.draw.findMany({ where: { groupId: access.groupId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50 });
    return rows.map((row) => this.view(row));
  }

  async get(id: string, access: AccessContext): Promise<DrawDto> {
    const draw = await this.prisma.draw.findFirst({ where: { id, groupId: access.groupId } });
    if (!draw) throw new NotFoundException();
    return this.view(draw);
  }

  private view(draw: { id: string; createdAt: Date; seed: string; algorithmVersion: string; calculationVersion: string; snapshot: Prisma.JsonValue }): DrawDto {
    const snapshot = draw.snapshot as unknown as Pick<DrawDto, 'teams' | 'spread' | 'variance'>;
    return { id: draw.id, createdAt: draw.createdAt.toISOString(), seed: draw.seed, algorithmVersion: draw.algorithmVersion, calculationVersion: draw.calculationVersion, ...snapshot };
  }
}
