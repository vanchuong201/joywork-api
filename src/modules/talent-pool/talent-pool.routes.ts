import { FastifyInstance } from 'fastify';
import { TalentPoolService } from './talent-pool.service';
import { TalentPoolController } from './talent-pool.controller';
import { AuthMiddleware } from '@/modules/auth/auth.middleware';
import { AuthService } from '@/modules/auth/auth.service';

export async function talentPoolRoutes(fastify: FastifyInstance) {
  const authService = new AuthService();
  const authMiddleware = new AuthMiddleware(authService);
  const service = new TalentPoolService();
  const controller = new TalentPoolController(service);

  // Candidate: get my talent pool status
  fastify.get('/me', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Trạng thái Talent Pool của tôi (membership + request gần nhất)',
      tags: ['Talent Pool'],
      security: [{ bearerAuth: [] }],
      response: {
        200: { type: 'object', properties: { data: { type: 'object' } } },
      },
    },
  }, controller.getMyStatus.bind(controller));

  // Candidate: create join request
  fastify.post('/requests', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Gửi yêu cầu tham gia Talent Pool',
      tags: ['Talent Pool'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          message: { type: 'string', maxLength: 2000 },
        },
      },
      response: {
        201: { type: 'object', properties: { data: { type: 'object' } } },
      },
    },
  }, controller.createRequest.bind(controller));

  // Company: check access
  fastify.get('/access', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Kiểm tra quyền truy cập Talent Pool (premium check)',
      tags: ['Talent Pool'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                hasAccess: { type: 'boolean' },
                reason: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, controller.checkAccess.bind(controller));

  // Company: list talent pool candidates
  fastify.get('/candidates', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Danh sách ứng viên Talent Pool (yêu cầu premium)',
      tags: ['Talent Pool'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          q: { type: 'string' },
          location: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              additionalProperties: true,
              properties: {
                candidates: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: true,
                  },
                },
                pagination: {
                  type: 'object',
                  properties: {
                    page: { type: 'number' },
                    limit: { type: 'number' },
                    total: { type: 'number' },
                    totalPages: { type: 'number' },
                  },
                  additionalProperties: true,
                },
              },
            },
          },
        },
      },
    },
  }, controller.listCandidates.bind(controller));
}
