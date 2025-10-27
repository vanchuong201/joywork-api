import { FastifyInstance } from 'fastify';

export async function usersRoutes(fastify: FastifyInstance) {
  fastify.get('/test', async () => {
    return { message: 'Users routes working' };
  });
}
