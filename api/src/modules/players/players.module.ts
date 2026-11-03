import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AccessModule } from '../access/access.module';
import { InitialRatingService } from '../evaluations/initial-rating.service';
import { CreatePlayerService } from './create-player.service';
import { PlayersController } from './players.controller';

@Module({ imports: [PrismaModule, AccessModule], controllers: [PlayersController], providers: [CreatePlayerService, InitialRatingService] })
export class PlayersModule {}
