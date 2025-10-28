import { FastifyInstance } from 'fastify';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuthMiddleware } from '@/modules/auth/auth.middleware';
import { AuthService } from '@/modules/auth/auth.service';

export async function usersRoutes(fastify: FastifyInstance) {
  const authService = new AuthService();
  const usersService = new UsersService();
  const usersController = new UsersController(usersService);
  const authMiddleware = new AuthMiddleware(authService);

  // Get current user profile
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

  // Update current user profile
  fastify.patch('/me', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Update current user profile',
      tags: ['Users'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 2 },
          headline: { type: 'string', maxLength: 100 },
          bio: { type: 'string', maxLength: 500 },
          skills: { type: 'array', items: { type: 'string' }, maxItems: 10 },
          cvUrl: { type: 'string', format: 'uri' },
          location: { type: 'string', maxLength: 100 },
          website: { type: 'string', format: 'uri' },
          linkedin: { type: 'string', format: 'uri' },
          github: { type: 'string', format: 'uri' },
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
  }, usersController.updateMyProfile.bind(usersController));

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
