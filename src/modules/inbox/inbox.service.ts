import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import {
  SendMessageInput,
  GetMessagesInput,
  GetConversationsInput,
  MarkMessageReadInput,
  MarkConversationReadInput,
  GetUnreadCountInput,
} from './inbox.schema';

export interface Message {
  id: string;
  applicationId: string;
  senderId: string;
  content: string;
  messageType: string;
  fileUrl?: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
  sender: {
    id: string;
    name?: string;
    email: string;
    profile?: {
      id: string;
      avatar?: string;
    };
  };
  application: {
    id: string;
    job: {
      id: string;
      title: string;
      company: {
        id: string;
        name: string;
        slug: string;
        logoUrl?: string;
      };
    };
    user: {
      id: string;
      name?: string;
      email: string;
    };
  };
}

export interface Conversation {
  id: string;
  applicationId: string;
  lastMessage?: {
    id: string;
    content: string;
    messageType: string;
    createdAt: Date;
    sender: {
      id: string;
      name?: string;
    };
  };
  unreadCount: number;
  job: {
    id: string;
    title: string;
    company: {
      id: string;
      name: string;
      slug: string;
      logoUrl?: string;
    };
  };
  user: {
    id: string;
    name?: string;
    email: string;
    profile?: {
      id: string;
      avatar?: string;
    };
  };
  application: {
    id: string;
    status: string;
    appliedAt: Date;
  };
}

export class InboxService {
  // Send message
  async sendMessage(userId: string, data: SendMessageInput): Promise<Message> {
    // Check if user has access to this application
    const application = await prisma.application.findUnique({
      where: { id: data.applicationId },
      include: {
        job: {
          include: {
            company: {
              include: {
                members: {
                  where: { userId },
                },
              },
            },
          },
        },
        user: true,
      },
    });

    if (!application) {
      throw new AppError('Application not found', 404, 'APPLICATION_NOT_FOUND');
    }

    // Check if user is either the applicant or a company member
    const isApplicant = application.userId === userId;
    const isCompanyMember = application.job.company.members.length > 0;

    if (!isApplicant && !isCompanyMember) {
      throw new AppError('You do not have permission to send messages for this application', 403, 'FORBIDDEN');
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        applicationId: data.applicationId,
        senderId: userId,
        content: data.content,
        // Let DB defaults apply when not provided
        messageType: data.messageType ?? 'TEXT',
        fileUrl: data.fileUrl ?? null,
        isRead: false,
      },
      include: {
        sender: {
          include: {
            profile: {
              select: {
                id: true,
                avatar: true,
              },
            },
          },
        },
        application: {
          include: {
            job: {
              include: {
                company: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    logoUrl: true,
                  },
                },
              },
            },
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return {
      id: message.id,
      applicationId: message.applicationId,
      senderId: message.senderId,
      content: message.content,
      messageType: message.messageType,
      ...(message.fileUrl ? { fileUrl: message.fileUrl } : {}),
      isRead: message.isRead,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      sender: (() => {
        const sender: any = {
          id: message.sender.id,
          email: message.sender.email,
        };
        if (message.sender.name) sender.name = message.sender.name;
        if (message.sender.profile) {
          sender.profile = {
            id: message.sender.profile.id,
          };
          if (message.sender.profile.avatar) sender.profile.avatar = message.sender.profile.avatar;
        }
        return sender;
      })(),
      application: {
        id: message.application.id,
        job: {
          id: message.application.job.id,
          title: message.application.job.title,
          company: {
            id: message.application.job.company.id,
            name: message.application.job.company.name,
            slug: message.application.job.company.slug,
            ...(message.application.job.company.logoUrl ? { logoUrl: message.application.job.company.logoUrl } : {}),
          },
        },
        user: {
          id: message.application.user.id,
          email: message.application.user.email,
          ...(message.application.user.name ? { name: message.application.user.name } : {}),
        },
      },
    };
  }

  // Get messages for an application
  async getMessages(userId: string, data: GetMessagesInput): Promise<{
    messages: Message[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { applicationId, page, limit } = data;
    const skip = (page - 1) * limit;

    // Check if user has access to this application
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: {
          include: {
            company: {
              include: {
                members: {
                  where: { userId },
                },
              },
            },
          },
        },
        user: true,
      },
    });

    if (!application) {
      throw new AppError('Application not found', 404, 'APPLICATION_NOT_FOUND');
    }

    // Check if user is either the applicant or a company member
    const isApplicant = application.userId === userId;
    const isCompanyMember = application.job.company.members.length > 0;

    if (!isApplicant && !isCompanyMember) {
      throw new AppError('You do not have permission to view messages for this application', 403, 'FORBIDDEN');
    }

    // Get messages with pagination
    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { applicationId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: {
            include: {
              profile: {
                select: {
                  id: true,
                  avatar: true,
                },
              },
            },
          },
          application: {
            include: {
              job: {
                include: {
                  company: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                      logoUrl: true,
                    },
                  },
                },
              },
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
      prisma.message.count({ where: { applicationId } }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      messages: messages.map((message): any => ({
        id: message.id,
        applicationId: message.applicationId,
        senderId: message.senderId,
        content: message.content,
        messageType: message.messageType,
        ...(message.fileUrl ? { fileUrl: message.fileUrl } : {}),
        isRead: message.isRead,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        sender: {
          id: message.sender.id,
          email: message.sender.email,
          ...(message.sender.name ? { name: message.sender.name } : {}),
          profile: message.sender.profile ? {
            id: message.sender.profile.id,
            avatar: message.sender.profile.avatar ?? undefined,
          } : undefined,
        },
        application: {
          id: message.application.id,
          job: {
            id: message.application.job.id,
            title: message.application.job.title,
            company: {
              id: message.application.job.company.id,
              name: message.application.job.company.name,
              slug: message.application.job.company.slug,
              ...(message.application.job.company.logoUrl ? { logoUrl: message.application.job.company.logoUrl } : {}),
            },
          },
          user: {
            id: message.application.user.id,
            name: message.application.user.name ?? undefined,
            email: message.application.user.email,
          },
        },
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  // Get conversations for a user
  async getConversations(userId: string, data: GetConversationsInput): Promise<{
    conversations: Conversation[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const { page, limit } = data;
    const skip = (page - 1) * limit;

    // Get applications where user is either applicant or company member
    const applications = await prisma.application.findMany({
      where: {
        OR: [
          { userId }, // User is applicant
          {
            job: {
              company: {
                members: {
                  some: { userId },
                },
              },
            },
          }, // User is company member
        ],
      },
      include: {
        job: {
          include: {
            company: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
              },
            },
          },
        },
        user: {
          include: {
            profile: {
              select: {
                id: true,
                avatar: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: {
              where: {
                isRead: false,
                senderId: { not: userId }, // Unread messages from others
              },
            },
          },
        },
      },
      skip,
      take: limit,
      orderBy: { appliedAt: 'desc' },
    });

    const total = await prisma.application.count({
      where: {
        OR: [
          { userId },
          {
            job: {
              company: {
                members: {
                  some: { userId },
                },
              },
            },
          },
        ],
      },
    });

    const totalPages = Math.ceil(total / limit);

    return {
      conversations: applications.map((app): any => ({
        id: app.id,
        applicationId: app.id,
        ...(app.messages[0] ? {
          lastMessage: {
            id: app.messages[0].id,
            content: app.messages[0].content,
            messageType: app.messages[0].messageType,
            createdAt: app.messages[0].createdAt,
            sender: {
              id: app.messages[0].sender.id,
              ...(app.messages[0].sender.name ? { name: app.messages[0].sender.name } : {}),
            },
          },
        } : {}),
        unreadCount: app._count.messages,
        job: {
          id: app.job.id,
          title: app.job.title,
          company: app.job.company,
        },
        user: {
          id: app.user.id,
          name: app.user.name,
          email: app.user.email,
          profile: app.user.profile,
        },
        application: {
          id: app.id,
          status: app.status,
          appliedAt: app.appliedAt,
        },
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  // Mark message as read
  async markMessageRead(userId: string, data: MarkMessageReadInput): Promise<void> {
    // Check if user has access to this message
    const message = await prisma.message.findUnique({
      where: { id: data.messageId },
      include: {
        application: {
          include: {
            job: {
              include: {
                company: {
                  include: {
                    members: {
                      where: { userId },
                    },
                  },
                },
              },
            },
            user: true,
          },
        },
      },
    });

    if (!message) {
      throw new AppError('Message not found', 404, 'MESSAGE_NOT_FOUND');
    }

    // Check if user is either the applicant or a company member
    const isApplicant = message.application.userId === userId;
    const isCompanyMember = message.application.job.company.members.length > 0;

    if (!isApplicant && !isCompanyMember) {
      throw new AppError('You do not have permission to mark this message as read', 403, 'FORBIDDEN');
    }

    // Only mark as read if user is not the sender
    if (message.senderId !== userId) {
      await prisma.message.update({
        where: { id: data.messageId },
        data: { isRead: true },
      });
    }
  }

  // Mark conversation as read
  async markConversationRead(userId: string, data: MarkConversationReadInput): Promise<void> {
    // Check if user has access to this application
    const application = await prisma.application.findUnique({
      where: { id: data.applicationId },
      include: {
        job: {
          include: {
            company: {
              include: {
                members: {
                  where: { userId },
                },
              },
            },
          },
        },
        user: true,
      },
    });

    if (!application) {
      throw new AppError('Application not found', 404, 'APPLICATION_NOT_FOUND');
    }

    // Check if user is either the applicant or a company member
    const isApplicant = application.userId === userId;
    const isCompanyMember = application.job.company.members.length > 0;

    if (!isApplicant && !isCompanyMember) {
      throw new AppError('You do not have permission to mark this conversation as read', 403, 'FORBIDDEN');
    }

    // Mark all messages in this conversation as read (except those sent by the user)
    await prisma.message.updateMany({
      where: {
        applicationId: data.applicationId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true },
    });
  }

  // Get unread count
  async getUnreadCount(userId: string, data: GetUnreadCountInput): Promise<{
    unreadCount: number;
  }> {
    let whereClause: any = {
      isRead: false,
      senderId: { not: userId }, // Messages from others
    };

    if (data.applicationId) {
      whereClause.applicationId = data.applicationId;
    } else {
      // Get all applications where user is either applicant or company member
      const applications = await prisma.application.findMany({
        where: {
          OR: [
            { userId },
            {
              job: {
                company: {
                  members: {
                    some: { userId },
                  },
                },
              },
            },
          ],
        },
        select: { id: true },
      });

      whereClause.applicationId = {
        in: applications.map(app => app.id),
      };
    }

    const unreadCount = await prisma.message.count({
      where: whereClause,
    });

    return { unreadCount };
  }
}
