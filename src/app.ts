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
  
  await app.register(cors, {
    origin: config.FRONTEND_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
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

  // Health check
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

  return app;
}
