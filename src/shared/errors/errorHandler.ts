import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'AppError';
  }
}

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  const { log } = request.server;

  // Log error
  log.error({
    error: error.message,
    stack: error.stack,
    url: request.url,
    method: request.method,
    ip: request.ip,
  }, 'Request error');

  // Handle different error types
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }

  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: error.issues,
      },
    });
  }

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return reply.status(409).send({
          error: {
            code: 'DUPLICATE_ENTRY',
            message: 'A record with this information already exists',
          },
        });
      case 'P2025':
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Record not found',
          },
        });
      default:
        return reply.status(500).send({
          error: {
            code: 'DATABASE_ERROR',
            message: 'Database operation failed',
          },
        });
    }
  }

  // Handle Fastify validation errors
  if (error.validation) {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.validation,
      },
    });
  }

  // Default error response
  const statusCode = error.statusCode || 500;
  const code = statusCode === 500 ? 'INTERNAL_ERROR' : 'UNKNOWN_ERROR';

  return reply.status(statusCode).send({
    error: {
      code,
      message: statusCode === 500 ? 'Internal server error' : error.message,
    },
  });
}
