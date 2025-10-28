import { FastifyInstance } from 'fastify';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { AuthMiddleware } from '@/modules/auth/auth.middleware';
import { AuthService } from '@/modules/auth/auth.service';

export async function jobsRoutes(fastify: FastifyInstance) {
  const authService = new AuthService();
  const jobsService = new JobsService();
  const jobsController = new JobsController(jobsService);
  const authMiddleware = new AuthMiddleware(authService);

  // Create job
  fastify.post('/companies/:companyId/jobs', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Create a new job posting for a company',
      tags: ['Jobs'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          companyId: { type: 'string', description: 'Company ID' },
        },
        required: ['companyId'],
      },
      body: {
        type: 'object',
        required: ['title', 'description'],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200, description: 'Job title' },
          description: { type: 'string', minLength: 1, maxLength: 10000, description: 'Job description' },
          requirements: { type: 'string', maxLength: 5000, description: 'Job requirements' },
          responsibilities: { type: 'string', maxLength: 5000, description: 'Job responsibilities' },
          benefits: { type: 'string', maxLength: 2000, description: 'Job benefits' },
          location: { type: 'string', maxLength: 100, description: 'Job location' },
          remote: { type: 'boolean', default: false, description: 'Remote work allowed' },
          salaryMin: { type: 'number', minimum: 0, description: 'Minimum salary' },
          salaryMax: { type: 'number', minimum: 0, description: 'Maximum salary' },
          currency: { type: 'string', minLength: 3, maxLength: 3, default: 'VND', description: 'Salary currency' },
          employmentType: { 
            type: 'string', 
            enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE'],
            default: 'FULL_TIME',
            description: 'Employment type'
          },
          experienceLevel: { 
            type: 'string', 
            enum: ['ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE'],
            default: 'MID',
            description: 'Experience level required'
          },
          skills: { 
            type: 'array', 
            items: { type: 'string' },
            maxItems: 20,
            description: 'Required skills'
          },
          tags: { 
            type: 'array', 
            items: { type: 'string' },
            maxItems: 10,
            description: 'Job tags'
          },
          applicationDeadline: { type: 'string', format: 'date-time', description: 'Application deadline' },
          isActive: { type: 'boolean', default: true, description: 'Job is active' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                job: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    companyId: { type: 'string' },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    requirements: { type: 'string', nullable: true },
                    responsibilities: { type: 'string', nullable: true },
                    benefits: { type: 'string', nullable: true },
                    location: { type: 'string', nullable: true },
                    remote: { type: 'boolean' },
                    salaryMin: { type: 'number', nullable: true },
                    salaryMax: { type: 'number', nullable: true },
                    currency: { type: 'string' },
                    employmentType: { type: 'string' },
                    experienceLevel: { type: 'string' },
                    skills: { type: 'array', items: { type: 'string' } },
                    tags: { type: 'array', items: { type: 'string' } },
                    applicationDeadline: { type: 'string', format: 'date-time', nullable: true },
                    isActive: { type: 'boolean' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    company: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        slug: { type: 'string' },
                        logoUrl: { type: 'string', nullable: true },
                      },
                    },
                    _count: {
                      type: 'object',
                      properties: {
                        applications: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, jobsController.createJob.bind(jobsController));

  // Get job by ID
  fastify.get('/:jobId', {
    preHandler: [authMiddleware.optionalAuth.bind(authMiddleware)],
    schema: {
      description: 'Get job by ID',
      tags: ['Jobs'],
      params: {
        type: 'object',
        properties: {
          jobId: { type: 'string', description: 'Job ID' },
        },
        required: ['jobId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                job: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    companyId: { type: 'string' },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    requirements: { type: 'string', nullable: true },
                    responsibilities: { type: 'string', nullable: true },
                    benefits: { type: 'string', nullable: true },
                    location: { type: 'string', nullable: true },
                    remote: { type: 'boolean' },
                    salaryMin: { type: 'number', nullable: true },
                    salaryMax: { type: 'number', nullable: true },
                    currency: { type: 'string' },
                    employmentType: { type: 'string' },
                    experienceLevel: { type: 'string' },
                    skills: { type: 'array', items: { type: 'string' } },
                    tags: { type: 'array', items: { type: 'string' } },
                    applicationDeadline: { type: 'string', format: 'date-time', nullable: true },
                    isActive: { type: 'boolean' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    company: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        slug: { type: 'string' },
                        logoUrl: { type: 'string', nullable: true },
                      },
                    },
                    _count: {
                      type: 'object',
                      properties: {
                        applications: { type: 'number' },
                      },
                    },
                    hasApplied: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, jobsController.getJob.bind(jobsController));

  // Search jobs
  fastify.get('/', {
    preHandler: [authMiddleware.optionalAuth.bind(authMiddleware)],
    schema: {
      description: 'Search jobs',
      tags: ['Jobs'],
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Search query' },
          location: { type: 'string', description: 'Filter by location' },
          remote: { type: 'boolean', description: 'Filter by remote work' },
          employmentType: { 
            type: 'string', 
            enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE'],
            description: 'Filter by employment type'
          },
          experienceLevel: { 
            type: 'string', 
            enum: ['ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE'],
            description: 'Filter by experience level'
          },
          salaryMin: { type: 'number', minimum: 0, description: 'Minimum salary filter' },
          salaryMax: { type: 'number', minimum: 0, description: 'Maximum salary filter' },
          skills: { type: 'string', description: 'Comma-separated skills' },
          companyId: { type: 'string', description: 'Filter by company ID' },
          page: { type: 'number', minimum: 1, default: 1, description: 'Page number' },
          limit: { type: 'number', minimum: 1, maximum: 50, default: 20, description: 'Items per page' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                jobs: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      companyId: { type: 'string' },
                      title: { type: 'string' },
                      description: { type: 'string' },
                      requirements: { type: 'string', nullable: true },
                      responsibilities: { type: 'string', nullable: true },
                      benefits: { type: 'string', nullable: true },
                      location: { type: 'string', nullable: true },
                      remote: { type: 'boolean' },
                      salaryMin: { type: 'number', nullable: true },
                      salaryMax: { type: 'number', nullable: true },
                      currency: { type: 'string' },
                      employmentType: { type: 'string' },
                      experienceLevel: { type: 'string' },
                      skills: { type: 'array', items: { type: 'string' } },
                      tags: { type: 'array', items: { type: 'string' } },
                      applicationDeadline: { type: 'string', format: 'date-time', nullable: true },
                      isActive: { type: 'boolean' },
                      createdAt: { type: 'string', format: 'date-time' },
                      updatedAt: { type: 'string', format: 'date-time' },
                      company: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string' },
                          slug: { type: 'string' },
                          logoUrl: { type: 'string', nullable: true },
                        },
                      },
                      _count: {
                        type: 'object',
                        properties: {
                          applications: { type: 'number' },
                        },
                      },
                      hasApplied: { type: 'boolean' },
                    },
                  },
                },
                pagination: {
                  type: 'object',
                  properties: {
                    page: { type: 'number' },
                    limit: { type: 'number' },
                    total: { type: 'number' },
                    totalPages: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, jobsController.searchJobs.bind(jobsController));

  // Apply for job
  fastify.post('/apply', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Apply for a job',
      tags: ['Jobs'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['jobId'],
        properties: {
          jobId: { type: 'string', description: 'Job ID to apply for' },
          coverLetter: { type: 'string', maxLength: 2000, description: 'Cover letter' },
          resumeUrl: { type: 'string', format: 'uri', description: 'Resume URL' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, jobsController.applyForJob.bind(jobsController));

  // Get applications
  fastify.get('/applications', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Get job applications',
      tags: ['Jobs'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          jobId: { type: 'string', description: 'Filter by job ID' },
          companyId: { type: 'string', description: 'Filter by company ID' },
          status: { 
            type: 'string', 
            enum: ['PENDING', 'REVIEWING', 'SHORTLISTED', 'REJECTED', 'HIRED'],
            description: 'Filter by application status'
          },
          page: { type: 'number', minimum: 1, default: 1, description: 'Page number' },
          limit: { type: 'number', minimum: 1, maximum: 50, default: 20, description: 'Items per page' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                applications: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      jobId: { type: 'string' },
                      userId: { type: 'string' },
                      status: { type: 'string' },
                      coverLetter: { type: 'string', nullable: true },
                      resumeUrl: { type: 'string', nullable: true },
                      notes: { type: 'string', nullable: true },
                      appliedAt: { type: 'string', format: 'date-time' },
                      updatedAt: { type: 'string', format: 'date-time' },
                      job: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          title: { type: 'string' },
                          company: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              name: { type: 'string' },
                              slug: { type: 'string' },
                              logoUrl: { type: 'string', nullable: true },
                            },
                          },
                        },
                      },
                      user: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string', nullable: true },
                          email: { type: 'string' },
                          profile: {
                            type: 'object',
                            nullable: true,
                            properties: {
                              id: { type: 'string' },
                              headline: { type: 'string', nullable: true },
                              avatar: { type: 'string', nullable: true },
                              cvUrl: { type: 'string', nullable: true },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                pagination: {
                  type: 'object',
                  properties: {
                    page: { type: 'number' },
                    limit: { type: 'number' },
                    total: { type: 'number' },
                    totalPages: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, jobsController.getApplications.bind(jobsController));

  // Update application status
  fastify.patch('/applications/:applicationId/status', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Update application status',
      tags: ['Jobs'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          applicationId: { type: 'string', description: 'Application ID' },
        },
        required: ['applicationId'],
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { 
            type: 'string', 
            enum: ['PENDING', 'REVIEWING', 'SHORTLISTED', 'REJECTED', 'HIRED'],
            description: 'New application status'
          },
          notes: { type: 'string', maxLength: 1000, description: 'Notes about the application' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, jobsController.updateApplicationStatus.bind(jobsController));

  // Get my applications
  fastify.get('/me/applications', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Get my job applications',
      tags: ['Jobs'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          status: { 
            type: 'string', 
            enum: ['PENDING', 'REVIEWING', 'SHORTLISTED', 'REJECTED', 'HIRED'],
            description: 'Filter by application status'
          },
          page: { type: 'number', minimum: 1, default: 1, description: 'Page number' },
          limit: { type: 'number', minimum: 1, maximum: 50, default: 20, description: 'Items per page' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                applications: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      jobId: { type: 'string' },
                      userId: { type: 'string' },
                      status: { type: 'string' },
                      coverLetter: { type: 'string', nullable: true },
                      resumeUrl: { type: 'string', nullable: true },
                      notes: { type: 'string', nullable: true },
                      appliedAt: { type: 'string', format: 'date-time' },
                      updatedAt: { type: 'string', format: 'date-time' },
                      job: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          title: { type: 'string' },
                          company: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              name: { type: 'string' },
                              slug: { type: 'string' },
                              logoUrl: { type: 'string', nullable: true },
                            },
                          },
                        },
                      },
                      user: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string', nullable: true },
                          email: { type: 'string' },
                          profile: {
                            type: 'object',
                            nullable: true,
                            properties: {
                              id: { type: 'string' },
                              headline: { type: 'string', nullable: true },
                              avatar: { type: 'string', nullable: true },
                              cvUrl: { type: 'string', nullable: true },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                pagination: {
                  type: 'object',
                  properties: {
                    page: { type: 'number' },
                    limit: { type: 'number' },
                    total: { type: 'number' },
                    totalPages: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, jobsController.getMyApplications.bind(jobsController));

  // Update job
  fastify.patch('/:jobId', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Update job',
      tags: ['Jobs'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          jobId: { type: 'string', description: 'Job ID' },
        },
        required: ['jobId'],
      },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200, description: 'Job title' },
          description: { type: 'string', minLength: 1, maxLength: 10000, description: 'Job description' },
          requirements: { type: 'string', maxLength: 5000, description: 'Job requirements' },
          responsibilities: { type: 'string', maxLength: 5000, description: 'Job responsibilities' },
          benefits: { type: 'string', maxLength: 2000, description: 'Job benefits' },
          location: { type: 'string', maxLength: 100, description: 'Job location' },
          remote: { type: 'boolean', description: 'Remote work allowed' },
          salaryMin: { type: 'number', minimum: 0, description: 'Minimum salary' },
          salaryMax: { type: 'number', minimum: 0, description: 'Maximum salary' },
          currency: { type: 'string', minLength: 3, maxLength: 3, description: 'Salary currency' },
          employmentType: { 
            type: 'string', 
            enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE'],
            description: 'Employment type'
          },
          experienceLevel: { 
            type: 'string', 
            enum: ['ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE'],
            description: 'Experience level required'
          },
          skills: { 
            type: 'array', 
            items: { type: 'string' },
            maxItems: 20,
            description: 'Required skills'
          },
          tags: { 
            type: 'array', 
            items: { type: 'string' },
            maxItems: 10,
            description: 'Job tags'
          },
          applicationDeadline: { type: 'string', format: 'date-time', description: 'Application deadline' },
          isActive: { type: 'boolean', description: 'Job is active' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                job: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    companyId: { type: 'string' },
                    title: { type: 'string' },
                    description: { type: 'string' },
                    requirements: { type: 'string', nullable: true },
                    responsibilities: { type: 'string', nullable: true },
                    benefits: { type: 'string', nullable: true },
                    location: { type: 'string', nullable: true },
                    remote: { type: 'boolean' },
                    salaryMin: { type: 'number', nullable: true },
                    salaryMax: { type: 'number', nullable: true },
                    currency: { type: 'string' },
                    employmentType: { type: 'string' },
                    experienceLevel: { type: 'string' },
                    skills: { type: 'array', items: { type: 'string' } },
                    tags: { type: 'array', items: { type: 'string' } },
                    applicationDeadline: { type: 'string', format: 'date-time', nullable: true },
                    isActive: { type: 'boolean' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    company: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        slug: { type: 'string' },
                        logoUrl: { type: 'string', nullable: true },
                      },
                    },
                    _count: {
                      type: 'object',
                      properties: {
                        applications: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, jobsController.updateJob.bind(jobsController));

  // Delete job
  fastify.delete('/:jobId', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Delete job',
      tags: ['Jobs'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          jobId: { type: 'string', description: 'Job ID' },
        },
        required: ['jobId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, jobsController.deleteJob.bind(jobsController));
}
