import { FastifyInstance } from 'fastify';
import { AuthMiddleware } from '@/modules/auth/auth.middleware';
import { AuthService } from '@/modules/auth/auth.service';
import { CvFlipController } from './cv-flip.controller';
import { CvFlipService } from './cv-flip.service';

export async function cvFlipRoutes(fastify: FastifyInstance) {
  const authService = new AuthService();
  const authMiddleware = new AuthMiddleware(authService);
  const service = new CvFlipService();
  const controller = new CvFlipController(service);

  const secured = [authMiddleware.verifyToken.bind(authMiddleware)];

  fastify.get('/check-access', {
    preHandler: secured,
    schema: {
      description: 'Lấy danh sách doanh nghiệp có thể dùng để lật CV',
      tags: ['CV Flip'],
      security: [{ bearerAuth: [] }],
    },
  }, controller.checkAccess.bind(controller));

  fastify.get('/candidates', {
    preHandler: secured,
    schema: {
      description: 'Danh sách ứng viên public cho trang lật CV',
      tags: ['CV Flip'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50 },
          keyword: { type: 'string' },
          skills: { type: 'string' },
          location: { type: 'string' },
          experience: { type: 'string' },
          education: { type: 'string' },
          salaryMin: { type: 'integer', minimum: 0 },
          salaryMax: { type: 'integer', minimum: 0 },
          workMode: { type: 'string' },
        },
      },
    },
  }, controller.listCandidates.bind(controller));

  fastify.get('/candidates/:slug', {
    preHandler: secured,
    schema: {
      description: 'Chi tiết ứng viên với logic che/mở thông tin liên hệ',
      tags: ['CV Flip'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['slug'],
        properties: {
          slug: { type: 'string' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          companyId: { type: 'string' },
        },
      },
    },
  }, controller.getCandidateDetail.bind(controller));

  fastify.post('/flip', {
    preHandler: secured,
    schema: {
      description: 'Thực hiện lật CV hoặc gửi yêu cầu lật CV',
      tags: ['CV Flip'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['companyId', 'candidateUserId'],
        properties: {
          companyId: { type: 'string' },
          candidateUserId: { type: 'string' },
        },
      },
    },
  }, controller.flipCandidate.bind(controller));

  fastify.get('/usage', {
    preHandler: secured,
    schema: {
      description: 'Lấy quota lật CV theo doanh nghiệp đã chọn',
      tags: ['CV Flip'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        required: ['companyId'],
        properties: {
          companyId: { type: 'string' },
        },
      },
    },
  }, controller.getUsage.bind(controller));

  fastify.get('/requests', {
    preHandler: secured,
    schema: {
      description: 'Danh sách yêu cầu lật CV cho ứng viên hiện tại',
      tags: ['CV Flip'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50 },
          status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'] },
        },
      },
    },
  }, controller.listMyRequests.bind(controller));

  fastify.post('/requests/:requestId/respond', {
    preHandler: secured,
    schema: {
      description: 'Ứng viên đồng ý/từ chối yêu cầu lật CV',
      tags: ['CV Flip'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['requestId'],
        properties: {
          requestId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['action'],
        properties: {
          action: { type: 'string', enum: ['approve', 'reject'] },
        },
      },
    },
  }, controller.respondRequest.bind(controller));
}
