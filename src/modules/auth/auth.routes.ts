import { FastifyInstance } from 'fastify';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.get('/test', async () => {
    return { message: 'Auth routes working' };
  });
}
