import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';
import { AccessModule } from './modules/access/access.module';

@Module({ imports: [HealthModule, AccessModule] })
export class AppModule {}
