import type { FastifyInstance, FastifyError } from 'fastify';
import { ZodError } from 'zod';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'AppError';
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, message, details);
  }

  static notFound(message: string) {
    return new AppError(404, message);
  }

  static conflict(message: string) {
    return new AppError(409, message);
  }

  static internal(message?: string) {
    return new AppError(500, message || 'Internal server error');
  }
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError | Error, request, reply) => {
    // Fastify validation errors (schema-based)
    if ('validation' in error && error.validation) {
      const validationErr = error as FastifyError;
      return reply.code(400).send({
        error: 'Validation failed',
        statusCode: 400,
        details: validationErr.validation,
      });
    }

    // AppError — typed application errors
    if (error instanceof AppError) {
      const payload: Record<string, unknown> = {
        error: error.message,
        statusCode: error.statusCode,
      };
      if (error.details !== undefined) payload.details = error.details;
      return reply.code(error.statusCode).send(payload);
    }

    // Zod validation errors
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'Validation failed',
        statusCode: 400,
        details: error.errors,
      });
    }

    // PostgreSQL unique violation
    if (error instanceof Error && (error as any)?.code === '23505') {
      return reply.code(409).send({
        error: 'Resource already exists',
        statusCode: 409,
      });
    }

    // Unknown errors — log and return generic 500
    request.log.error({ err: error, message: error.message }, 'Unhandled error');
    return reply.code(500).send({
      error: 'Internal server error',
      statusCode: 500,
    });
  });

  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({
      error: 'Route not found',
      statusCode: 404,
    });
  });
}
