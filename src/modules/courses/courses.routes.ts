import { FastifyInstance } from 'fastify';
import { AuthMiddleware } from '@/modules/auth/auth.middleware';
import { AuthService } from '@/modules/auth/auth.service';
import { CoursesController } from '@/modules/courses/courses.controller';
import { CoursesService } from '@/modules/courses/courses.service';

export async function coursesRoutes(fastify: FastifyInstance) {
  const authService = new AuthService();
  const authMiddleware = new AuthMiddleware(authService);
  const coursesService = new CoursesService();
  const coursesController = new CoursesController(coursesService);

  const optionalAuth = [authMiddleware.optionalAuth.bind(authMiddleware)];

  fastify.get(
    '/',
    {
      preHandler: optionalAuth,
      schema: {
        description: 'Danh sách khóa học (catalog)',
        tags: ['Courses'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 48 },
            q: { type: 'string' },
          },
        },
      },
    },
    coursesController.list.bind(coursesController),
  );

  fastify.get(
    '/:slug',
    {
      preHandler: optionalAuth,
      schema: {
        description: 'Chi tiết khóa học theo slug',
        tags: ['Courses'],
        params: {
          type: 'object',
          required: ['slug'],
          properties: { slug: { type: 'string' } },
        },
      },
    },
    coursesController.getBySlug.bind(coursesController),
  );
}
