import { FastifyInstance } from 'fastify';
import { AuthMiddleware } from '@/modules/auth/auth.middleware';
import { AuthService } from '@/modules/auth/auth.service';
import { CvExportsController } from './cv-exports.controller';
import { CvExportsService } from './cv-exports.service';

export async function cvExportsRoutes(fastify: FastifyInstance) {
  const authService = new AuthService();
  const authMiddleware = new AuthMiddleware(authService);
  const service = new CvExportsService();
  const controller = new CvExportsController(service);

  const secured = [authMiddleware.verifyToken.bind(authMiddleware)];

  fastify.get(
    '/me/pdf',
    {
      preHandler: secured,
      schema: {
        description: 'Ứng viên xuất CV PDF của chính mình',
        tags: ['CV Export'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            description: 'PDF file',
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
    controller.exportOwnPdf.bind(controller)
  );

  fastify.get(
    '/candidates/:slug/pdf',
    {
      preHandler: secured,
      schema: {
        description:
          'Doanh nghiệp xuất CV PDF theo quyền hiện tại (vẫn cho tải khi chưa mở CV, thông tin nhạy cảm sẽ bị ẩn).',
        tags: ['CV Export'],
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
          required: ['companyId'],
          properties: {
            companyId: { type: 'string' },
          },
        },
        response: {
          200: {
            description: 'PDF file',
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
    controller.exportCandidatePdf.bind(controller)
  );
}
