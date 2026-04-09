import { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '@/shared/errors/errorHandler';
import { CourseAdminService } from '@/modules/courses/course-admin.service';
import {
  adminCourseCreateSchema,
  adminCoursePatchSchema,
  adminCoursesQuerySchema,
  adminLessonAttachmentCreateSchema,
  adminLessonAttachmentPatchSchema,
  adminLessonCreateSchema,
  adminLessonPatchSchema,
  adminLessonVideoCreateSchema,
  adminLessonVideoPatchSchema,
  adminCourseEnrollmentCreateSchema,
  adminReorderLessonsSchema,
} from '@/modules/courses/course-admin.schema';

export class CourseAdminController {
  constructor(private readonly service: CourseAdminService) {}

  async list(request: FastifyRequest, reply: FastifyReply) {
    const parsed = adminCoursesQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError('Tham số không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const data = await this.service.listForAdmin(parsed.data);
    return reply.send({ data });
  }

  async getOne(request: FastifyRequest, reply: FastifyReply) {
    const { courseId } = request.params as { courseId: string };
    const course = await this.service.getOneForAdmin(courseId);
    return reply.send({ data: { course } });
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const parsed = adminCourseCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError('Dữ liệu không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const course = await this.service.createCourse(parsed.data);
    return reply.status(201).send({ data: { course } });
  }

  async patch(request: FastifyRequest, reply: FastifyReply) {
    const { courseId } = request.params as { courseId: string };
    const parsed = adminCoursePatchSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError('Dữ liệu không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const course = await this.service.patchCourse(courseId, parsed.data);
    return reply.send({ data: { course } });
  }

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { courseId } = request.params as { courseId: string };
    const data = await this.service.deleteCourse(courseId);
    return reply.send({ data });
  }

  async reorderLessons(request: FastifyRequest, reply: FastifyReply) {
    const { courseId } = request.params as { courseId: string };
    const parsed = adminReorderLessonsSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError('Dữ liệu không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const course = await this.service.reorderLessons(courseId, parsed.data);
    return reply.send({ data: { course } });
  }

  async createLesson(request: FastifyRequest, reply: FastifyReply) {
    const { courseId } = request.params as { courseId: string };
    const parsed = adminLessonCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError('Dữ liệu không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const lesson = await this.service.createLesson(courseId, parsed.data);
    return reply.status(201).send({ data: { lesson } });
  }

  async patchLesson(request: FastifyRequest, reply: FastifyReply) {
    const { courseId, lessonId } = request.params as { courseId: string; lessonId: string };
    const parsed = adminLessonPatchSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError('Dữ liệu không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const lesson = await this.service.patchLesson(courseId, lessonId, parsed.data);
    return reply.send({ data: { lesson } });
  }

  async deleteLesson(request: FastifyRequest, reply: FastifyReply) {
    const { courseId, lessonId } = request.params as { courseId: string; lessonId: string };
    const data = await this.service.deleteLesson(courseId, lessonId);
    return reply.send({ data });
  }

  async createVideo(request: FastifyRequest, reply: FastifyReply) {
    const { courseId, lessonId } = request.params as { courseId: string; lessonId: string };
    const parsed = adminLessonVideoCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError('Dữ liệu không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const video = await this.service.createVideo(courseId, lessonId, parsed.data);
    return reply.status(201).send({ data: { video } });
  }

  async patchVideo(request: FastifyRequest, reply: FastifyReply) {
    const { courseId, lessonId, videoId } = request.params as {
      courseId: string;
      lessonId: string;
      videoId: string;
    };
    const parsed = adminLessonVideoPatchSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError('Dữ liệu không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const video = await this.service.patchVideo(courseId, lessonId, videoId, parsed.data);
    return reply.send({ data: { video } });
  }

  async deleteVideo(request: FastifyRequest, reply: FastifyReply) {
    const { courseId, lessonId, videoId } = request.params as {
      courseId: string;
      lessonId: string;
      videoId: string;
    };
    const data = await this.service.deleteVideo(courseId, lessonId, videoId);
    return reply.send({ data });
  }

  async createAttachment(request: FastifyRequest, reply: FastifyReply) {
    const { courseId, lessonId } = request.params as { courseId: string; lessonId: string };
    const parsed = adminLessonAttachmentCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError('Dữ liệu không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const attachment = await this.service.createAttachment(courseId, lessonId, parsed.data);
    return reply.status(201).send({ data: { attachment } });
  }

  async patchAttachment(request: FastifyRequest, reply: FastifyReply) {
    const { courseId, lessonId, attachmentId } = request.params as {
      courseId: string;
      lessonId: string;
      attachmentId: string;
    };
    const parsed = adminLessonAttachmentPatchSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError('Dữ liệu không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const attachment = await this.service.patchAttachment(courseId, lessonId, attachmentId, parsed.data);
    return reply.send({ data: { attachment } });
  }

  async deleteAttachment(request: FastifyRequest, reply: FastifyReply) {
    const { courseId, lessonId, attachmentId } = request.params as {
      courseId: string;
      lessonId: string;
      attachmentId: string;
    };
    const data = await this.service.deleteAttachment(courseId, lessonId, attachmentId);
    return reply.send({ data });
  }

  async listEnrollments(request: FastifyRequest, reply: FastifyReply) {
    const { courseId } = request.params as { courseId: string };
    const enrollments = await this.service.listEnrollments(courseId);
    return reply.send({ data: { enrollments } });
  }

  async addEnrollment(request: FastifyRequest, reply: FastifyReply) {
    const { courseId } = request.params as { courseId: string };
    const parsed = adminCourseEnrollmentCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError('Dữ liệu không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }
    const enrollment = await this.service.addEnrollment(courseId, parsed.data);
    return reply.status(201).send({ data: { enrollment } });
  }

  async removeEnrollment(request: FastifyRequest, reply: FastifyReply) {
    const { courseId, enrollmentId } = request.params as { courseId: string; enrollmentId: string };
    const data = await this.service.removeEnrollment(courseId, enrollmentId);
    return reply.send({ data });
  }
}
