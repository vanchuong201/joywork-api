import { FastifyInstance } from 'fastify';

export async function companiesRoutes(fastify: FastifyInstance) {
  fastify.get('/test', async () => {
    return { message: 'Companies routes working' };
  });
}
