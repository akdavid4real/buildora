import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';

    // Handle NestJS HttpExceptions
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'object' ? res : { statusCode: status, message: res };
    }
    // Handle Prisma Known Request Errors
    else if (
      exception &&
      typeof exception === 'object' &&
      'code' in exception &&
      typeof (exception as { code: unknown }).code === 'string'
    ) {
      const prismaError = exception as { code: string; meta?: Record<string, unknown> };

      if (prismaError.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = {
          statusCode: HttpStatus.CONFLICT,
          message: 'A resource with this unique identifier already exists.',
          error: 'Conflict',
        };
      } else if (prismaError.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Resource not found.',
          error: 'Not Found',
        };
      } else {
        this.logger.error(`Prisma error ${prismaError.code} on ${request.method} ${request.url}`);
        message = {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database operation failed.',
          error: 'Internal Server Error',
        };
      }
    }
    // Generic unhandled exceptions
    else {
      const err = exception instanceof Error ? exception.message : 'Unknown error';
      this.logger.error(`Unhandled exception on ${request.method} ${request.url}: ${err}`);
      message = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      };
    }

    // Ensure status code in JSON matches HTTP status
    const jsonBody =
      typeof message === 'object'
        ? { timestamp: new Date().toISOString(), path: request.url, ...message }
        : {
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message,
          };

    response.status(status).json(jsonBody);
  }
}
