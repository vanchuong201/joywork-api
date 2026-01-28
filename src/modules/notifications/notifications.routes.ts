import { FastifyInstance } from 'fastify';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { getNotificationsSchema, markAsReadSchema, deleteNotificationSchema } from './notifications.schema';
import { AuthService } from '@/modules/auth/auth.service';
import { AuthMiddleware } from '@/modules/auth/auth.middleware';

export default async function notificationsRoutes(fastify: FastifyInstance) {
  const notificationsService = new NotificationsService();
  const notificationsController = new NotificationsController(notificationsService);
  const authService = new AuthService();
  const authMiddleware = new AuthMiddleware(authService);

  // Apply authentication middleware to all routes
  fastify.addHook('onRequest', authMiddleware.verifyToken.bind(authMiddleware));

  // Get notifications with pagination
  fastify.get('/', {
    schema: {
      tags: ['notifications'],
      description: 'Get user notifications',
      ...getNotificationsSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                notifications: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      userId: { type: 'string' },
                      type: { type: 'string' },
                      title: { type: 'string' },
                      content: { type: 'string' },
                      metadata: { type: 'object' },
                      isRead: { type: 'boolean' },
                      relatedEntityType: { type: 'string' },
                      relatedEntityId: { type: 'string' },
                      createdAt: { type: 'string', format: 'date-time' },
                      readAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
                pagination: {
                  type: 'object',
                  properties: {
                    page: { type: 'number' },
                    limit: { type: 'number' },
                    total: { type: 'number' },
                    totalPages: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, notificationsController.getNotifications.bind(notificationsController));

  // Get unread count
  fastify.get('/unread-count', {
    schema: {
      tags: ['notifications'],
      description: 'Get unread notification count',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                count: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }, notificationsController.getUnreadCount.bind(notificationsController));

  // Mark notification as read
  fastify.patch('/:id/read', {
    schema: {
      tags: ['notifications'],
      description: 'Mark notification as read',
      ...markAsReadSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, notificationsController.markAsRead.bind(notificationsController));

  // Mark all notifications as read
  fastify.patch('/read-all', {
    schema: {
      tags: ['notifications'],
      description: 'Mark all notifications as read',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, notificationsController.markAllAsRead.bind(notificationsController));

  // Delete notification
  fastify.delete('/:id', {
    schema: {
      tags: ['notifications'],
      description: 'Delete notification',
      ...deleteNotificationSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, notificationsController.deleteNotification.bind(notificationsController));
}
