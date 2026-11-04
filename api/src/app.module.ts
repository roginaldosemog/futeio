import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { AccessModule } from './modules/access/access.module';
import { PlayersModule } from './modules/players/players.module';
import { EvaluationsModule } from './modules/evaluations/evaluations.module';
import { DrawsModule } from './modules/draws/draws.module';

@Module({ imports: [HealthModule, AccessModule, PlayersModule, EvaluationsModule, DrawsModule] })
export class AppModule {}
