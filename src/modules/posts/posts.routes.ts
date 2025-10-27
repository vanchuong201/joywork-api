import { FastifyInstance } from 'fastify';

export async function postsRoutes(fastify: FastifyInstance) {
  fastify.get('/test', async () => {
    return { message: 'Posts routes working' };
  });
}
