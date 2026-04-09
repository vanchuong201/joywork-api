import { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '@/shared/errors/errorHandler';
import type { AuthenticatedRequest } from '@/modules/auth/auth.middleware';
import { UploadsService } from './uploads.service';
import {
  createPresignSchema,
  deleteObjectSchema,
  createProfileAvatarPresignSchema,
  uploadProfileAvatarSchema,
  uploadCompanyPostImageSchema,
  uploadCompanyLogoSchema,
  uploadCompanyCoverSchema,
  uploadProfileCVSchema,
  uploadCompanyVerificationSchema,
  createCourseAssetPresignSchema,
} from './uploads.schema';

export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  async createPresign(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const payload = createPresignSchema.parse(request.body);

    const data = await this.uploadsService.createPresignedUrl(userId, payload);

    return reply.status(201).send({ data });
  }

  async createProfileAvatarPresign(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const payload = createProfileAvatarPresignSchema.parse(request.body);

    const data = await this.uploadsService.createProfileAvatarPresignedUrl(userId, payload);

    return reply.status(201).send({ data });
  }

  async deleteObject(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const payload = deleteObjectSchema.parse(request.body);

    await this.uploadsService.deleteObject(userId, payload);

    return reply.status(200).send({ data: { success: true } });
  }

  async uploadProfileAvatar(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const payload = uploadProfileAvatarSchema.parse(request.body);

    const data = await this.uploadsService.uploadProfileAvatar(userId, payload);

    return reply.status(201).send({ data });
  }

  async uploadCompanyPostImage(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const payload = uploadCompanyPostImageSchema.parse(request.body);

    const data = await this.uploadsService.uploadCompanyPostImage(userId, payload);

    return reply.status(201).send({ data });
  }

  async uploadCompanyLogo(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const payload = uploadCompanyLogoSchema.parse(request.body);

    const data = await this.uploadsService.uploadCompanyLogo(userId, payload);

    return reply.status(201).send({ data });
  }

  async uploadCompanyCover(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const payload = uploadCompanyCoverSchema.parse(request.body);

    const data = await this.uploadsService.uploadCompanyCover(userId, payload);

    return reply.status(201).send({ data });
  }

  async uploadProfileCV(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const payload = uploadProfileCVSchema.parse(request.body);

    const data = await this.uploadsService.uploadProfileCV(userId, payload);

    return reply.status(201).send({ data });
  }

  async uploadCompanyVerification(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const payload = uploadCompanyVerificationSchema.parse(request.body);

    const data = await this.uploadsService.uploadCompanyVerificationDocument(userId, payload);

    return reply.status(201).send({ data });
  }

  async getCompanyVerificationDownload(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { companyId } = request.query as { companyId: string };
    const data = await this.uploadsService.getCompanyVerificationDownloadUrl(userId, companyId);
    return reply.send({ data });
  }

  async createCourseAssetPresign(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId as string;
    const payload = createCourseAssetPresignSchema.parse(request.body);
    const data = await this.uploadsService.createCourseAssetPresignUrl(userId, payload);
    return reply.status(201).send({ data });
  }

  /** Multipart: field `file` + query `kind=thumbnail|video|attachment` — upload qua API, không PUT trực tiếp S3. */
  async uploadCourseAssetMultipart(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as AuthenticatedRequest).user?.userId;
    if (!userId) {
      throw new AppError('Vui lòng đăng nhập', 401, 'AUTH_REQUIRED');
    }
    const kind = (request.query as { kind?: string }).kind;
    if (kind !== 'thumbnail' && kind !== 'video' && kind !== 'attachment') {
      throw new AppError('Tham số kind không hợp lệ', 400, 'VALIDATION_ERROR');
    }
    const data = await request.file();
    if (!data) {
      throw new AppError('Vui lòng chọn tệp', 400, 'FILE_REQUIRED');
    }
    const buffer = await data.toBuffer();
    const fileType = data.mimetype || 'application/octet-stream';
    const fileName = data.filename || 'upload';
    const result = await this.uploadsService.uploadCourseAssetAdmin(userId, {
      kind,
      fileName,
      fileType,
      buffer,
    });
    return reply.status(201).send({ data: result });
  }
}

