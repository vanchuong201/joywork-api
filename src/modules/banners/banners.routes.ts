import { FastifyInstance } from 'fastify';
import { AuthMiddleware } from '@/modules/auth/auth.middleware';
import { AuthService } from '@/modules/auth/auth.service';
import { BannersController } from './banners.controller';
import { BannersService } from './banners.service';

/** Public banner routes — mount at `/api/banners`. */
export async function bannersRoutes(fastify: FastifyInstance) {
  const controller = new BannersController(new BannersService());

  fastify.get(
    '/',
    {
      schema: {
        description: 'Danh sách banner public theo slot (active + trong lịch hiển thị)',
        tags: ['Banners'],
        querystring: {
          type: 'object',
          properties: {
            slot: { type: 'string', description: 'Ví dụ homepage-hero' },
          },
        },
      },
    },
    controller.listPublic.bind(controller),
  );
}

/** Admin banner routes — mount at `/api/system/banners`. */
export async function bannersAdminRoutes(fastify: FastifyInstance) {
  const authMiddleware = new AuthMiddleware(new AuthService());
  const adminPre = [
    authMiddleware.verifyToken.bind(authMiddleware),
    authMiddleware.requireAdmin.bind(authMiddleware),
  ];
  const controller = new BannersController(new BannersService());

  fastify.get(
    '/',
    {
      preHandler: adminPre,
      schema: {
        description: 'Admin: danh sách banner (filter slot)',
        tags: ['System'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            slot: { type: 'string' },
          },
        },
      },
    },
    controller.listAdmin.bind(controller),
  );

  fastify.post(
    '/',
    {
      preHandler: adminPre,
      schema: {
        description: 'Admin: tạo banner',
        tags: ['System'],
        security: [{ bearerAuth: [] }],
      },
    },
    controller.create.bind(controller),
  );

  fastify.patch(
    '/reorder',
    {
      preHandler: adminPre,
      schema: {
        description: 'Admin: sắp xếp lại banner trong slot',
        tags: ['System'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['slot', 'ids'],
          properties: {
            slot: { type: 'string' },
            ids: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    controller.reorder.bind(controller),
  );

  fastify.post(
    '/upload',
    {
      preHandler: adminPre,
      schema: {
        description: 'Admin: upload ảnh banner (base64 JSON)',
        tags: ['System'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['fileName', 'fileType', 'fileData'],
          properties: {
            fileName: { type: 'string' },
            fileType: { type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp'] },
            fileData: { type: 'string' },
          },
        },
      },
    },
    controller.upload.bind(controller),
  );

  fastify.patch(
    '/:id',
    {
      preHandler: adminPre,
      schema: {
        description: 'Admin: cập nhật banner',
        tags: ['System'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
      },
    },
    controller.update.bind(controller),
  );

  fastify.delete(
    '/:id',
    {
      preHandler: adminPre,
      schema: {
        description: 'Admin: xóa banner (hard delete)',
        tags: ['System'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
      },
    },
    controller.remove.bind(controller),
  );
}
