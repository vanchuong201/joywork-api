import { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthenticatedRequest } from '@/modules/auth/auth.middleware';
import { AppError } from '@/shared/errors/errorHandler';
import {
  CANDIDATE_IMPORT_MIME_TYPES,
  candidateImportResendSchema,
} from './system-candidate-import.schema';
import { SystemCandidateImportService } from './system-candidate-import.service';

export class SystemCandidateImportController {
  constructor(private readonly service: SystemCandidateImportService) {}

  private async readMultipartFile(request: FastifyRequest): Promise<{
    fileName: string;
    mime: string;
    buffer: Buffer;
  }> {
    const file = await request.file();
    if (!file) {
      throw new AppError('Vui lòng upload file CSV hoặc Excel', 400, 'FILE_REQUIRED');
    }

    if (!CANDIDATE_IMPORT_MIME_TYPES.includes(file.mimetype as (typeof CANDIDATE_IMPORT_MIME_TYPES)[number])) {
      throw new AppError('Chỉ chấp nhận file CSV hoặc Excel (.xlsx)', 400, 'INVALID_FILE_TYPE');
    }

    const chunks: Buffer[] = [];
    for await (const chunk of file.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    if (buffer.length === 0) {
      throw new AppError('File rỗng', 400, 'EMPTY_FILE');
    }

    return {
      fileName: file.filename,
      mime: file.mimetype,
      buffer,
    };
  }

  async dryRun(request: FastifyRequest, reply: FastifyReply) {
    const { fileName, mime, buffer } = await this.readMultipartFile(request);
    const report = await this.service.dryRun(buffer, fileName, mime);
    return reply.send({ data: { report } });
  }

  async commit(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as AuthenticatedRequest).user?.userId;
    if (!userId) {
      throw new AppError('Vui lòng đăng nhập', 401, 'AUTH_REQUIRED');
    }

    const { fileName, mime, buffer } = await this.readMultipartFile(request);
    const result = await this.service.commit(buffer, fileName, mime, userId);
    return reply.send({ data: result });
  }

  async resend(request: FastifyRequest, reply: FastifyReply) {
    const parsed = candidateImportResendSchema.parse(request.body);
    const result = await this.service.adminResend(parsed.recordId);
    return reply.send({ data: result });
  }
}
