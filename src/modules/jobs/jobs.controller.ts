import { FastifyRequest, FastifyReply } from 'fastify';
import { JobsService } from './jobs.service';
import {
  createJobSchema,
  updateJobSchema,
  getJobSchema,
  searchJobsSchema,
  applyJobSchema,
  getApplicationsSchema,
  updateApplicationStatusSchema,
  getMyApplicationsSchema,
  getMyFavoritesSchema,
  jobIdParamsSchema,
} from './jobs.schema';

export class JobsController {
  constructor(private jobsService: JobsService) {}

  // Create job
  async createJob(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { companyId } = request.params as { companyId: string };
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9026dbdf-4370-41c8-a2ad-ea341cdeab12',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'job-create-pre',hypothesisId:'H3',location:'jobs.controller.ts:createJob',message:'controller reached with body keys',data:{companyId,keys:request.body && typeof request.body === 'object' ? Object.keys(request.body as Record<string, unknown>) : [],hasDescription:request.body && typeof request.body === 'object' ? Object.prototype.hasOwnProperty.call(request.body as Record<string, unknown>,'description') : false},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    let data;
    try {
      data = createJobSchema.parse(request.body);
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9026dbdf-4370-41c8-a2ad-ea341cdeab12',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'job-create-pre',hypothesisId:'H4',location:'jobs.controller.ts:createJob',message:'createJobSchema parse failed',data:{errorName:error?.name,issues:error?.issues,keys:request.body && typeof request.body === 'object' ? Object.keys(request.body as Record<string, unknown>) : []},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9026dbdf-4370-41c8-a2ad-ea341cdeab12',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'job-edit-pre',hypothesisId:'H2',location:'jobs.controller.ts:updateJob',message:'update body keys before parse',data:{jobId,keys:request.body && typeof request.body === 'object' ? Object.keys(request.body as Record<string, unknown>) : [],skillsType:request.body && typeof request.body === 'object' ? typeof (request.body as any).skills : null,skillsIsArray:request.body && typeof request.body === 'object' ? Array.isArray((request.body as any).skills) : null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    let data;
    try {
      data = updateJobSchema.parse(request.body);
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9026dbdf-4370-41c8-a2ad-ea341cdeab12',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'job-edit-pre',hypothesisId:'H3',location:'jobs.controller.ts:updateJob',message:'updateJobSchema parse failed',data:{jobId,errorName:error?.name,issues:error?.issues,skillsType:request.body && typeof request.body === 'object' ? typeof (request.body as any).skills : null,skillsIsArray:request.body && typeof request.body === 'object' ? Array.isArray((request.body as any).skills) : null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      throw error;
    }
    
    const job = await this.jobsService.updateJob(jobId, userId, data);
    
    return reply.send({
      data: { job },
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

  // Search jobs
  async searchJobs(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const data = searchJobsSchema.parse(request.query);
    
    const result = await this.jobsService.searchJobs(data, userId);
    
    return reply.send({
      data: result,
    });
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
}
