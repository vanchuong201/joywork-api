import { FastifyReply, FastifyRequest } from 'fastify';
import { UploadsService } from './uploads.service';
import {
  createPresignSchema,
  deleteObjectSchema,
  createProfileAvatarPresignSchema,
  uploadProfileAvatarSchema,
  uploadCompanyPostImageSchema,
  uploadCompanyLogoSchema,
  uploadCompanyCoverSchema,
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
}

