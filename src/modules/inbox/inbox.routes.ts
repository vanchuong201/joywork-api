import { FastifyInstance } from 'fastify';

export async function inboxRoutes(fastify: FastifyInstance) {
  fastify.get('/test', async () => {
    return { message: 'Inbox routes working' };
  });
}
