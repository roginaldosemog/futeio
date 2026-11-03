import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ApiExceptionFilter } from './http/api-exception.filter';

export function configureApplication(app: INestApplication): void {
  const logger = new Logger('HTTP');
  app.setGlobalPrefix('api/v1');
  app.getHttpAdapter().getInstance().set('trust proxy', false);
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.use((request: Request, response: Response, next: NextFunction) => {
    const requestId = randomUUID();
    response.setHeader('Cache-Control', 'no-store');
    const start = performance.now();
    response.locals.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    response.on('finish', () => {
      logger.log({
        event: 'http_request',
        requestId,
        method: request.method,
        statusCode: response.statusCode,
        durationMs: Math.round((performance.now() - start) * 100) / 100,
      });
    });
    next();
  });
  app.useGlobalFilters(new ApiExceptionFilter());
}
