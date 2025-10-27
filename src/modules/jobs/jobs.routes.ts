import { FastifyInstance } from 'fastify';

export async function jobsRoutes(fastify: FastifyInstance) {
  fastify.get('/test', async () => {
    return { message: 'Jobs routes working' };
  });
}
