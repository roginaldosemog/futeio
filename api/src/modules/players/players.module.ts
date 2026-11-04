import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AccessModule } from '../access/access.module';
import { InitialRatingService } from '../evaluations/initial-rating.service';
import { CreatePlayerService } from './create-player.service';
import { PlayersController } from './players.controller';
import { PlayerProfileController } from './player-profile.controller';
import { PlayerProfileService } from './player-profile.service';

@Module({ imports: [PrismaModule, AccessModule], controllers: [PlayersController, PlayerProfileController], providers: [CreatePlayerService, InitialRatingService, PlayerProfileService] })
export class PlayersModule {}
