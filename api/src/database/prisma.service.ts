import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import type { ApiEnvironment } from '../config/environment';
import { API_ENVIRONMENT } from '../config/environment.module';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(API_ENVIRONMENT) configuration: ApiEnvironment) {
    super({
      adapter: new PrismaPg({
        connectionString: configuration.databaseUrl,
        // A cold TLS/OS connection needs more headroom than an established
        // query. Keep the query deadline independent and bounded below.
        connectionTimeoutMillis: 5000,
        query_timeout: 1000,
        max: 5,
      }),
      errorFormat: 'minimal',
      log: [],
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
