import { FastifyRequest, FastifyReply } from 'fastify';
import { NotificationsService } from './notifications.service';
import { AppError } from '@/shared/errors/errorHandler';

export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  async getNotifications(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user?.userId;
      if (!userId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      const { page, limit, unreadOnly } = (request.query as any) || {};
      const options: { page?: number; limit?: number; unreadOnly?: boolean } = {};
      if (page) options.page = Number(page);
      if (limit) options.limit = Number(limit);
      if (unreadOnly === 'true' || unreadOnly === true) options.unreadOnly = true;
      
      const result = await this.notificationsService.getNotifications(userId, options);

      return reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error in getNotifications:', error);
      throw new AppError('Internal server error', 500, 'INTERNAL_ERROR');
    }
  }

  async getUnreadCount(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = (request as any).user?.userId;
      if (!userId) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      const count = await this.notificationsService.getUnreadCount(userId);

      return reply.send({
        success: true,
        data: { count },
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error in getUnreadCount:', error);
      throw new AppError('Internal server error', 500, 'INTERNAL_ERROR');
    }
  }

  async markAsRead(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const { id } = request.params as { id: string };
    await this.notificationsService.markAsRead(id, userId);

    return reply.send({
      success: true,
      data: { message: 'Notification marked as read' },
    });
  }

  async markAllAsRead(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    await this.notificationsService.markAllAsRead(userId);

    return reply.send({
      success: true,
      data: { message: 'All notifications marked as read' },
    });
  }

  async deleteNotification(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request as any).user?.userId;
    if (!userId) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const { id } = request.params as { id: string };
    await this.notificationsService.deleteNotification(id, userId);

    return reply.send({
      success: true,
      data: { message: 'Notification deleted' },
    });
  }
}
