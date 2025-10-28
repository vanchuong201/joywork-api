import { FastifyInstance } from 'fastify';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';
import { AuthMiddleware } from '@/modules/auth/auth.middleware';
import { AuthService } from '@/modules/auth/auth.service';

export async function inboxRoutes(fastify: FastifyInstance) {
  const authService = new AuthService();
  const inboxService = new InboxService();
  const inboxController = new InboxController(inboxService);
  const authMiddleware = new AuthMiddleware(authService);

  // Send message
  fastify.post('/messages', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Send a message in an application conversation',
      tags: ['Inbox'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['applicationId', 'content'],
        properties: {
          applicationId: { type: 'string', description: 'Application ID' },
          content: { type: 'string', minLength: 1, maxLength: 2000, description: 'Message content' },
          messageType: { 
            type: 'string', 
            enum: ['TEXT', 'FILE', 'IMAGE'],
            default: 'TEXT',
            description: 'Message type'
          },
          fileUrl: { type: 'string', format: 'uri', description: 'File URL (for FILE/IMAGE messages)' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                message: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    applicationId: { type: 'string' },
                    senderId: { type: 'string' },
                    content: { type: 'string' },
                    messageType: { type: 'string' },
                    fileUrl: { type: 'string', nullable: true },
                    isRead: { type: 'boolean' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    sender: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string', nullable: true },
                        email: { type: 'string' },
                        profile: {
                          type: 'object',
                          nullable: true,
                          properties: {
                            id: { type: 'string' },
                            avatar: { type: 'string', nullable: true },
                          },
                        },
                      },
                    },
                    application: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        job: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            title: { type: 'string' },
                            company: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                name: { type: 'string' },
                                slug: { type: 'string' },
                                logoUrl: { type: 'string', nullable: true },
                              },
                            },
                          },
                        },
                        user: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            name: { type: 'string', nullable: true },
                            email: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, inboxController.sendMessage.bind(inboxController));

  // Get messages
  fastify.get('/messages', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Get messages for an application',
      tags: ['Inbox'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        required: ['applicationId'],
        properties: {
          applicationId: { type: 'string', description: 'Application ID' },
          page: { type: 'number', minimum: 1, default: 1, description: 'Page number' },
          limit: { type: 'number', minimum: 1, maximum: 50, default: 20, description: 'Items per page' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                messages: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      applicationId: { type: 'string' },
                      senderId: { type: 'string' },
                      content: { type: 'string' },
                      messageType: { type: 'string' },
                      fileUrl: { type: 'string', nullable: true },
                      isRead: { type: 'boolean' },
                      createdAt: { type: 'string', format: 'date-time' },
                      updatedAt: { type: 'string', format: 'date-time' },
                      sender: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string', nullable: true },
                          email: { type: 'string' },
                          profile: {
                            type: 'object',
                            nullable: true,
                            properties: {
                              id: { type: 'string' },
                              avatar: { type: 'string', nullable: true },
                            },
                          },
                        },
                      },
                      application: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          job: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              title: { type: 'string' },
                              company: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string' },
                                  name: { type: 'string' },
                                  slug: { type: 'string' },
                                  logoUrl: { type: 'string', nullable: true },
                                },
                              },
                            },
                          },
                          user: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              name: { type: 'string', nullable: true },
                              email: { type: 'string' },
                            },
                          },
                        },
                      },
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
  }, inboxController.getMessages.bind(inboxController));

  // Get conversations
  fastify.get('/conversations', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Get conversations for a user',
      tags: ['Inbox'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1, description: 'Page number' },
          limit: { type: 'number', minimum: 1, maximum: 50, default: 20, description: 'Items per page' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                conversations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      applicationId: { type: 'string' },
                      lastMessage: {
                        type: 'object',
                        nullable: true,
                        properties: {
                          id: { type: 'string' },
                          content: { type: 'string' },
                          messageType: { type: 'string' },
                          createdAt: { type: 'string', format: 'date-time' },
                          sender: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              name: { type: 'string', nullable: true },
                            },
                          },
                        },
                      },
                      unreadCount: { type: 'number' },
                      job: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          title: { type: 'string' },
                          company: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              name: { type: 'string' },
                              slug: { type: 'string' },
                              logoUrl: { type: 'string', nullable: true },
                            },
                          },
                        },
                      },
                      user: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string', nullable: true },
                          email: { type: 'string' },
                          profile: {
                            type: 'object',
                            nullable: true,
                            properties: {
                              id: { type: 'string' },
                              avatar: { type: 'string', nullable: true },
                            },
                          },
                        },
                      },
                      application: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          status: { type: 'string' },
                          appliedAt: { type: 'string', format: 'date-time' },
                        },
                      },
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
  }, inboxController.getConversations.bind(inboxController));

  // Mark message as read
  fastify.patch('/messages/:messageId/read', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Mark a message as read',
      tags: ['Inbox'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          messageId: { type: 'string', description: 'Message ID' },
        },
        required: ['messageId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
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
  }, inboxController.markMessageRead.bind(inboxController));

  // Mark conversation as read
  fastify.patch('/conversations/:applicationId/read', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Mark all messages in a conversation as read',
      tags: ['Inbox'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          applicationId: { type: 'string', description: 'Application ID' },
        },
        required: ['applicationId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
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
  }, inboxController.markConversationRead.bind(inboxController));

  // Get unread count
  fastify.get('/unread-count', {
    preHandler: [authMiddleware.verifyToken.bind(authMiddleware)],
    schema: {
      description: 'Get unread message count',
      tags: ['Inbox'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          applicationId: { type: 'string', description: 'Application ID (optional)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                unreadCount: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }, inboxController.getUnreadCount.bind(inboxController));
}
