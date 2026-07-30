import pino from 'pino';
import { config } from '@/config/env';

/**
 * Logger dùng ở các context ngoài Fastify request lifecycle (job/background worker).
 * Giữ cấu hình giống app logger để log format nhất quán.
 */
export const sharedLogger = pino(
  config.NODE_ENV === 'development'
    ? {
        level: config.LOG_LEVEL,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
      }
    : {
        level: config.LOG_LEVEL,
      }
);
