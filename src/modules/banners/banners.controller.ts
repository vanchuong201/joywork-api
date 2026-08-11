import { FastifyReply, FastifyRequest } from 'fastify';
import { BannersService } from './banners.service';
import {
  adminBannersQuerySchema,
  bannerIdParamSchema,
  bannerUploadSchema,
  createBannerSchema,
  publicBannersQuerySchema,
  reorderBannersSchema,
  updateBannerSchema,
} from './banners.schema';

export class BannersController {
  constructor(private bannersService: BannersService) {}

  async listPublic(request: FastifyRequest, reply: FastifyReply) {
    const query = publicBannersQuerySchema.parse(request.query);
    const data = await this.bannersService.listPublicBySlot(query.slot);
    return reply.send({ data });
  }

  async listAdmin(request: FastifyRequest, reply: FastifyReply) {
    const query = adminBannersQuerySchema.parse(request.query);
    const data = await this.bannersService.listForAdmin(query.slot);
    return reply.send({ data });
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const body = createBannerSchema.parse(request.body);
    const data = await this.bannersService.create(body);
    return reply.status(201).send({ data });
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const params = bannerIdParamSchema.parse(request.params);
    const body = updateBannerSchema.parse(request.body);
    const data = await this.bannersService.update(params.id, body);
    return reply.send({ data });
  }

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const params = bannerIdParamSchema.parse(request.params);
    const data = await this.bannersService.remove(params.id);
    return reply.send({ data });
  }

  async reorder(request: FastifyRequest, reply: FastifyReply) {
    const body = reorderBannersSchema.parse(request.body);
    const data = await this.bannersService.reorder(body.slot, body.ids);
    return reply.send({ data });
  }

  async upload(request: FastifyRequest, reply: FastifyReply) {
    const body = bannerUploadSchema.parse(request.body);
    const data = await this.bannersService.uploadImage(body);
    return reply.send({ data });
  }
}
