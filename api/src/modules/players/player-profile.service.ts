import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { AccessContext } from '../access/access-context';
import { calculateRating } from '../evaluations/calculate-rating';
import type { PlayerProfileDto } from './player-profile.dto';
import { normalizePlayerPhoto } from './player-photo';

@Injectable()
export class PlayerProfileService {
  constructor(private readonly prisma: PrismaService) {}

  private async find(playerId: string, access: AccessContext) {
    const player = await this.prisma.player.findFirst({ where: { id: playerId, groupId: access.groupId }, select: { id: true, name: true, identityId: true, photoBytes: true, evaluations: { select: { rating: true } } } });
    if (!player) throw new NotFoundException();
    return player;
  }

  async get(playerId: string, access: AccessContext): Promise<PlayerProfileDto> {
    const player = await this.find(playerId, access);
    const isOwnProfile = player.identityId === access.identityId;
    return { id: player.id, name: player.name, rating: calculateRating(player.evaluations.map(({ rating }) => rating)), isOwnProfile, canEdit: access.role === 'ADMIN' || isOwnProfile, ...(player.photoBytes ? { photoUrl: `/api/v1/players/${player.id}/photo` } : {}) };
  }

  private async requireEdit(playerId: string, access: AccessContext): Promise<void> {
    const player = await this.find(playerId, access);
    if (access.role !== 'ADMIN' && player.identityId !== access.identityId) throw new ForbiddenException();
  }

  async rename(playerId: string, name: string, access: AccessContext): Promise<PlayerProfileDto> {
    await this.requireEdit(playerId, access);
    await this.prisma.player.update({ where: { groupId_id: { groupId: access.groupId, id: playerId } }, data: { name } });
    return this.get(playerId, access);
  }

  async upload(playerId: string, data: string, access: AccessContext): Promise<PlayerProfileDto> {
    await this.requireEdit(playerId, access);
    const photoBytes = await normalizePlayerPhoto(data);
    await this.prisma.player.update({ where: { groupId_id: { groupId: access.groupId, id: playerId } }, data: { photoBytes } });
    return this.get(playerId, access);
  }

  async removePhoto(playerId: string, access: AccessContext): Promise<PlayerProfileDto> {
    await this.requireEdit(playerId, access);
    await this.prisma.player.update({ where: { groupId_id: { groupId: access.groupId, id: playerId } }, data: { photoBytes: null } });
    return this.get(playerId, access);
  }

  async photo(playerId: string, access: AccessContext): Promise<Uint8Array> {
    const player = await this.find(playerId, access);
    if (!player.photoBytes) throw new NotFoundException();
    return player.photoBytes;
  }
}
