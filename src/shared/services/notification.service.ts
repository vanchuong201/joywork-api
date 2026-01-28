import { prisma } from '@/shared/database/prisma';
import { NotificationType } from '@prisma/client';

type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  metadata?: Record<string, any>;
  relatedEntityType?: string;
  relatedEntityId?: string;
};

class NotificationService {
  /**
   * Create a new notification for a user
   */
  async createNotification(input: CreateNotificationInput) {
    return prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        content: input.content,
        metadata: input.metadata || {},
        relatedEntityType: input.relatedEntityType || null,
        relatedEntityId: input.relatedEntityId || null,
      },
    });
  }

  /**
   * Create notifications for multiple users (e.g., all admins of a company)
   */
  async createNotificationsForUsers(userIds: string[], input: Omit<CreateNotificationInput, 'userId'>) {
    if (userIds.length === 0) return [];

    const notifications = await Promise.all(
      userIds.map((userId) =>
        prisma.notification.create({
          data: {
            userId,
            type: input.type,
            title: input.title,
            content: input.content,
            metadata: input.metadata || {},
            relatedEntityType: input.relatedEntityType || null,
            relatedEntityId: input.relatedEntityId || null,
          },
        }),
      ),
    );

    return notifications;
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string, userId: string) {
    return prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId, // Ensure user owns the notification
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Get notifications for a user with pagination
   */
  async getNotifications(userId: string, options?: { page?: number; limit?: number; unreadOnly?: boolean }) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (options?.unreadOnly === true) {
      where.isRead = false;
    }

    try {
      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.notification.count({ where }),
      ]);

      return {
        notifications,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Error in getNotifications:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string) {
    return prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string, userId: string) {
    return prisma.notification.deleteMany({
      where: {
        id: notificationId,
        userId, // Ensure user owns the notification
      },
    });
  }
}

export const notificationService = new NotificationService();
