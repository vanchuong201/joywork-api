import { FastifyRequest, FastifyReply } from 'fastify';
import { CompaniesService } from './companies.service';
import {
  createCompanySchema,
  updateCompanySchema,
  getCompanySchema,
  searchCompaniesSchema,
  addCompanyMemberSchema,
  updateCompanyMemberSchema,
} from './companies.schema';

export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  // Create company
  async createCompany(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const data = createCompanySchema.parse(request.body);
    
    const company = await this.companiesService.createCompany(userId, data);
    
    return reply.status(201).send({
      data: { company },
    });
  }

  // Update company
  async updateCompany(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { companyId } = request.params as { companyId: string };
    const data = updateCompanySchema.parse(request.body);
    
    const company = await this.companiesService.updateCompany(companyId, userId, data);
    
    return reply.send({
      data: { company },
    });
  }

  // Get company by slug
  async getCompany(request: FastifyRequest, reply: FastifyReply) {
    const { slug } = getCompanySchema.parse(request.params);
    
    const company = await this.companiesService.getCompanyBySlug(slug);
    
    if (!company) {
      return reply.status(404).send({
        error: {
          code: 'COMPANY_NOT_FOUND',
          message: 'Company not found',
        },
      });
    }

    return reply.send({
      data: { company },
    });
  }

  // Search companies
  async searchCompanies(request: FastifyRequest, reply: FastifyReply) {
    const data = searchCompaniesSchema.parse(request.query);
    
    const result = await this.companiesService.searchCompanies(data);
    
    return reply.send({
      data: result,
    });
  }

  // Get user's companies
  async getMyCompanies(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    
    const memberships = await this.companiesService.getUserCompanies(userId);
    
    return reply.send({
      data: { memberships },
    });
  }

  // Get user follows
  async getMyFollows(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;

    const follows = await this.companiesService.getUserFollows(userId);

    return reply.send({
      data: { follows },
    });
  }

  // Add company member
  async addCompanyMember(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { companyId } = request.params as { companyId: string };
    const data = addCompanyMemberSchema.parse(request.body);
    
    await this.companiesService.addCompanyMember(companyId, userId, data);
    
    return reply.status(201).send({
      data: {
        message: 'Member added successfully',
      },
    });
  }

  // Update company member role
  async updateCompanyMemberRole(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { companyId, memberId } = request.params as { companyId: string; memberId: string };
    const data = updateCompanyMemberSchema.parse(request.body);
    
    await this.companiesService.updateCompanyMemberRole(companyId, memberId, userId, data);
    
    return reply.send({
      data: {
        message: 'Member role updated successfully',
      },
    });
  }

  // Remove company member
  async removeCompanyMember(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { companyId, memberId } = request.params as { companyId: string; memberId: string };
    
    await this.companiesService.removeCompanyMember(companyId, memberId, userId);
    
    return reply.send({
      data: {
        message: 'Member removed successfully',
      },
    });
  }

  async followCompany(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { companyId } = request.params as { companyId: string };

    await this.companiesService.followCompany(companyId, userId);

    return reply.status(201).send({
      data: {
        followed: true,
      },
    });
  }

  async unfollowCompany(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { companyId } = request.params as { companyId: string };

    await this.companiesService.unfollowCompany(companyId, userId);

    return reply.send({
      data: {
        followed: false,
      },
    });
  }
}
