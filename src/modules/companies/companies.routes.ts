import { FastifyInstance } from 'fastify';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { AuthMiddleware } from '@/modules/auth/auth.middleware';
import { AuthService } from '@/modules/auth/auth.service';

export async function companiesRoutes(fastify: FastifyInstance) {
  const authService = new AuthService();
  const companiesService = new CompaniesService();
  const companiesController = new CompaniesController(companiesService);
  const authMiddleware = new AuthMiddleware(authService);

  // Invitation related routes
  fastify.get('/invitations', {
    schema: {
      description: 'Get invitation details',
      tags: ['Companies'],
      querystring: {
        type: 'object',
        properties: {
          token: { type: 'string', description: 'Invitation token' }
        },
        required: ['token']
      },
      response: {
        200: {
            type: 'object',
            properties: {
                data: {
                    type: 'object',
                    properties: {
                        invitation: {
                            type: 'object',
                            properties: {
                                email: { type: 'string' },
                                companyName: { type: 'string' },
                                inviterName: { type: 'string' },
                                role: { type: 'string' }
                            }
                        }
                    }
                }
            }
        }
      }
    }
  }, companiesController.getInvitation.bind(companiesController));

  fastify.post('/invitations/accept', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Accept company invitation',
      tags: ['Companies'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          token: { type: 'string', description: 'Invitation token' }
        },
        required: ['token']
      },
      response: {
        200: {
            type: 'object',
            properties: {
                data: {
                    type: 'object',
                    properties: {
                        companySlug: { type: 'string' }
                    }
                }
            }
        }
      }
    }
  }, companiesController.acceptInvitation.bind(companiesController));


  // Create company
  fastify.post('/', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Create a new company',
      tags: ['Companies'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name', 'slug'],
        properties: {
          name: { type: 'string', minLength: 2, description: 'Company name' },
          legalName: { type: 'string', maxLength: 200, description: 'Registered business name' },
          slug: { type: 'string', minLength: 2, pattern: '^[a-z0-9-]+$', description: 'URL-friendly slug' },
          tagline: { type: 'string', maxLength: 150, description: 'Company tagline' },
          description: { type: 'string', maxLength: 10000, description: 'Company description (HTML allowed, sanitized server-side)' },
          logoUrl: { type: 'string', format: 'uri', description: 'Company logo URL' },
          coverUrl: { type: 'string', format: 'uri', description: 'Company cover image URL' },
          website: { type: 'string', format: 'uri', description: 'Company website URL' },
          location: { type: 'string', maxLength: 120, description: 'Company location' },
          industry: { type: 'string', maxLength: 80, description: 'Company industry' },
          size: { 
            type: 'string', 
            enum: ['STARTUP', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE'],
            description: 'Company size'
          },
          foundedYear: { 
            type: 'number', 
            minimum: 1800, 
            maximum: 2025,
            description: 'Year company was founded'
          },
          headcount: {
            type: 'number',
            minimum: 1,
            maximum: 200000,
            description: 'Approximate headcount',
          },
          headcountNote: {
            type: 'string',
            maxLength: 200,
            description: 'Additional note for headcount',
          },
          metrics: {
            type: 'array',
            items: {
              type: 'object',
              required: ['label', 'value'],
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
                value: { type: 'string' },
                description: { type: 'string' },
                icon: { type: 'string' },
              },
            },
            description: 'Company metrics displayed internally',
          },
          profileStory: {
            type: 'array',
            items: {
              type: 'object',
              required: ['type'],
              properties: {
                id: { type: 'string' },
                type: { type: 'string', enum: ['text', 'list', 'quote', 'stats', 'media'] },
                title: { type: 'string' },
                subtitle: { type: 'string' },
                body: { type: 'string' },
                items: {
                  type: 'array',
                  items: { type: 'string' },
                },
                stats: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['label', 'value'],
                    properties: {
                      id: { type: 'string' },
                      label: { type: 'string' },
                      value: { type: 'string' },
                      description: { type: 'string' },
                    },
                  },
                },
                quote: {
                  type: 'object',
                  required: ['text'],
                  properties: {
                    text: { type: 'string' },
                    author: { type: 'string' },
                    role: { type: 'string' },
                  },
                },
                media: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['url'],
                    properties: {
                      id: { type: 'string' },
                      url: { type: 'string', format: 'uri' },
                      caption: { type: 'string' },
                    },
                  },
                },
              },
            },
            description: 'Structured story blocks for company profile',
          },
          highlights: {
            type: 'array',
            items: {
              type: 'object',
              required: ['label'],
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
                description: { type: 'string' },
              },
            },
            description: 'Key highlights about the company',
          },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                company: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    legalName: { type: 'string', nullable: true },
                    slug: { type: 'string' },
                    tagline: { type: 'string', nullable: true },
                    description: { type: 'string', nullable: true },
                    logoUrl: { type: 'string', nullable: true },
                    coverUrl: { type: 'string', nullable: true },
                    website: { type: 'string', nullable: true },
                    location: { type: 'string', nullable: true },
                    industry: { type: 'string', nullable: true },
                    size: { type: 'string', nullable: true },
                    foundedYear: { type: 'number', nullable: true },
                    headcount: { type: 'number', nullable: true },
                    headcountNote: { type: 'string', nullable: true },
                    metrics: {
                      type: 'array',
                      nullable: true,
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', nullable: true },
                          label: { type: 'string' },
                          value: { type: 'string' },
                          description: { type: 'string', nullable: true },
                          icon: { type: 'string', nullable: true },
                        },
                      },
                    },
                    profileStory: {
                      type: 'array',
                      nullable: true,
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', nullable: true },
                          type: { type: 'string', enum: ['text', 'list', 'quote', 'stats', 'media'] },
                          title: { type: 'string', nullable: true },
                          subtitle: { type: 'string', nullable: true },
                          body: { type: 'string', nullable: true },
                          items: {
                            type: 'array',
                            nullable: true,
                            items: { type: 'string' },
                          },
                          stats: {
                            type: 'array',
                            nullable: true,
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'string', nullable: true },
                                label: { type: 'string' },
                                value: { type: 'string' },
                                description: { type: 'string', nullable: true },
                              },
                            },
                          },
                          quote: {
                            type: 'object',
                            nullable: true,
                            properties: {
                              text: { type: 'string' },
                              author: { type: 'string', nullable: true },
                              role: { type: 'string', nullable: true },
                            },
                          },
                          media: {
                            type: 'array',
                            nullable: true,
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'string', nullable: true },
                                url: { type: 'string' },
                                caption: { type: 'string', nullable: true },
                              },
                            },
                          },
                        },
                      },
                    },
                    highlights: {
                      type: 'array',
                      nullable: true,
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', nullable: true },
                          label: { type: 'string' },
                          description: { type: 'string', nullable: true },
                        },
                      },
                    },
                    isVerified: { type: 'boolean' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, companiesController.createCompany.bind(companiesController));

  // Company summary for hover card
  fastify.get('/:companyId/summary', {
    schema: {
      description: 'Get lightweight company summary by ID',
      tags: ['Companies'],
      params: {
        type: 'object',
        properties: {
          companyId: { type: 'string', description: 'Company ID' },
        },
        required: ['companyId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                summary: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    slug: { type: 'string' },
                    logoUrl: { type: 'string', nullable: true },
                    tagline: { type: 'string', nullable: true },
                    location: { type: 'string', nullable: true },
                    followersCount: { type: 'number' },
                    jobsActive: { type: 'number' },
                    postsCount: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, companiesController.getCompanySummary.bind(companiesController));

  // Get company by slug
  fastify.get('/:slug', {
    schema: {
      description: 'Get company by slug',
      tags: ['Companies'],
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Company slug' },
        },
        required: ['slug'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                company: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    legalName: { type: 'string', nullable: true },
                    slug: { type: 'string' },
                    tagline: { type: 'string', nullable: true },
                    description: { type: 'string', nullable: true },
                    logoUrl: { type: 'string', nullable: true },
                    coverUrl: { type: 'string', nullable: true },
                    website: { type: 'string', nullable: true },
                    location: { type: 'string', nullable: true },
                    industry: { type: 'string', nullable: true },
                    size: { type: 'string', nullable: true },
                    foundedYear: { type: 'number', nullable: true },
                    headcount: { type: 'number', nullable: true },
                    headcountNote: { type: 'string', nullable: true },
                    metrics: {
                      type: 'array',
                      nullable: true,
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', nullable: true },
                          label: { type: 'string' },
                          value: { type: 'string' },
                          description: { type: 'string', nullable: true },
                          icon: { type: 'string', nullable: true },
                        },
                      },
                    },
                    profileStory: {
                      type: 'array',
                      nullable: true,
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', nullable: true },
                          type: { type: 'string', enum: ['text', 'list', 'quote', 'stats', 'media'] },
                          title: { type: 'string', nullable: true },
                          subtitle: { type: 'string', nullable: true },
                          body: { type: 'string', nullable: true },
                          items: {
                            type: 'array',
                            nullable: true,
                            items: { type: 'string' },
                          },
                          stats: {
                            type: 'array',
                            nullable: true,
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'string', nullable: true },
                                label: { type: 'string' },
                                value: { type: 'string' },
                                description: { type: 'string', nullable: true },
                              },
                            },
                          },
                          quote: {
                            type: 'object',
                            nullable: true,
                            properties: {
                              text: { type: 'string' },
                              author: { type: 'string', nullable: true },
                              role: { type: 'string', nullable: true },
                            },
                          },
                          media: {
                            type: 'array',
                            nullable: true,
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'string', nullable: true },
                                url: { type: 'string' },
                                caption: { type: 'string', nullable: true },
                              },
                            },
                          },
                        },
                      },
                    },
                    highlights: {
                      type: 'array',
                      nullable: true,
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', nullable: true },
                          label: { type: 'string' },
                          description: { type: 'string', nullable: true },
                        },
                      },
                    },
                    isVerified: { type: 'boolean' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    members: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          userId: { type: 'string' },
                          role: { type: 'string' },
                          joinedAt: { type: 'string', format: 'date-time' },
                          user: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              email: { type: 'string' },
                              name: { type: 'string', nullable: true },
                              avatar: { type: 'string', nullable: true },
                            },
                          },
                        },
                      },
                    },
                    stats: {
                      type: 'object',
                      nullable: true,
                      properties: {
                        posts: { type: 'number' },
                        jobs: { type: 'number' },
                        followers: { type: 'number' },
                      },
                    },
                    profile: { type: 'object', nullable: true, additionalProperties: true }
                  },
                },
              },
            },
          },
        },
      },
    },
  }, companiesController.getCompany.bind(companiesController));

  // Search companies
  fastify.get('/', {
    schema: {
      description: 'Search companies',
      tags: ['Companies'],
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Search query' },
          industry: { type: 'string', description: 'Filter by industry' },
          location: { type: 'string', description: 'Filter by location' },
          size: { 
            type: 'string', 
            enum: ['STARTUP', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE'],
            description: 'Filter by company size'
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
                companies: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      legalName: { type: 'string', nullable: true },
                      slug: { type: 'string' },
                      tagline: { type: 'string', nullable: true },
                      description: { type: 'string', nullable: true },
                      logoUrl: { type: 'string', nullable: true },
                      coverUrl: { type: 'string', nullable: true },
                      website: { type: 'string', nullable: true },
                      location: { type: 'string', nullable: true },
                      industry: { type: 'string', nullable: true },
                      size: { type: 'string', nullable: true },
                      foundedYear: { type: 'number', nullable: true },
                      isVerified: { type: 'boolean' },
                      createdAt: { type: 'string', format: 'date-time' },
                      updatedAt: { type: 'string', format: 'date-time' },
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
  }, companiesController.searchCompanies.bind(companiesController));

  // Get user's companies
  fastify.get('/me/companies', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Get current user companies',
      tags: ['Companies'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                memberships: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      membershipId: { type: 'string' },
                      role: { type: 'string' },
                      company: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string' },
                          legalName: { type: 'string', nullable: true },
                          slug: { type: 'string' },
                          tagline: { type: 'string', nullable: true },
                          description: { type: 'string', nullable: true },
                          logoUrl: { type: 'string', nullable: true },
                          coverUrl: { type: 'string', nullable: true },
                          website: { type: 'string', nullable: true },
                          location: { type: 'string', nullable: true },
                          industry: { type: 'string', nullable: true },
                          size: { type: 'string', nullable: true },
                          foundedYear: { type: 'number', nullable: true },
                          isVerified: { type: 'boolean' },
                          createdAt: { type: 'string', format: 'date-time' },
                          updatedAt: { type: 'string', format: 'date-time' },
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
    },
  }, companiesController.getMyCompanies.bind(companiesController));

  // Get companies the user follows
  fastify.get('/me/follows', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Get companies the current user follows',
      tags: ['Companies'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                follows: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      followId: { type: 'string' },
                      followedAt: { type: 'string', format: 'date-time' },
                      company: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string' },
                          legalName: { type: 'string', nullable: true },
                          slug: { type: 'string' },
                          tagline: { type: 'string', nullable: true },
                          description: { type: 'string', nullable: true },
                          logoUrl: { type: 'string', nullable: true },
                          coverUrl: { type: 'string', nullable: true },
                          website: { type: 'string', nullable: true },
                          location: { type: 'string', nullable: true },
                          industry: { type: 'string', nullable: true },
                          size: { type: 'string', nullable: true },
                          foundedYear: { type: 'number', nullable: true },
                          isVerified: { type: 'boolean' },
                          createdAt: { type: 'string', format: 'date-time' },
                          updatedAt: { type: 'string', format: 'date-time' },
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
    },
  }, companiesController.getMyFollows.bind(companiesController));

  // Update company
  fastify.patch('/:companyId', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Update company',
      tags: ['Companies'],
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
        properties: {
          name: { type: 'string', minLength: 2, description: 'Company name' },
          legalName: { type: 'string', maxLength: 200, description: 'Registered business name' },
          slug: { type: 'string', minLength: 2, pattern: '^[a-z0-9-]+$', description: 'URL-friendly slug' },
          tagline: { type: 'string', maxLength: 150, description: 'Company tagline' },
          description: { type: 'string', maxLength: 10000, description: 'Company description (HTML allowed, sanitized server-side)' },
          logoUrl: { type: 'string', format: 'uri', description: 'Company logo URL' },
          coverUrl: { type: 'string', format: 'uri', description: 'Company cover image URL' },
          website: { type: 'string', format: 'uri', description: 'Company website URL' },
          location: { type: 'string', maxLength: 120, description: 'Company location' },
          industry: { type: 'string', maxLength: 80, description: 'Company industry' },
          size: { 
            type: 'string', 
            enum: ['STARTUP', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE'],
            description: 'Company size'
          },
          foundedYear: { 
            type: 'number', 
            minimum: 1800, 
            maximum: 2025,
            description: 'Year company was founded'
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                company: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    legalName: { type: 'string', nullable: true },
                    slug: { type: 'string' },
                    tagline: { type: 'string', nullable: true },
                    description: { type: 'string', nullable: true },
                    logoUrl: { type: 'string', nullable: true },
                    coverUrl: { type: 'string', nullable: true },
                    website: { type: 'string', nullable: true },
                    location: { type: 'string', nullable: true },
                    industry: { type: 'string', nullable: true },
                    size: { type: 'string', nullable: true },
                    foundedYear: { type: 'number', nullable: true },
                    headcount: { type: 'number', nullable: true },
                    headcountNote: { type: 'string', nullable: true },
                    metrics: {
                      type: 'array',
                      nullable: true,
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', nullable: true },
                          label: { type: 'string' },
                          value: { type: 'string' },
                          description: { type: 'string', nullable: true },
                          icon: { type: 'string', nullable: true },
                        },
                      },
                    },
                    profileStory: {
                      type: 'array',
                      nullable: true,
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', nullable: true },
                          type: { type: 'string', enum: ['text', 'list', 'quote', 'stats', 'media'] },
                          title: { type: 'string', nullable: true },
                          subtitle: { type: 'string', nullable: true },
                          body: { type: 'string', nullable: true },
                          items: {
                            type: 'array',
                            nullable: true,
                            items: { type: 'string' },
                          },
                          stats: {
                            type: 'array',
                            nullable: true,
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'string', nullable: true },
                                label: { type: 'string' },
                                value: { type: 'string' },
                                description: { type: 'string', nullable: true },
                              },
                            },
                          },
                          quote: {
                            type: 'object',
                            nullable: true,
                            properties: {
                              text: { type: 'string' },
                              author: { type: 'string', nullable: true },
                              role: { type: 'string', nullable: true },
                            },
                          },
                          media: {
                            type: 'array',
                            nullable: true,
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'string', nullable: true },
                                url: { type: 'string' },
                                caption: { type: 'string', nullable: true },
                              },
                            },
                          },
                        },
                      },
                    },
                    highlights: {
                      type: 'array',
                      nullable: true,
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', nullable: true },
                          label: { type: 'string' },
                          description: { type: 'string', nullable: true },
                        },
                      },
                    },
                    isVerified: { type: 'boolean' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, companiesController.updateCompany.bind(companiesController));

  // Update company profile
  fastify.patch('/:companyId/profile', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Update company profile (Showcase sections)',
      tags: ['Companies'],
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
        additionalProperties: true
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                profile: { type: 'object', additionalProperties: true }
              }
            }
          }
        }
      }
    }
  }, companiesController.updateCompanyProfile.bind(companiesController));

  // Invite company member (Renamed from addCompanyMember)
  fastify.post('/:companyId/members', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Invite company member',
      tags: ['Companies'],
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
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email', description: 'Email to invite' },
          role: { 
            type: 'string', 
            enum: ['OWNER', 'ADMIN', 'MEMBER'],
            default: 'MEMBER',
            description: 'Member role'
          },
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
  }, companiesController.inviteMember.bind(companiesController));

  // Update company member role
  fastify.patch('/:companyId/members/:memberId', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Update company member role',
      tags: ['Companies'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          companyId: { type: 'string', description: 'Company ID' },
          memberId: { type: 'string', description: 'Member ID' },
        },
        required: ['companyId', 'memberId'],
      },
      body: {
        type: 'object',
        required: ['role'],
        properties: {
          role: { 
            type: 'string', 
            enum: ['OWNER', 'ADMIN', 'MEMBER'],
            description: 'New member role'
          },
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
  }, companiesController.updateCompanyMemberRole.bind(companiesController));

  // Remove company member
  fastify.delete('/:companyId/members/:memberId', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Remove company member',
      tags: ['Companies'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          companyId: { type: 'string', description: 'Company ID' },
          memberId: { type: 'string', description: 'Member ID' },
        },
        required: ['companyId', 'memberId'],
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
  }, companiesController.removeCompanyMember.bind(companiesController));

  // Leave company
  fastify.delete('/:companyId/leave', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Leave company',
      tags: ['Companies'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          companyId: { type: 'string', description: 'Company ID' },
        },
        required: ['companyId'],
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
  }, companiesController.leaveCompany.bind(companiesController));

  // Follow company
  fastify.post('/:companyId/follow', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Follow a company',
      tags: ['Companies'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          companyId: { type: 'string', description: 'Company ID' },
        },
        required: ['companyId'],
      },
      response: {
        201: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                followed: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  }, companiesController.followCompany.bind(companiesController));

  // Unfollow company
  fastify.delete('/:companyId/follow', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Unfollow a company',
      tags: ['Companies'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          companyId: { type: 'string', description: 'Company ID' },
        },
        required: ['companyId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                followed: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  }, companiesController.unfollowCompany.bind(companiesController));

  // List company followers (members only)
  fastify.get('/:companyId/followers', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'List followers of a company (members only)',
      tags: ['Companies'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          companyId: { type: 'string', description: 'Company ID' },
        },
        required: ['companyId'],
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                followers: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      followedAt: { type: 'string', format: 'date-time' },
                      user: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          email: { type: 'string' },
                          name: { type: 'string', nullable: true },
                          avatar: { type: 'string', nullable: true },
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
                    hasMore: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, companiesController.listCompanyFollowers.bind(companiesController));
}
