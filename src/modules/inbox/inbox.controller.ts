import { FastifyRequest, FastifyReply } from 'fastify';
import { InboxService } from './inbox.service';
import {
  sendMessageSchema,
  getMessagesSchema,
  getConversationsSchema,
  markMessageReadSchema,
  markConversationReadSchema,
  getUnreadCountSchema,
} from './inbox.schema';

export class InboxController {
  constructor(private inboxService: InboxService) {}

  // Send message
  async sendMessage(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const data = sendMessageSchema.parse(request.body);
    
    const message = await this.inboxService.sendMessage(userId, data);
    
    return reply.status(201).send({
      data: { message },
    });
  }

  // Get messages
  async getMessages(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const data = getMessagesSchema.parse(request.query);
    
    const result = await this.inboxService.getMessages(userId, data);
    
    return reply.send({
      data: result,
    });
  }

  // Get conversations
  async getConversations(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const data = getConversationsSchema.parse(request.query);
    
    const result = await this.inboxService.getConversations(userId, data);
    
    return reply.send({
      data: result,
    });
  }

  // Mark message as read
  async markMessageRead(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { messageId } = markMessageReadSchema.parse(request.params);
    
    await this.inboxService.markMessageRead(userId, { messageId });
    
    return reply.send({
      data: {
        message: 'Message marked as read',
      },
    });
  }

  // Mark conversation as read
  async markConversationRead(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const { applicationId } = markConversationReadSchema.parse(request.params);
    
    await this.inboxService.markConversationRead(userId, { applicationId });
    
    return reply.send({
      data: {
        message: 'Conversation marked as read',
      },
    });
  }

  // Get unread count
  async getUnreadCount(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    const data = getUnreadCountSchema.parse(request.query);
    
    const result = await this.inboxService.getUnreadCount(userId, data);
    
    return reply.send({
      data: result,
    });
  }
}
