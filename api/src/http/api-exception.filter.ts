import { Catch, HttpException, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const oversizedBody = typeof exception === 'object' && exception !== null
      && 'type' in exception && exception.type === 'entity.too.large';
    const statusCode = exception instanceof HttpException ? exception.getStatus() : oversizedBody ? 413 : 500;
    const requestId = response.locals.requestId as string;

    let code = statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_REJECTED';
    let message = 'Request could not be processed.';
    if (statusCode === 503) {
      code = 'DATABASE_UNAVAILABLE';
      message = 'Database is temporarily unavailable.';
    } else if (statusCode === 404) {
      code = 'NOT_FOUND';
      message = 'Resource not found.';
    } else if (statusCode >= 500) {
      message = 'An unexpected error occurred.';
    }

    if (statusCode >= 500) {
      this.logger.error({ event: 'http_error', requestId, statusCode });
    }

    response.status(statusCode).json({ statusCode, code, message, requestId });
  }
}
