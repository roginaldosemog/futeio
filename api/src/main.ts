import 'reflect-metadata';
import { ConsoleLogger } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApplication } from './app.setup';
import type { ApiEnvironment } from './config/environment';
import { API_ENVIRONMENT } from './config/environment.module';

async function bootstrap(): Promise<void> {
  const logger = new ConsoleLogger({ json: true, colors: false });
  let app: INestApplication | undefined;

  try {
    app = await NestFactory.create(AppModule, { logger, abortOnError: false });
    configureApplication(app);
    app.enableShutdownHooks();
    const configuration = app.get<ApiEnvironment>(API_ENVIRONMENT);
    await app.listen(configuration.port, configuration.host);
  } catch {
    logger.error({
      event: 'bootstrap_failed',
      message: 'API could not start. Verify environment configuration and port availability.',
    });
    await app?.close();
    process.exitCode = 1;
  }
}

void bootstrap();
