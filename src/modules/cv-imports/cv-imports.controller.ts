import type { FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from '@/modules/auth/auth.middleware';
import { AppError } from '@/shared/errors/errorHandler';
import {
  applyCvImportSchema,
  createCvImportSchema,
  type ParsedCv,
} from './cv-imports.schema';
import { CvImportsService } from './cv-imports.service';

interface JobLike {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | 'APPLIED';
  fileName: string | null;
  fileType: string | null;
  sourceCvUrl: string | null;
  confidence: number | null;
  warnings: unknown;
  parsedData: unknown;
  applyMode: string | null;
  appliedSections: string[];
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  appliedAt: Date | null;
}

function serializeJob(job: JobLike) {
  return {
    id: job.id,
    status: job.status,
    fileName: job.fileName,
    fileType: job.fileType,
    sourceCvUrl: job.sourceCvUrl,
    confidence: job.confidence,
    warnings: Array.isArray(job.warnings) ? job.warnings : [],
    parsedData: (job.parsedData as ParsedCv | null) ?? null,
    applyMode: job.applyMode,
    appliedSections: job.appliedSections ?? [],
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    appliedAt: job.appliedAt ? job.appliedAt.toISOString() : null,
  };
}

export class CvImportsController {
  constructor(private readonly service: CvImportsService) {}

  private getUserId(request: AuthenticatedRequest): string {
    const userId = request.user?.userId;
    if (!userId) {
      throw new AppError('Vui lòng đăng nhập', 401, 'AUTH_REQUIRED');
    }
    return userId;
  }

  async createImport(request: AuthenticatedRequest, reply: FastifyReply) {
    const userId = this.getUserId(request);
    const parsed = createCvImportSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError('Dữ liệu không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }

    const job = await this.service.createImport(userId, parsed.data);
    return reply.send({ data: { job: serializeJob(job as unknown as JobLike) } });
  }

  async getImport(request: AuthenticatedRequest, reply: FastifyReply) {
    const userId = this.getUserId(request);
    const { jobId } = request.params as { jobId: string };
    const job = await this.service.getImport(userId, jobId);
    return reply.send({ data: { job: serializeJob(job as unknown as JobLike) } });
  }

  async applyImport(request: AuthenticatedRequest, reply: FastifyReply) {
    const userId = this.getUserId(request);
    const { jobId } = request.params as { jobId: string };
    const parsed = applyCvImportSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError('Dữ liệu không hợp lệ', 400, 'VALIDATION_ERROR', parsed.error.flatten());
    }

    const job = await this.service.applyImport(userId, jobId, parsed.data);
    return reply.send({ data: { job: serializeJob(job as unknown as JobLike) } });
  }
}
