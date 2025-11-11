import { FastifyInstance } from 'fastify';
import { SystemService } from './system.service';
import { SystemController } from './system.controller';
import { AuthMiddleware } from '@/modules/auth/auth.middleware';
import { AuthService } from '@/modules/auth/auth.service';

export async function systemRoutes(fastify: FastifyInstance) {
  const authService = new AuthService();
  const authMiddleware = new AuthMiddleware(authService);
  const systemService = new SystemService();
  const systemController = new SystemController(systemService);

  fastify.get('/overview', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Get system overview stats',
      tags: ['System'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                stats: {
                  type: 'object',
                  properties: {
                    users: { type: 'number' },
                    companies: { type: 'number' },
                    posts: { type: 'number' },
                    jobs: { type: 'number' },
                    applications: { type: 'number' },
                    follows: { type: 'number' },
                    jobFavorites: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, systemController.getOverview.bind(systemController));
}


