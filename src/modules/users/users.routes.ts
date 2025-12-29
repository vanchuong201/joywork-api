import { FastifyInstance } from 'fastify';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserProfileController } from './user-profile.controller';
import { UserProfileService } from './user-profile.service';
import { UserExperienceController } from './user-experience.controller';
import { UserExperienceService } from './user-experience.service';
import { UserEducationController } from './user-education.controller';
import { UserEducationService } from './user-education.service';
import { AuthMiddleware } from '@/modules/auth/auth.middleware';
import { AuthService } from '@/modules/auth/auth.service';

export async function usersRoutes(fastify: FastifyInstance) {
  const authService = new AuthService();
  const usersService = new UsersService();
  const userProfileService = new UserProfileService();
  const experienceService = new UserExperienceService();
  const educationService = new UserEducationService();
  
  const usersController = new UsersController(usersService);
  const userProfileController = new UserProfileController(userProfileService);
  const experienceController = new UserExperienceController(experienceService);
  const educationController = new UserEducationController(educationService);
  
  const authMiddleware = new AuthMiddleware(authService);

  // Get public profile by slug (no auth required)
  fastify.get('/profile/:slug', {
    schema: {
      description: 'Get public user profile by slug',
      tags: ['Users'],
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
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
                profile: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string', nullable: true },
                    slug: { type: 'string', nullable: true },
                    createdAt: { type: 'string', format: 'date-time' },
                    profile: {
                      type: 'object',
                      nullable: true,
                      properties: {
                        id: { type: 'string' },
                        avatar: { type: 'string', nullable: true },
                        title: { type: 'string', nullable: true },
                        headline: { type: 'string', nullable: true },
                        bio: { type: 'string', nullable: true },
                        location: { type: 'string', nullable: true },
                        website: { type: 'string', nullable: true },
                        linkedin: { type: 'string', nullable: true },
                        github: { type: 'string', nullable: true },
                        status: { type: 'string', nullable: true },
                        knowledge: { type: 'array', items: { type: 'string' }, nullable: true },
                        skills: { type: 'array', items: { type: 'string' }, nullable: true },
                        attitude: { type: 'array', items: { type: 'string' }, nullable: true },
                        expectedSalary: { type: 'string', nullable: true },
                        workMode: { type: 'string', nullable: true },
                        expectedCulture: { type: 'string', nullable: true },
                        careerGoals: { type: 'array', items: { type: 'string' }, nullable: true },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                      },
                    },
                    experiences: {
                      type: 'array',
                      nullable: true,
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          role: { type: 'string' },
                          company: { type: 'string' },
                          period: { type: 'string', nullable: true },
                          desc: { type: 'string', nullable: true },
                          achievements: { type: 'array', items: { type: 'string' } },
                          startDate: { type: 'string', format: 'date-time', nullable: true },
                          endDate: { type: 'string', format: 'date-time', nullable: true },
                        },
                      },
                    },
                    educations: {
                      type: 'array',
                      nullable: true,
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          school: { type: 'string' },
                          degree: { type: 'string' },
                          period: { type: 'string', nullable: true },
                          gpa: { type: 'string', nullable: true },
                          honors: { type: 'string', nullable: true },
                          startDate: { type: 'string', format: 'date-time', nullable: true },
                          endDate: { type: 'string', format: 'date-time', nullable: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, userProfileController.getPublicProfileBySlug.bind(userProfileController));

  // Get current user profile (legacy endpoint - backward compatibility)
  fastify.get('/me', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Get current user profile',
      tags: ['Users'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    name: { type: 'string', nullable: true },
                    slug: { type: 'string', nullable: true }, // User slug
                    avatar: { type: 'string', nullable: true }, // Account avatar (User.avatar)
                    role: { type: 'string' },
                    createdAt: { type: 'string', format: 'date-time' },
                    profile: {
                      type: 'object',
                      nullable: true,
                      properties: {
                        id: { type: 'string' },
                        userId: { type: 'string' },
                        avatar: { type: 'string', nullable: true },
                        headline: { type: 'string', nullable: true },
                        bio: { type: 'string', nullable: true },
                        skills: { type: 'array', items: { type: 'string' } },
                        cvUrl: { type: 'string', nullable: true },
                        location: { type: 'string', nullable: true },
                        website: { type: 'string', nullable: true },
                        linkedin: { type: 'string', nullable: true },
                        github: { type: 'string', nullable: true },
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
  }, usersController.getMyProfile.bind(usersController));

  // Get current user profile (full data with email/phone)
  fastify.get('/me/profile', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Get current user profile with full data',
      tags: ['Users'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                profile: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    phone: { type: 'string', nullable: true },
                    name: { type: 'string', nullable: true },
                    slug: { type: 'string', nullable: true },
                    avatar: { type: 'string', nullable: true },
                    createdAt: { type: 'string', format: 'date-time' },
                    profile: {
                      type: 'object',
                      nullable: true,
                      properties: {
                        id: { type: 'string' },
                        avatar: { type: 'string', nullable: true },
                        fullName: { type: 'string', nullable: true },
                        title: { type: 'string', nullable: true },
                        headline: { type: 'string', nullable: true },
                        bio: { type: 'string', nullable: true },
                        skills: { type: 'array', items: { type: 'string' } },
                        cvUrl: { type: 'string', nullable: true },
                        location: { type: 'string', nullable: true },
                        website: { type: 'string', nullable: true },
                        linkedin: { type: 'string', nullable: true },
                        github: { type: 'string', nullable: true },
                        contactEmail: { type: 'string', nullable: true },
                        contactPhone: { type: 'string', nullable: true },
                        status: { type: 'string', nullable: true },
                        isPublic: { type: 'boolean' },
                        visibility: { type: 'object', nullable: true },
                        knowledge: { type: 'array', items: { type: 'string' } },
                        attitude: { type: 'array', items: { type: 'string' } },
                        expectedSalary: { type: 'string', nullable: true },
                        workMode: { type: 'string', nullable: true },
                        expectedCulture: { type: 'string', nullable: true },
                        careerGoals: { type: 'array', items: { type: 'string' } },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                      },
                    },
                    experiences: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          role: { type: 'string' },
                          company: { type: 'string' },
                          startDate: { type: 'string', format: 'date-time', nullable: true },
                          endDate: { type: 'string', format: 'date-time', nullable: true },
                          period: { type: 'string', nullable: true },
                          desc: { type: 'string', nullable: true },
                          achievements: { type: 'array', items: { type: 'string' } },
                          order: { type: 'number' },
                        },
                      },
                    },
                    educations: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          school: { type: 'string' },
                          degree: { type: 'string' },
                          startDate: { type: 'string', format: 'date-time', nullable: true },
                          endDate: { type: 'string', format: 'date-time', nullable: true },
                          period: { type: 'string', nullable: true },
                          gpa: { type: 'string', nullable: true },
                          honors: { type: 'string', nullable: true },
                          order: { type: 'number' },
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
  }, userProfileController.getOwnProfile.bind(userProfileController));

  // Update current user profile
  fastify.patch('/me/profile', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Update current user profile',
      tags: ['Users'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 2 },
          slug: { type: 'string', minLength: 2, pattern: '^[a-z0-9-]+$' },
          avatar: { type: 'string', format: 'uri', nullable: true },
          headline: { type: 'string', maxLength: 100, nullable: true },
          bio: { type: 'string', maxLength: 2000, nullable: true },
          skills: { type: 'array', items: { type: 'string' }, maxItems: 20 },
          cvUrl: { type: 'string', format: 'uri', nullable: true },
          location: { type: 'string', maxLength: 100, nullable: true },
          website: { type: 'string', format: 'uri', nullable: true },
          linkedin: { type: 'string', format: 'uri', nullable: true },
          github: { type: 'string', format: 'uri', nullable: true },
          fullName: { type: 'string', minLength: 2, maxLength: 200, nullable: true },
          title: { type: 'string', maxLength: 150, nullable: true },
          status: { type: 'string', enum: ['OPEN_TO_WORK', 'NOT_AVAILABLE', 'LOOKING'], nullable: true },
          isPublic: { type: 'boolean' },
          visibility: {
            type: 'object',
            properties: {
              bio: { type: 'boolean' },
              experience: { type: 'boolean' },
              education: { type: 'boolean' },
              ksa: { type: 'boolean' },
              expectations: { type: 'boolean' },
            },
            nullable: true,
          },
          knowledge: { type: 'array', items: { type: 'string' }, maxItems: 20 },
          attitude: { type: 'array', items: { type: 'string' }, maxItems: 20 },
          expectedSalary: { type: 'string', maxLength: 100, nullable: true },
          workMode: { type: 'string', maxLength: 100, nullable: true },
          expectedCulture: { type: 'string', maxLength: 500, nullable: true },
          careerGoals: { type: 'array', items: { type: 'string' }, maxItems: 10 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                profile: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    phone: { type: 'string', nullable: true },
                    name: { type: 'string', nullable: true },
                    slug: { type: 'string', nullable: true },
                    avatar: { type: 'string', nullable: true },
                    createdAt: { type: 'string', format: 'date-time' },
                    profile: {
                      type: 'object',
                      nullable: true,
                      properties: {
                        id: { type: 'string' },
                        avatar: { type: 'string', nullable: true },
                        fullName: { type: 'string', nullable: true },
                        title: { type: 'string', nullable: true },
                        headline: { type: 'string', nullable: true },
                        bio: { type: 'string', nullable: true },
                        skills: { type: 'array', items: { type: 'string' } },
                        cvUrl: { type: 'string', nullable: true },
                        location: { type: 'string', nullable: true },
                        website: { type: 'string', nullable: true },
                        linkedin: { type: 'string', nullable: true },
                        github: { type: 'string', nullable: true },
                        status: { type: 'string', nullable: true },
                        isPublic: { type: 'boolean' },
                        visibility: { type: 'object', nullable: true },
                        knowledge: { type: 'array', items: { type: 'string' } },
                        attitude: { type: 'array', items: { type: 'string' } },
                        expectedSalary: { type: 'string', nullable: true },
                        workMode: { type: 'string', nullable: true },
                        expectedCulture: { type: 'string', nullable: true },
                        careerGoals: { type: 'array', items: { type: 'string' } },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                      },
                    },
                    experiences: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          role: { type: 'string' },
                          company: { type: 'string' },
                          startDate: { type: 'string', format: 'date-time', nullable: true },
                          endDate: { type: 'string', format: 'date-time', nullable: true },
                          period: { type: 'string', nullable: true },
                          desc: { type: 'string', nullable: true },
                          achievements: { type: 'array', items: { type: 'string' } },
                          order: { type: 'number' },
                        },
                      },
                    },
                    educations: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          school: { type: 'string' },
                          degree: { type: 'string' },
                          startDate: { type: 'string', format: 'date-time', nullable: true },
                          endDate: { type: 'string', format: 'date-time', nullable: true },
                          period: { type: 'string', nullable: true },
                          gpa: { type: 'string', nullable: true },
                          honors: { type: 'string', nullable: true },
                          order: { type: 'number' },
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
  }, userProfileController.updateOwnProfile.bind(userProfileController));

  // ========== EXPERIENCE ROUTES ==========
  
  // Get all experiences
  fastify.get('/me/experiences', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Get all experiences for current user',
      tags: ['Users'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                experiences: {
                  type: 'array',
                  items: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },
  }, experienceController.getExperiences.bind(experienceController));

  // Create experience
  fastify.post('/me/experiences', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Create new experience',
      tags: ['Users'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          role: { type: 'string', minLength: 1, maxLength: 200 },
          company: { type: 'string', minLength: 1, maxLength: 200 },
          startDate: { type: 'string', format: 'date-time', nullable: true },
          endDate: { type: 'string', format: 'date-time', nullable: true },
          period: { type: 'string', maxLength: 100, nullable: true },
          desc: { type: 'string', maxLength: 2000, nullable: true },
          achievements: { type: 'array', items: { type: 'string' }, maxItems: 20 },
          order: { type: 'number', minimum: 0, default: 0 },
        },
        required: ['role', 'company'],
      },
      response: {
        201: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                experience: { type: 'object' },
              },
            },
          },
        },
      },
    },
  }, experienceController.createExperience.bind(experienceController));

  // Update experience
  fastify.patch('/me/experiences/:id', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Update experience',
      tags: ['Users'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          role: { type: 'string', maxLength: 200 },
          company: { type: 'string', maxLength: 200 },
          startDate: { type: 'string', format: 'date-time', nullable: true },
          endDate: { type: 'string', format: 'date-time', nullable: true },
          period: { type: 'string', maxLength: 100, nullable: true },
          desc: { type: 'string', maxLength: 2000, nullable: true },
          achievements: { type: 'array', items: { type: 'string' }, maxItems: 20 },
          order: { type: 'number', minimum: 0 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                experience: { type: 'object' },
              },
            },
          },
        },
      },
    },
  }, experienceController.updateExperience.bind(experienceController));

  // Delete experience
  fastify.delete('/me/experiences/:id', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Delete experience',
      tags: ['Users'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  }, experienceController.deleteExperience.bind(experienceController));

  // ========== EDUCATION ROUTES ==========
  
  // Get all educations
  fastify.get('/me/educations', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Get all educations for current user',
      tags: ['Users'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                educations: {
                  type: 'array',
                  items: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },
  }, educationController.getEducations.bind(educationController));

  // Create education
  fastify.post('/me/educations', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Create new education',
      tags: ['Users'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          school: { type: 'string', minLength: 1, maxLength: 200 },
          degree: { type: 'string', minLength: 1, maxLength: 200 },
          startDate: { type: 'string', format: 'date-time', nullable: true },
          endDate: { type: 'string', format: 'date-time', nullable: true },
          period: { type: 'string', maxLength: 100, nullable: true },
          gpa: { type: 'string', maxLength: 50, nullable: true },
          honors: { type: 'string', maxLength: 200, nullable: true },
          order: { type: 'number', minimum: 0, default: 0 },
        },
        required: ['school', 'degree'],
      },
      response: {
        201: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                education: { type: 'object' },
              },
            },
          },
        },
      },
    },
  }, educationController.createEducation.bind(educationController));

  // Update education
  fastify.patch('/me/educations/:id', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Update education',
      tags: ['Users'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          school: { type: 'string', maxLength: 200 },
          degree: { type: 'string', maxLength: 200 },
          startDate: { type: 'string', format: 'date-time', nullable: true },
          endDate: { type: 'string', format: 'date-time', nullable: true },
          period: { type: 'string', maxLength: 100, nullable: true },
          gpa: { type: 'string', maxLength: 50, nullable: true },
          honors: { type: 'string', maxLength: 200, nullable: true },
          order: { type: 'number', minimum: 0 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                education: { type: 'object' },
              },
            },
          },
        },
      },
    },
  }, educationController.updateEducation.bind(educationController));

  // Delete education
  fastify.delete('/me/educations/:id', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Delete education',
      tags: ['Users'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  }, educationController.deleteEducation.bind(educationController));

  // Get user profile by ID (public)
  fastify.get('/:userId', {
    schema: {
      description: 'Get user profile by ID',
      tags: ['Users'],
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
        },
        required: ['userId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    name: { type: 'string', nullable: true },
                    role: { type: 'string' },
                    profile: {
                      type: 'object',
                      nullable: true,
                      properties: {
                        id: { type: 'string' },
                        userId: { type: 'string' },
                        avatar: { type: 'string', nullable: true },
                        headline: { type: 'string', nullable: true },
                        bio: { type: 'string', nullable: true },
                        skills: { type: 'array', items: { type: 'string' } },
                        cvUrl: { type: 'string', nullable: true },
                        location: { type: 'string', nullable: true },
                        website: { type: 'string', nullable: true },
                        linkedin: { type: 'string', nullable: true },
                        github: { type: 'string', nullable: true },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                      },
                    },
                    createdAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, usersController.getUserProfile.bind(usersController));

  // Search users
  fastify.get('/', {
    schema: {
      description: 'Search users',
      tags: ['Users'],
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string' },
          skills: { type: 'string' },
          location: { type: 'string' },
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 50, default: 20 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                users: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      email: { type: 'string' },
                      name: { type: 'string', nullable: true },
                      role: { type: 'string' },
                      createdAt: { type: 'string', format: 'date-time' },
                      profile: {
                        type: 'object',
                        nullable: true,
                        properties: {
                          id: { type: 'string' },
                          userId: { type: 'string' },
                          avatar: { type: 'string', nullable: true },
                          headline: { type: 'string', nullable: true },
                          bio: { type: 'string', nullable: true },
                          skills: { type: 'array', items: { type: 'string' } },
                          cvUrl: { type: 'string', nullable: true },
                          location: { type: 'string', nullable: true },
                          website: { type: 'string', nullable: true },
                          linkedin: { type: 'string', nullable: true },
                          github: { type: 'string', nullable: true },
                          createdAt: { type: 'string', format: 'date-time' },
                          updatedAt: { type: 'string', format: 'date-time' },
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
  }, usersController.searchUsers.bind(usersController));
}
