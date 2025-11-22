import { FastifyReply, FastifyRequest } from 'fastify';
import {
  createTicketSchema,
  listTicketsSchema,
  getTicketMessagesSchema,
  sendTicketMessageSchema,
  updateTicketStatusSchema,
} from './tickets.schema';
import { TicketsService } from './tickets.service';

export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  async createTicket(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const data = createTicketSchema.parse(request.body);

    const ticket = await this.ticketsService.createTicket(userId, data);

    return reply.status(201).send({
      data: { ticket },
    });
  }

  async listTickets(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const query = listTicketsSchema.parse(request.query);

    const result = await this.ticketsService.listTickets(userId, query);

    return reply.send({
      data: result,
    });
  }

  async getMessages(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { ticketId } = request.params as { ticketId: string };
    const query = getTicketMessagesSchema.parse({
      ticketId,
      ...(request.query as Record<string, unknown>),
    });

    const result = await this.ticketsService.getTicketMessages(userId, query);

    return reply.send({
      data: result,
    });
  }

  async sendMessage(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { ticketId } = request.params as { ticketId: string };
    const body = sendTicketMessageSchema.parse({
      ticketId,
      ...(request.body as Record<string, unknown>),
    });

    const message = await this.ticketsService.sendMessage(userId, body);

    return reply.status(201).send({
      data: { message },
    });
  }

  async updateStatus(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { ticketId } = request.params as { ticketId: string };
    const body = updateTicketStatusSchema.parse({
      ticketId,
      ...(request.body as Record<string, unknown>),
    });

    const ticket = await this.ticketsService.updateTicketStatus(userId, body);

    return reply.send({
      data: { ticket },
    });
  }
}

