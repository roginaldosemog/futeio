import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface HealthStatus {
  status: 'ok';
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async readiness(): Promise<HealthStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException({
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database is temporarily unavailable.',
      });
    }
  }
}
