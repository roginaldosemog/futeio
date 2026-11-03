import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import type { AccessContext } from '../access/access-context';
import { PlayerCredentialService } from '../access/player-credential.service';
import { InitialRatingService } from '../evaluations/initial-rating.service';
import type { CreatePlayerDto, CreatePlayerResponseDto, PlayerSummaryDto } from './players.dto';

@Injectable()
export class CreatePlayerService {
  constructor(private readonly prisma: PrismaService, private readonly initialRatings: InitialRatingService, private readonly credentials: PlayerCredentialService) {}

  async create(input: CreatePlayerDto, access: AccessContext): Promise<CreatePlayerResponseDto> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        let identityId = access.identityId;
        if (!input.linkToCurrentAdministrator) {
          const identity = await transaction.identity.create({ data: { memberships: { create: { groupId: access.groupId, role: 'PLAYER' } } } });
          identityId = identity.id;
        }
        const player = await transaction.player.create({ data: { groupId: access.groupId, identityId, name: input.name } });
        await this.initialRatings.create(transaction, access.groupId, player.id, access.identityId, input.initialRating);
        const accessUrl = await this.credentials.create(transaction, access.groupId, player.id);
        return { player: { id: player.id, name: player.name, rating: input.initialRating, isOwnProfile: identityId === access.identityId }, accessUrl };
      });
    } catch (error) {
      if (input.linkToCurrentAdministrator && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('A profile already exists for this identity in the group.');
      throw error;
    }
  }

  async list(access: AccessContext): Promise<PlayerSummaryDto[]> {
    const players = await this.prisma.player.findMany({
      where: { groupId: access.groupId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, identityId: true, evaluations: { orderBy: { createdAt: 'asc' }, take: 1, select: { rating: true } } },
    });
    return players.map((player) => {
      const initial = player.evaluations[0];
      if (!initial) throw new Error('The player initial contribution is unavailable.');
      return { id: player.id, name: player.name, rating: initial.rating, isOwnProfile: player.identityId === access.identityId };
    });
  }
}
