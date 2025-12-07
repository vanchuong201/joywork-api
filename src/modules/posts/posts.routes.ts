import { FastifyInstance } from 'fastify';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { AuthMiddleware } from '@/modules/auth/auth.middleware';
import { AuthService } from '@/modules/auth/auth.service';

export async function postsRoutes(fastify: FastifyInstance) {
  const authService = new AuthService();
  const postsService = new PostsService();
  const postsController = new PostsController(postsService);
  const authMiddleware = new AuthMiddleware(authService);

  // Create post
  fastify.post('/companies/:companyId/posts', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Create a new post for a company',
      tags: ['Posts'],
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
        required: ['title', 'content'],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200, description: 'Post title' },
          content: { type: 'string', minLength: 1, maxLength: 10000, description: 'Post content' },
          excerpt: { type: 'string', maxLength: 500, description: 'Post excerpt' },
          type: { 
            type: 'string', 
            enum: ['STORY', 'ANNOUNCEMENT', 'EVENT'],
            default: 'STORY',
            description: 'Post type'
          },
          visibility: { 
            type: 'string', 
            enum: ['PUBLIC', 'PRIVATE'],
            default: 'PUBLIC',
            description: 'Post visibility'
          },
          publishedAt: { type: 'string', format: 'date-time', description: 'Publish date (optional)' },
          publishNow: { type: 'boolean', default: true, description: 'Publish immediately if true (ignored when publishedAt provided)' },
          images: {
            type: 'array',
            description: 'Optional gallery images (max 8)',
            items: {
              type: 'object',
              required: ['key', 'url'],
              properties: {
                key: { type: 'string', description: 'S3 object key returned from presign API' },
                url: { type: 'string', description: 'Public accessible URL of the uploaded image' },
                width: { type: 'number', description: 'Image width in px' },
                height: { type: 'number', description: 'Image height in px' },
                order: { type: 'number', description: 'Display order in gallery' },
              },
            },
          },
          jobIds: {
            type: 'array',
            description: 'Optional attached job IDs (max 10)',
            items: { type: 'string' },
          },
          hashtags: {
            type: 'array',
            description: 'Optional hashtags (max 5)',
            maxItems: 5,
            items: {
              type: 'string',
              description: 'Hashtag text, có thể có hoặc không có ký tự # ở đầu',
              minLength: 1,
              maxLength: 50,
            },
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
                post: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    companyId: { type: 'string' },
                    title: { type: 'string' },
                    content: { type: 'string' },
                    excerpt: { type: 'string', nullable: true },
                    coverUrl: { type: 'string', nullable: true },
                    type: { type: 'string' },
                    visibility: { type: 'string' },
                    publishedAt: { type: 'string', format: 'date-time', nullable: true },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    createdBy: {
                      type: 'object',
                      nullable: true,
                      properties: {
                        id: { type: 'string' },
                        email: { type: 'string' },
                        name: { type: 'string', nullable: true },
                      },
                    },
                    images: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          url: { type: 'string' },
                          width: { type: 'number', nullable: true },
                          height: { type: 'number', nullable: true },
                          order: { type: 'number' },
                        },
                      },
                    },
                    company: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        slug: { type: 'string' },
                        logoUrl: { type: 'string', nullable: true },
                      },
                    },
                    likes: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          userId: { type: 'string' },
                          user: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              name: { type: 'string', nullable: true },
                            },
                          },
                        },
                      },
                    },
                    _count: {
                      type: 'object',
                      properties: {
                        likes: { type: 'number' },
                      },
                    },
                    jobs: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          title: { type: 'string' },
                          location: { type: 'string', nullable: true },
                          employmentType: { type: 'string' },
                          isActive: { type: 'boolean' },
                        },
                      },
                    },
                    hashtags: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          slug: { type: 'string' },
                          label: { type: 'string' },
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
  }, postsController.createPost.bind(postsController));

  // Get post by ID
  fastify.get('/:postId', {
    preHandler: [authMiddleware.optionalAuth.bind(authMiddleware)],
    schema: {
      description: 'Get post by ID',
      tags: ['Posts'],
      params: {
        type: 'object',
        properties: {
          postId: { type: 'string', description: 'Post ID' },
        },
        required: ['postId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                post: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    companyId: { type: 'string' },
                    title: { type: 'string' },
                    content: { type: 'string' },
                    excerpt: { type: 'string', nullable: true },
                    coverUrl: { type: 'string', nullable: true },
                    type: { type: 'string' },
                    visibility: { type: 'string' },
                    publishedAt: { type: 'string', format: 'date-time', nullable: true },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    createdBy: {
                      type: 'object',
                      nullable: true,
                      properties: {
                        id: { type: 'string' },
                        email: { type: 'string' },
                        name: { type: 'string', nullable: true },
                      },
                    },
                    images: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          url: { type: 'string' },
                          width: { type: 'number', nullable: true },
                          height: { type: 'number', nullable: true },
                          order: { type: 'number' },
                        },
                      },
                    },
                    company: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        slug: { type: 'string' },
                        logoUrl: { type: 'string', nullable: true },
                      },
                    },
                    likes: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          userId: { type: 'string' },
                          user: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              name: { type: 'string', nullable: true },
                            },
                          },
                        },
                      },
                    },
                    _count: {
                      type: 'object',
                      properties: {
                        likes: { type: 'number' },
                      },
                    },
                    jobs: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          title: { type: 'string' },
                          location: { type: 'string', nullable: true },
                          employmentType: { type: 'string' },
                          isActive: { type: 'boolean' },
                        },
                      },
                    },
                    hashtags: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          slug: { type: 'string' },
                          label: { type: 'string' },
                        },
                      },
                    },
                    isLiked: { type: 'boolean' },
                    isSaved: { type: 'boolean' },
                    reactions: {
                      type: 'object',
                      nullable: true,
                      properties: {
                        JOY: { type: 'number' },
                        TRUST: { type: 'number' },
                        SKEPTIC: { type: 'number' },
                      },
                    },
                    userReaction: { type: 'string', nullable: true, enum: ['JOY', 'TRUST', 'SKEPTIC', null] },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, postsController.getPost.bind(postsController));

  // Get company posts
  fastify.get('/companies/:companyId/posts', {
    preHandler: [authMiddleware.optionalAuth.bind(authMiddleware)],
    schema: {
      description: 'Get posts for a specific company',
      tags: ['Posts'],
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
          type: { 
            type: 'string', 
            enum: ['STORY', 'ANNOUNCEMENT', 'EVENT'],
            description: 'Filter by post type'
          },
          visibility: { 
            type: 'string', 
            enum: ['PUBLIC', 'PRIVATE'],
            description: 'Filter by visibility'
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
                posts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      companyId: { type: 'string' },
                      title: { type: 'string' },
                      content: { type: 'string' },
                      excerpt: { type: 'string', nullable: true },
                      coverUrl: { type: 'string', nullable: true },
                      type: { type: 'string' },
                      visibility: { type: 'string' },
                      publishedAt: { type: 'string', format: 'date-time', nullable: true },
                      createdAt: { type: 'string', format: 'date-time' },
                      updatedAt: { type: 'string', format: 'date-time' },
                      createdBy: {
                        type: 'object',
                        nullable: true,
                        properties: {
                          id: { type: 'string' },
                          email: { type: 'string' },
                          name: { type: 'string', nullable: true },
                        },
                      },
                      images: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            url: { type: 'string' },
                            width: { type: 'number', nullable: true },
                            height: { type: 'number', nullable: true },
                            order: { type: 'number' },
                          },
                        },
                      },
                      company: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string' },
                          slug: { type: 'string' },
                          logoUrl: { type: 'string', nullable: true },
                        },
                      },
                      likes: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            userId: { type: 'string' },
                            user: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                name: { type: 'string', nullable: true },
                              },
                            },
                          },
                        },
                      },
                      _count: {
                        type: 'object',
                        properties: {
                          likes: { type: 'number' },
                        },
                      },
                      jobs: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            title: { type: 'string' },
                            location: { type: 'string', nullable: true },
                            employmentType: { type: 'string' },
                            isActive: { type: 'boolean' },
                          },
                        },
                      },
                        hashtags: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              slug: { type: 'string' },
                              label: { type: 'string' },
                          },
                        },
                      },
                      isLiked: { type: 'boolean' },
                      isSaved: { type: 'boolean' },
                      reactions: {
                        type: 'object',
                        nullable: true,
                        properties: {
                          JOY: { type: 'number' },
                          TRUST: { type: 'number' },
                          SKEPTIC: { type: 'number' },
                        },
                      },
                      userReaction: { type: 'string', nullable: true, enum: ['JOY', 'TRUST', 'SKEPTIC', null] },
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
  }, postsController.getCompanyPosts.bind(postsController));

  // Get feed posts (public posts)
  fastify.get('/', {
    preHandler: [authMiddleware.optionalAuth.bind(authMiddleware)],
    schema: {
      description: 'Get public feed posts',
      tags: ['Posts'],
      querystring: {
        type: 'object',
        properties: {
          type: { 
            type: 'string', 
            enum: ['STORY', 'ANNOUNCEMENT', 'EVENT'],
            description: 'Filter by post type'
          },
          companyId: { type: 'string', description: 'Filter by company ID' },
          hashtag: { type: 'string', description: 'Filter by hashtag slug' },
          following: { type: 'boolean', description: 'Only posts from companies the current user follows' },
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
                posts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      companyId: { type: 'string' },
                      title: { type: 'string' },
                      content: { type: 'string' },
                      excerpt: { type: 'string', nullable: true },
                      coverUrl: { type: 'string', nullable: true },
                      type: { type: 'string' },
                      visibility: { type: 'string' },
                      publishedAt: { type: 'string', format: 'date-time', nullable: true },
                      createdAt: { type: 'string', format: 'date-time' },
                      updatedAt: { type: 'string', format: 'date-time' },
                      createdBy: {
                        type: 'object',
                        nullable: true,
                        properties: {
                          id: { type: 'string' },
                          email: { type: 'string' },
                          name: { type: 'string', nullable: true },
                        },
                      },
                      images: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            url: { type: 'string' },
                            width: { type: 'number', nullable: true },
                            height: { type: 'number', nullable: true },
                            order: { type: 'number' },
                          },
                        },
                      },
                      company: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string' },
                          slug: { type: 'string' },
                          logoUrl: { type: 'string', nullable: true },
                        },
                      },
                      likes: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            userId: { type: 'string' },
                            user: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                name: { type: 'string', nullable: true },
                              },
                            },
                          },
                        },
                      },
                      _count: {
                        type: 'object',
                        properties: {
                          likes: { type: 'number' },
                        },
                      },
                      jobs: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            title: { type: 'string' },
                            location: { type: 'string', nullable: true },
                            employmentType: { type: 'string' },
                            isActive: { type: 'boolean' },
                          },
                        },
                      },
                      isLiked: { type: 'boolean' },
                      isSaved: { type: 'boolean' },
                      reactions: {
                        type: 'object',
                        nullable: true,
                        properties: {
                          JOY: { type: 'number' },
                          TRUST: { type: 'number' },
                          SKEPTIC: { type: 'number' },
                        },
                      },
                      userReaction: { type: 'string', nullable: true, enum: ['JOY', 'TRUST', 'SKEPTIC', null] },
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
  }, postsController.getFeedPosts.bind(postsController));

  // Update post
  fastify.patch('/:postId', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Update post',
      tags: ['Posts'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          postId: { type: 'string', description: 'Post ID' },
        },
        required: ['postId'],
      },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200, description: 'Post title' },
          content: { type: 'string', minLength: 1, maxLength: 10000, description: 'Post content' },
          excerpt: { type: 'string', maxLength: 500, description: 'Post excerpt' },
          type: { 
            type: 'string', 
            enum: ['STORY', 'ANNOUNCEMENT', 'EVENT'],
            description: 'Post type'
          },
          visibility: { 
            type: 'string', 
            enum: ['PUBLIC', 'PRIVATE'],
            description: 'Post visibility'
          },
          publishedAt: { type: 'string', format: 'date-time', description: 'Publish date' },
          images: {
            type: 'array',
            maxItems: 8,
            items: {
              type: 'object',
              required: ['url'],
              properties: {
                id: { type: 'string' },
                key: { type: 'string' },
                url: { type: 'string' },
                width: { type: 'number' },
                height: { type: 'number' },
                order: { type: 'number' },
              },
            },
            description: 'Replace images set for the post (up to 8)',
          },
          jobIds: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 10,
            description: 'Replace attached jobs (IDs) for this post (max 10)',
          },
          hashtags: {
            type: 'array',
            description: 'Replace hashtags for this post (max 5)',
            maxItems: 5,
            items: {
              type: 'string',
              description: 'Hashtag text, có thể có hoặc không có ký tự # ở đầu',
              minLength: 1,
              maxLength: 50,
            },
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
                post: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    companyId: { type: 'string' },
                    title: { type: 'string' },
                    content: { type: 'string' },
                    excerpt: { type: 'string', nullable: true },
                    coverUrl: { type: 'string', nullable: true },
                    type: { type: 'string' },
                    visibility: { type: 'string' },
                    publishedAt: { type: 'string', format: 'date-time', nullable: true },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    createdBy: {
                      type: 'object',
                      nullable: true,
                      properties: {
                        id: { type: 'string' },
                        email: { type: 'string' },
                        name: { type: 'string', nullable: true },
                      },
                    },
                    images: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          url: { type: 'string' },
                          width: { type: 'number', nullable: true },
                          height: { type: 'number', nullable: true },
                          order: { type: 'number' },
                        },
                      },
                    },
                    company: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        slug: { type: 'string' },
                        logoUrl: { type: 'string', nullable: true },
                      },
                    },
                    likes: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          userId: { type: 'string' },
                          user: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              name: { type: 'string', nullable: true },
                            },
                          },
                        },
                      },
                    },
                    _count: {
                      type: 'object',
                      properties: {
                        likes: { type: 'number' },
                      },
                    },
                    jobs: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          title: { type: 'string' },
                          location: { type: 'string', nullable: true },
                          employmentType: { type: 'string' },
                          isActive: { type: 'boolean' },
                        },
                      },
                    },
                    hashtags: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          slug: { type: 'string' },
                          label: { type: 'string' },
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
  }, postsController.updatePost.bind(postsController));

  // Like post
  fastify.post('/:postId/like', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Like a post',
      tags: ['Posts'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          postId: { type: 'string', description: 'Post ID' },
        },
        required: ['postId'],
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
  }, postsController.likePost.bind(postsController));

  // Unlike post
  fastify.delete('/:postId/like', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Unlike a post',
      tags: ['Posts'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          postId: { type: 'string', description: 'Post ID' },
        },
        required: ['postId'],
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
  }, postsController.unlikePost.bind(postsController));

  // React to a post
  fastify.post('/:postId/react', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'React to a post',
      tags: ['Posts'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          postId: { type: 'string', description: 'Post ID' },
        },
        required: ['postId'],
      },
      body: {
        type: 'object',
        required: ['type'],
        properties: {
          type: { type: 'string', enum: ['JOY', 'TRUST', 'SKEPTIC'] },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: { reacted: { type: 'boolean' } },
            },
          },
        },
      },
    },
  }, postsController.reactPost.bind(postsController));

  // Remove reaction
  fastify.delete('/:postId/react', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Remove my reaction from a post',
      tags: ['Posts'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          postId: { type: 'string', description: 'Post ID' },
        },
        required: ['postId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: { reacted: { type: 'boolean' } },
            },
          },
        },
      },
    },
  }, postsController.removeReaction.bind(postsController));

  // Save post to favorites
  fastify.post('/:postId/favorite', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Save a post to favorites',
      tags: ['Posts'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['postId'],
        properties: {
          postId: { type: 'string', description: 'Post ID' },
        },
      },
      response: {
        201: {
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
  }, postsController.savePost.bind(postsController));

  // Remove post from favorites
  fastify.delete('/:postId/favorite', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Remove a post from favorites',
      tags: ['Posts'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['postId'],
        properties: {
          postId: { type: 'string', description: 'Post ID' },
        },
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
  }, postsController.removeFavorite.bind(postsController));

  // Get my saved posts
  fastify.get('/me/favorites', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Get my saved posts',
      tags: ['Posts'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
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
                favorites: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      createdAt: { type: 'string', format: 'date-time' },
                      post: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          title: { type: 'string' },
                          content: { type: 'string' },
                          excerpt: { type: 'string', nullable: true },
                          coverUrl: { type: 'string', nullable: true },
                          type: { type: 'string' },
                          visibility: { type: 'string' },
                          publishedAt: { type: 'string', format: 'date-time', nullable: true },
                          createdAt: { type: 'string', format: 'date-time' },
                          updatedAt: { type: 'string', format: 'date-time' },
                          createdBy: {
                            type: 'object',
                            nullable: true,
                            properties: {
                              id: { type: 'string' },
                              email: { type: 'string' },
                              name: { type: 'string', nullable: true },
                            },
                          },
                          company: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              name: { type: 'string' },
                              slug: { type: 'string' },
                              logoUrl: { type: 'string', nullable: true },
                            },
                          },
                          images: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                url: { type: 'string' },
                                width: { type: 'number', nullable: true },
                                height: { type: 'number', nullable: true },
                                order: { type: 'number' },
                              },
                            },
                          },
                          likes: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                userId: { type: 'string' },
                                user: {
                                  type: 'object',
                                  properties: {
                                    id: { type: 'string' },
                                    name: { type: 'string', nullable: true },
                                  },
                                },
                              },
                            },
                          },
                          _count: {
                            type: 'object',
                            properties: { likes: { type: 'number' } },
                          },
                          jobs: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                title: { type: 'string' },
                                location: { type: 'string', nullable: true },
                                employmentType: { type: 'string' },
                                isActive: { type: 'boolean' },
                              },
                            },
                          },
                          isLiked: { type: 'boolean' },
                          isSaved: { type: 'boolean' },
                          reactions: {
                            type: 'object',
                            nullable: true,
                            properties: {
                              JOY: { type: 'number' },
                              TRUST: { type: 'number' },
                              SKEPTIC: { type: 'number' },
                            },
                          },
                          userReaction: { type: 'string', nullable: true, enum: ['JOY', 'TRUST', 'SKEPTIC', null] },
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
  }, postsController.getMyFavorites.bind(postsController));
  // Publish post
  fastify.post('/:postId/publish', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Publish a post',
      tags: ['Posts'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          postId: { type: 'string', description: 'Post ID' },
        },
        required: ['postId'],
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
  }, postsController.publishPost.bind(postsController));

  // Unpublish post
  fastify.post('/:postId/unpublish', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Unpublish a post',
      tags: ['Posts'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          postId: { type: 'string', description: 'Post ID' },
        },
        required: ['postId'],
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
  }, postsController.unpublishPost.bind(postsController));

  // Delete post
  fastify.delete('/:postId', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Delete a post',
      tags: ['Posts'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          postId: { type: 'string', description: 'Post ID' },
        },
        required: ['postId'],
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
  }, postsController.deletePost.bind(postsController));
}
