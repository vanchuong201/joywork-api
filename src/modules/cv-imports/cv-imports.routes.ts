import { FastifyInstance } from 'fastify';
import { AuthMiddleware } from '@/modules/auth/auth.middleware';
import { AuthService } from '@/modules/auth/auth.service';
import { CV_IMPORT_SECTIONS } from './cv-imports.schema';
import { CvImportsController } from './cv-imports.controller';
import { CvImportsService } from './cv-imports.service';

export async function cvImportsRoutes(fastify: FastifyInstance) {
  const authService = new AuthService();
  const authMiddleware = new AuthMiddleware(authService);
  const service = new CvImportsService();
  const controller = new CvImportsController(service);

  const secured = [authMiddleware.verifyToken.bind(authMiddleware)];

  fastify.post(
    '/',
    {
      preHandler: secured,
      schema: {
        description: 'Tạo phiên import CV: tải file đã upload, gọi AI parse, trả parsed JSON cho preview.',
        tags: ['CV Import'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            sourceKey: { type: 'string' },
            cvUrl: { type: 'string' },
          },
        },
      },
    },
    controller.createImport.bind(controller)
  );

  fastify.get(
    '/:jobId',
    {
      preHandler: secured,
      schema: {
        description: 'Lấy trạng thái phiên import CV của chính ứng viên.',
        tags: ['CV Import'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['jobId'],
          properties: {
            jobId: { type: 'string' },
          },
        },
      },
    },
    controller.getImport.bind(controller)
  );

  fastify.post(
    '/:jobId/apply',
    {
      preHandler: secured,
      schema: {
        description: 'Áp dụng phiên import CV vào hồ sơ. Chọn mode và các section muốn cập nhật.',
        tags: ['CV Import'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['jobId'],
          properties: {
            jobId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['mode', 'sections'],
          properties: {
            mode: { type: 'string', enum: ['fill_missing', 'overwrite'] },
            sections: {
              type: 'array',
              items: { type: 'string', enum: [...CV_IMPORT_SECTIONS] },
              minItems: 1,
            },
          },
        },
      },
    },
    controller.applyImport.bind(controller)
  );
}
