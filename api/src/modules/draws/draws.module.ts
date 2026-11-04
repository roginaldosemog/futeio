import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AccessModule } from '../access/access.module';
import { DrawsController } from './draws.controller';
import { DrawsService } from './draws.service';

@Module({ imports: [PrismaModule, AccessModule], controllers: [DrawsController], providers: [DrawsService] })
export class DrawsModule {}
