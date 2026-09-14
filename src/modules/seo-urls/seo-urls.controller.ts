import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '@/shared/errors/errorHandler';
import { SeoUrlsImportService } from './seo-urls-import.service';
import { SeoUrlsService } from './seo-urls.service';
import {
  adminListQuerySchema,
  bulkIdsSchema,
  createSeoUrlSchema,
  idParamSchema,
  previewSchema,
  publicListQuerySchema,
  SEO_IMPORT_MIME_TYPES,
  updateSeoUrlSchema,
} from './seo-urls.schema';

export class SeoUrlsController {
  constructor(
    private readonly service: SeoUrlsService,
    private readonly importService: SeoUrlsImportService,
  ) {}

  private async readMultipartFile(request: FastifyRequest): Promise<{ fileName: string; mime: string; buffer: Buffer }> {
    const file = await request.file();
    if (!file) {
      throw new AppError('Vui lòng upload file Excel (.xlsx)', 400, 'FILE_REQUIRED');
    }
    if (!SEO_IMPORT_MIME_TYPES.includes(file.mimetype as (typeof SEO_IMPORT_MIME_TYPES)[number])) {
      throw new AppError('Chỉ chấp nhận file Excel (.xlsx)', 400, 'INVALID_FILE_TYPE');
    }

    const chunks: Buffer[] = [];
    for await (const chunk of file.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    if (buffer.length === 0) {
      throw new AppError('File rỗng', 400, 'EMPTY_FILE');
    }

    return { fileName: file.filename, mime: file.mimetype, buffer };
  }

  async resolvePublic(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = request.params as { slug: string };
    const page = await this.service.resolvePublished(`/jobs/${slug}`);
    return reply.send({ data: { page } });
  }

  async listPublic(request: FastifyRequest, reply: FastifyReply) {
    const query = publicListQuerySchema.parse(request.query);
    const pages = await this.service.listPublished(query.includeEmpty);
    return reply.send({ data: { pages } });
  }

  async listAdmin(request: FastifyRequest, reply: FastifyReply) {
    const query = adminListQuerySchema.parse(request.query);
    const result = await this.service.listAdmin(query);
    return reply.send({ data: result });
  }

  async preview(request: FastifyRequest, reply: FastifyReply) {
    const input = previewSchema.parse(request.body);
    const preview = await this.service.preview(input);
    return reply.send({ data: { preview } });
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const input = createSeoUrlSchema.parse(request.body);
    const page = await this.service.create(input);
    return reply.status(201).send({ data: { page } });
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    const input = updateSeoUrlSchema.parse(request.body);
    const page = await this.service.update(id, input);
    return reply.send({ data: { page } });
  }

  async publish(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    const page = await this.service.setStatus(id, 'PUBLISHED');
    return reply.send({ data: { page } });
  }

  async unpublish(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    const page = await this.service.setStatus(id, 'DRAFT');
    return reply.send({ data: { page } });
  }

  async setCanonical(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    const page = await this.service.setCanonical(id);
    return reply.send({ data: { page } });
  }

  async archive(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    const page = await this.service.setStatus(id, 'ARCHIVED');
    return reply.send({ data: { page } });
  }

  async bulkPublish(request: FastifyRequest, reply: FastifyReply) {
    const { ids } = bulkIdsSchema.parse(request.body);
    const result = await this.service.bulkPublish(ids);
    return reply.send({ data: result });
  }

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    const result = await this.service.remove(id);
    return reply.send({ data: result });
  }

  async importDryRun(request: FastifyRequest, reply: FastifyReply) {
    const { fileName, mime, buffer } = await this.readMultipartFile(request);
    const report = await this.importService.dryRun(buffer, fileName, mime);
    return reply.send({ data: { report } });
  }

  async importCommit(request: FastifyRequest, reply: FastifyReply) {
    const { fileName, mime, buffer } = await this.readMultipartFile(request);
    const report = await this.importService.commit(buffer, fileName, mime);
    return reply.send({ data: { report } });
  }
}
