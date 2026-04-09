import { FastifyReply } from 'fastify';
import { AppError } from '@/shared/errors/errorHandler';
import type { AuthenticatedRequest } from '@/modules/auth/auth.middleware';
import { CoursesService } from '@/modules/courses/courses.service';
import { courseSlugParamsSchema, coursesListQuerySchema } from '@/modules/courses/courses.schema';

export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  async list(request: AuthenticatedRequest, reply: FastifyReply) {
    const parsed = coursesListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError('Tham số không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const userId = request.user?.userId;
    const data = await this.coursesService.listCourses(userId, parsed.data);
    return reply.send({ data });
  }

  async getBySlug(request: AuthenticatedRequest, reply: FastifyReply) {
    const parsed = courseSlugParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      throw new AppError('Tham số không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const userId = request.user?.userId;
    const data = await this.coursesService.getCourseBySlug(parsed.data.slug, userId);
    return reply.send({ data });
  }
}
