import { FastifyRequest, FastifyReply } from 'fastify';
import { JobsService } from './jobs.service';
import { config } from '@/config/env';
import { TtlCache } from '@/shared/cache/ttl-cache';
import {
  createJobSchema,
  updateJobSchema,
  getJobSchema,
  getRelatedJobsQuerySchema,
  searchJobsSchema,
  applyJobSchema,
  getApplicationsSchema,
  updateApplicationStatusSchema,
  getMyApplicationsSchema,
  getMyFavoritesSchema,
  jobIdParamsSchema,
} from './jobs.schema';

/**
 * Cache danh sách jobs cho request ẩn danh (TTL ngắn). Request có đăng nhập KHÔNG
 * cache vì response chứa `hasApplied` riêng theo user. Cache theo worker (an toàn cluster).
 *
 * Lưu **chuỗi JSON đã serialize** (không phải object) — cache HIT gửi thẳng bytes,
 * bỏ qua hẳn chi phí serialize lại payload lớn (~80KB) trên event loop. Đây là phần
 * tốn CPU chính dưới tải đọc cao.
 */
const jobsListCache = new TtlCache<string>(config.JOBS_LIST_CACHE_TTL_MS);

export class JobsController {
  constructor(private jobsService: JobsService) {}

  // Create job
  async createJob(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { companyId } = request.params as { companyId: string };
    let data;
    try {
      data = createJobSchema.parse(request.body);
    } catch (error: any) {
      throw error;
    }
    
    const job = await this.jobsService.createJob(companyId, userId, data);
    
    return reply.status(201).send({
      data: { job },
    });
  }

  // Update job
  async updateJob(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { jobId } = getJobSchema.parse(request.params);
    let data;
    try {
      data = updateJobSchema.parse(request.body);
    } catch (error: any) {
      throw error;
    }
    
    const job = await this.jobsService.updateJob(jobId, userId, data);
    
    return reply.send({
      data: { job },
    });
  }

  async refreshJob(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { jobId } = getJobSchema.parse(request.params);

    await this.jobsService.refreshJob(jobId, userId);

    return reply.send({
      data: {
        message: 'Làm mới tin tuyển dụng thành công',
      },
    });
  }

  // Get job by ID
  async getJob(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { jobId } = getJobSchema.parse(request.params);
    
    const job = await this.jobsService.getJobById(jobId, userId);
    
    if (!job) {
      return reply.status(404).send({
        error: {
          code: 'JOB_NOT_FOUND',
          message: 'Job not found',
        },
      });
    }

    return reply.send({
      data: { job },
    });
  }

  async getRelatedJobs(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { jobId } = getJobSchema.parse(request.params);
    const { limit } = getRelatedJobsQuerySchema.parse(request.query);

    const jobs = await this.jobsService.getRelatedJobs(jobId, limit, userId);

    return reply.send({
      data: { jobs },
    });
  }

  // Search jobs
  async searchJobs(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const data = searchJobsSchema.parse(request.query);

    // Chỉ cache cho người dùng ẩn danh (response authed chứa hasApplied riêng).
    if (!userId) {
      const maxAge = Math.floor(config.JOBS_LIST_CACHE_TTL_MS / 1000);
      const cacheKey = JSON.stringify(data, Object.keys(data).sort());
      const cached = jobsListCache.get(cacheKey);
      if (cached !== undefined) {
        return reply
          .header('X-Cache', 'HIT')
          .header('Cache-Control', `public, max-age=${maxAge}`)
          .type('application/json')
          .send(cached); // chuỗi đã serialize — không serialize lại
      }

      const result = await this.jobsService.searchJobs(data, undefined);
      const payload = JSON.stringify({ data: result });
      jobsListCache.set(cacheKey, payload);
      return reply
        .header('X-Cache', 'MISS')
        .header('Cache-Control', `public, max-age=${maxAge}`)
        .type('application/json')
        .send(payload);
    }

    // Người dùng đã đăng nhập: không cache.
    const result = await this.jobsService.searchJobs(data, userId);
    reply.header('Cache-Control', 'private, no-store');
    return reply.send({ data: result });
  }

  // Apply for job
  async applyForJob(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const data = applyJobSchema.parse(request.body);
    
    await this.jobsService.applyForJob(userId, data);
    
    return reply.status(201).send({
      data: {
        message: 'Ứng tuyển thành công',
      },
    });
  }

  // Get applications
  async getApplications(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const data = getApplicationsSchema.parse(request.query);
    
    const result = await this.jobsService.getApplications(data, userId);
    
    return reply.send({
      data: result,
    });
  }

  // Update applicationStatus
  async updateApplicationStatus(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { applicationId } = request.params as { applicationId: string };
    const body = request.body as any;
    const data = updateApplicationStatusSchema.parse({
      ...(body || {}),
      applicationId,
    });
    
    await this.jobsService.updateApplicationStatus(userId, data);
    
    return reply.send({
      data: {
        message: 'Application status updated successfully',
      },
    });
  }

  // Get my applications
  async getMyApplications(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const data = getMyApplicationsSchema.parse(request.query);
    
    const result = await this.jobsService.getMyApplications(userId, data);
    
    return reply.send({
      data: result,
    });
  }

  // Get my saved jobs
  async getMyFavorites(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const data = getMyFavoritesSchema.parse(request.query);

    const result = await this.jobsService.getMyFavorites(userId, data);

    return reply.send({
      data: result,
    });
  }

  async saveJob(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { jobId } = jobIdParamsSchema.parse(request.params);

    await this.jobsService.addFavorite(jobId, userId);

    return reply.status(201).send({
      data: { success: true },
    });
  }

  async removeFavorite(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { jobId } = jobIdParamsSchema.parse(request.params);

    await this.jobsService.removeFavorite(jobId, userId);

    return reply.send({
      data: { success: true },
    });
  }

  // Delete job
  async deleteJob(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { jobId } = getJobSchema.parse(request.params);

    await this.jobsService.deleteJob(jobId, userId);

    return reply.send({
      data: {
        message: 'Job deleted successfully',
      },
    });
  }

  // Semantic search (for chatbot)
  async semanticSearch(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as any;
    const result = await this.jobsService.semanticSearch({
      query: body.query,
      limit: body.limit,
      location: body.location,
      employmentType: body.employmentType,
      jobLevel: body.jobLevel,
      salaryMin: body.salaryMin,
      salaryMax: body.salaryMax,
    });
    return reply.send({ data: result });
  }
}
