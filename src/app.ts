import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import cookie from '@fastify/cookie';

import { config } from '@/config/env';
import { errorHandler } from '@/shared/errors/errorHandler';
import { authRoutes } from '@/modules/auth/auth.routes';
import { usersRoutes } from '@/modules/users/users.routes';
import { companiesRoutes } from '@/modules/companies/companies.routes';
import { postsRoutes } from '@/modules/posts/posts.routes';
import { jobsRoutes } from '@/modules/jobs/jobs.routes';
import { inboxRoutes } from '@/modules/inbox/inbox.routes';
import { systemRoutes } from '@/modules/system/system.routes';
import { uploadsRoutes } from '@/modules/uploads/uploads.routes';
import { ticketsRoutes } from '@/modules/tickets/tickets.routes';
import notificationsRoutes from '@/modules/notifications/notifications.routes';
import { hashtagsRoutes } from '@/modules/hashtags/hashtags.routes';
import { talentPoolRoutes } from '@/modules/talent-pool/talent-pool.routes';

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
    bodyLimit: 16 * 1024 * 1024, // allow up to 16MB payloads (base64 uploads)
    logger: config.NODE_ENV === 'development' ? {
      level: config.LOG_LEVEL,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    } : {
      level: config.LOG_LEVEL,
    },
  });

  // Register plugins
  await app.register(cookie);

  const allowedOrigins = new Set<string>([config.FRONTEND_ORIGIN]);
  if (config.ADMIN_CP_ORIGIN) {
    allowedOrigins.add(config.ADMIN_CP_ORIGIN);
  }

  const isDevelopmentLocalOrigin = (origin: string): boolean => {
    if (config.NODE_ENV !== 'development') return false;

    try {
      const parsed = new URL(origin);
      if (!['http:', 'https:'].includes(parsed.protocol)) return false;

      const hostname = parsed.hostname;
      const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(hostname);
      const is192Range = /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname);
      const is10Range = /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
      const is172Range = /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);

      return isLoopback || is192Range || is10Range || is172Range;
    } catch {
      return false;
    }
  };
  
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return cb(null, true);
      
      // Allow configured frontend origin and local/LAN origins in development.
      if (allowedOrigins.has(origin) || isDevelopmentLocalOrigin(origin)) {
        return cb(null, true);
      }
      
      // Reject other origins
      return cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Authorization'],
  });

  await app.register(helmet, {
    contentSecurityPolicy: false, // Disable CSP for Swagger UI
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Swagger documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'JoyWork API',
        description: 'API documentation for JoyWork platform',
        version: '1.0.0',
      },
      servers: [
        {
          url: config.API_PUBLIC_URL,
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    uiHooks: {
      onRequest: function (_request, _reply, next) {
        next();
      },
      preHandler: function (_request, _reply, next) {
        next();
      },
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
    transformSpecification: (swaggerObject, _request, _reply) => {
      return swaggerObject;
    },
    transformSpecificationClone: true,
  });

  // Error handler
  app.setErrorHandler(errorHandler);

  // Basic routes
  app.get('/', async () => {
    return {
      name: 'JoyWork API',
      status: 'running',
      docs: '/docs',
      health: '/health',
      timestamp: new Date().toISOString(),
    };
  });

  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(usersRoutes, { prefix: '/api/users' });
  await app.register(companiesRoutes, { prefix: '/api/companies' });
  await app.register(postsRoutes, { prefix: '/api/posts' });
  await app.register(jobsRoutes, { prefix: '/api/jobs' });
  await app.register(inboxRoutes, { prefix: '/api/inbox' });
  await app.register(systemRoutes, { prefix: '/api/system' });
  await app.register(uploadsRoutes, { prefix: '/api/uploads' });
  await app.register(ticketsRoutes, { prefix: '/api/tickets' });
  await app.register(notificationsRoutes, { prefix: '/api/notifications' });
  await app.register(hashtagsRoutes, { prefix: '/api/hashtags' });
  await app.register(talentPoolRoutes, { prefix: '/api/talent-pool' });

  return app;
}
