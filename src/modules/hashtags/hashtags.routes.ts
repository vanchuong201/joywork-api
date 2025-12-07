import { FastifyInstance } from 'fastify';
import { HashtagsService } from './hashtags.service';
import { HashtagsController } from './hashtags.controller';

export async function hashtagsRoutes(fastify: FastifyInstance) {
  const service = new HashtagsService();
  const controller = new HashtagsController(service);

  // Suggest hashtags
  fastify.get('/suggest', {
    schema: {
      description: 'Suggest hashtags by query',
      tags: ['Hashtags'],
      querystring: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search keyword' },
          limit: { type: 'number', minimum: 1, maximum: 50, default: 10 },
        },
        required: ['query'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                items: {
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
  }, controller.suggest.bind(controller));

  // Trending hashtags
  fastify.get('/trending', {
    schema: {
      description: 'Get trending hashtags',
      tags: ['Hashtags'],
      querystring: {
        type: 'object',
        properties: {
          window: {
            type: 'string',
            enum: ['7d', '30d', 'all'],
            default: '7d',
          },
          limit: { type: 'number', minimum: 1, maximum: 50, default: 10 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      slug: { type: 'string' },
                      label: { type: 'string' },
                      count: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, controller.trending.bind(controller));

  // Get hashtag by slug (meta)
  fastify.get('/:slug', {
    schema: {
      description: 'Get hashtag meta by slug',
      tags: ['Hashtags'],
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
                hashtag: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    slug: { type: 'string' },
                    label: { type: 'string' },
                    createdAt: { type: 'string', format: 'date-time' },
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
  }, controller.getBySlug.bind(controller));
}


