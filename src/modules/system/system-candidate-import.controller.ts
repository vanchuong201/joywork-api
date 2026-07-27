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

  private async readMultipartCommit(request: FastifyRequest): Promise<{
    fileName: string;
    mime: string;
    buffer: Buffer;
    sendEmail: boolean;
  }> {
    let fileName = '';
    let mime = '';
    let buffer: Buffer | null = null;
    let sendEmail = false;

    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === 'file') {
        if (!CANDIDATE_IMPORT_MIME_TYPES.includes(part.mimetype as (typeof CANDIDATE_IMPORT_MIME_TYPES)[number])) {
          throw new AppError('Chỉ chấp nhận file CSV hoặc Excel (.xlsx)', 400, 'INVALID_FILE_TYPE');
        }
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(chunk);
        }
        buffer = Buffer.concat(chunks);
        fileName = part.filename;
        mime = part.mimetype;
      } else if (part.type === 'field' && part.fieldname === 'sendEmail') {
        const value = String(part.value).trim().toLowerCase();
        sendEmail = value === 'true' || value === '1' || value === 'yes';
      }
    }

    if (!buffer) {
      throw new AppError('Vui lòng upload file CSV hoặc Excel', 400, 'FILE_REQUIRED');
    }
    if (buffer.length === 0) {
      throw new AppError('File rỗng', 400, 'EMPTY_FILE');
    }

    return { fileName, mime, buffer, sendEmail };
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

    const { fileName, mime, buffer, sendEmail } = await this.readMultipartCommit(request);
    const result = await this.service.commit(buffer, fileName, mime, userId, { sendEmail });
    return reply.send({ data: result });
  }

  async resend(request: FastifyRequest, reply: FastifyReply) {
    const parsed = candidateImportResendSchema.parse(request.body);
    const result = await this.service.adminResend(parsed.recordId);
    return reply.send({ data: result });
  }

  async createActivationLink(request: FastifyRequest, reply: FastifyReply) {
    const recordId = (request.params as { recordId: string }).recordId;
    const result = await this.service.createActivationLink(recordId);
    return reply.send({ data: result });
  }

  async listBatches(request: FastifyRequest, reply: FastifyReply) {
    const limitRaw = (request.query as { limit?: string })?.limit;
    const limit = limitRaw ? Number(limitRaw) : 20;
    const batches = await this.service.listBatches(Number.isFinite(limit) ? limit : 20);
    return reply.send({ data: { batches } });
  }

  async getBatch(request: FastifyRequest, reply: FastifyReply) {
    const batchId = (request.params as { batchId: string }).batchId;
    const detail = await this.service.getBatchDetail(batchId);
    return reply.send({ data: detail });
  }

  async exportBatch(request: FastifyRequest, reply: FastifyReply) {
    const batchId = (request.params as { batchId: string }).batchId;
    const csv = await this.service.exportBatchCsv(batchId);
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="candidate-import-${batchId}.csv"`)
      .send(csv);
  }
}
