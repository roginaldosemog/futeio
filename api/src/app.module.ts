import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { AccessModule } from './modules/access/access.module';
import { PlayersModule } from './modules/players/players.module';

@Module({ imports: [HealthModule, AccessModule, PlayersModule] })
export class AppModule {}
