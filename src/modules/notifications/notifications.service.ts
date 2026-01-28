import { notificationService } from '@/shared/services/notification.service';

export class NotificationsService {
  async getNotifications(userId: string, options?: { page?: number; limit?: number; unreadOnly?: boolean }) {
    return notificationService.getNotifications(userId, options);
  }

  async getUnreadCount(userId: string) {
    return notificationService.getUnreadCount(userId);
  }

  async markAsRead(notificationId: string, userId: string) {
    const result = await notificationService.markAsRead(notificationId, userId);
    if (result.count === 0) {
      throw new Error('Notification not found or already read');
    }
    return { success: true };
  }

  async markAllAsRead(userId: string) {
    await notificationService.markAllAsRead(userId);
    return { success: true };
  }

  async deleteNotification(notificationId: string, userId: string) {
    const result = await notificationService.deleteNotification(notificationId, userId);
    if (result.count === 0) {
      throw new Error('Notification not found');
    }
    return { success: true };
  }
}
