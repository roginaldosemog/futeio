import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import type { HealthStatus } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('live')
  liveness(): HealthStatus {
    return { status: 'ok' };
  }

  @Get('ready')
  readiness(): Promise<HealthStatus> {
    return this.health.readiness();
  }
}
