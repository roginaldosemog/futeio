import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
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
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
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
  // A 2 MiB photo expands to ~2.67 MiB in base64; the decoder applies the
  // smaller binary/dimension limits before persisting a normalized JPEG.
  (app as NestExpressApplication).useBodyParser('json', { limit: '3mb' });
  app.useGlobalFilters(new ApiExceptionFilter());
}
