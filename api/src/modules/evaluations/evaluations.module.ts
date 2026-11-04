import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AccessModule } from '../access/access.module';
import { EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './evaluations.service';

@Module({ imports: [PrismaModule, AccessModule], controllers: [EvaluationsController], providers: [EvaluationsService] })
export class EvaluationsModule {}
