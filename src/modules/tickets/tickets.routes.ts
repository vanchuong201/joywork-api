import { FastifyInstance } from 'fastify';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { AuthService } from '@/modules/auth/auth.service';
import { AuthMiddleware } from '@/modules/auth/auth.middleware';

export async function ticketsRoutes(fastify: FastifyInstance) {
  const ticketsService = new TicketsService();
  const ticketsController = new TicketsController(ticketsService);
  const authService = new AuthService();
  const authMiddleware = new AuthMiddleware(authService);

  fastify.post('/', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Tạo ticket mới gửi đến doanh nghiệp',
      tags: ['Tickets'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['companyId', 'title', 'content'],
        properties: {
          companyId: { type: 'string' },
          title: { type: 'string', minLength: 10, maxLength: 120 },
          content: { type: 'string', minLength: 20, maxLength: 4000 },
        },
      },
    },
  }, ticketsController.createTicket.bind(ticketsController));

  fastify.get('/', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Danh sách ticket của tôi hoặc của một công ty',
      tags: ['Tickets'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          companyId: { type: 'string' },
          status: { type: 'string', enum: ['OPEN', 'RESPONDED', 'CLOSED'] },
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 50, default: 10 },
        },
      },
    },
  }, ticketsController.listTickets.bind(ticketsController));

  fastify.get('/:ticketId/messages', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Lấy danh sách tin nhắn của một ticket',
      tags: ['Tickets'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          ticketId: { type: 'string' },
        },
        required: ['ticketId'],
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
        },
      },
    },
  }, ticketsController.getMessages.bind(ticketsController));

  fastify.post('/:ticketId/messages', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Gửi tin nhắn trong ticket',
      tags: ['Tickets'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          ticketId: { type: 'string' },
        },
        required: ['ticketId'],
      },
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string', minLength: 1, maxLength: 4000 },
        },
      },
    },
  }, ticketsController.sendMessage.bind(ticketsController));

  fastify.patch('/:ticketId/status', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Cập nhật trạng thái ticket',
      tags: ['Tickets'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          ticketId: { type: 'string' },
        },
        required: ['ticketId'],
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['OPEN', 'RESPONDED', 'CLOSED'] },
        },
      },
    },
  }, ticketsController.updateStatus.bind(ticketsController));
}

