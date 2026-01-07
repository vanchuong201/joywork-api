import { TicketStatus } from '@prisma/client';
import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import { emailService } from '@/shared/services/email.service';
import { config } from '@/config/env';
import {
  CreateTicketInput,
  ListTicketsInput,
  GetTicketMessagesInput,
  SendTicketMessageInput,
  UpdateTicketStatusInput,
} from './tickets.schema';

const MAX_OPEN_TICKETS_PER_COMPANY = 3;
const MAX_TICKETS_PER_DAY = 5;
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

export class TicketsService {
  async createTicket(userId: string, data: CreateTicketInput) {
    const [company, applicant, userMembership] = await Promise.all([
      prisma.company.findUnique({
        where: { id: data.companyId },
        select: {
          id: true,
          name: true,
          slug: true,
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true },
      }),
      prisma.companyMember.findFirst({
        where: { userId, companyId: data.companyId },
      }),
    ]);

    if (!company) {
      throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
    }

    if (!applicant) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Allow support tickets to JoyWork company even if user is a member
    const isJoyWorkCompany = config.JOYWORK_COMPANY_ID && data.companyId === config.JOYWORK_COMPANY_ID;
    
    if (userMembership && !isJoyWorkCompany) {
      throw new AppError('Bạn không thể gửi ticket tới công ty của mình', 400, 'TICKET_SELF_TARGET');
    }

    const [openTicketCount, dailyTicketCount] = await Promise.all([
      prisma.companyTicket.count({
        where: {
          companyId: data.companyId,
          applicantId: userId,
          status: { in: [TicketStatus.OPEN, TicketStatus.RESPONDED] },
        },
      }),
      prisma.companyTicket.count({
        where: {
          applicantId: userId,
          createdAt: {
            gte: new Date(Date.now() - DAILY_WINDOW_MS),
          },
        },
      }),
    ]);

    if (openTicketCount >= MAX_OPEN_TICKETS_PER_COMPANY) {
      throw new AppError(
        'Bạn đã có quá nhiều ticket đang mở với doanh nghiệp này. Vui lòng chờ phản hồi hoặc đóng ticket cũ trước khi tạo mới.',
        429,
        'TICKET_LIMIT_PER_COMPANY',
      );
    }

    if (dailyTicketCount >= MAX_TICKETS_PER_DAY) {
      throw new AppError(
        'Bạn đã đạt giới hạn gửi ticket trong 24 giờ. Vui lòng thử lại sau.',
        429,
        'TICKET_DAILY_LIMIT',
      );
    }

    const ticket = await prisma.companyTicket.create({
      data: {
        companyId: data.companyId,
        applicantId: userId,
        title: data.title.trim(),
        messages: {
          create: {
            senderId: userId,
            content: data.content.trim(),
          },
        },
      },
      include: {
        company: {
          select: { id: true, name: true, slug: true, logoUrl: true },
        },
        applicant: {
          select: { id: true, name: true, email: true },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    this.notifyOwners(ticket.companyId, {
      applicantName: applicant.name,
      applicantEmail: applicant.email,
      title: data.title,
      content: data.content,
      ticketId: ticket.id,
      companySlug: ticket.company.slug,
    }).catch(() => {
      // notification failure should not block creation
    });

    return this.serializeTicket(ticket);
  }

  async listTickets(userId: string, params: ListTicketsInput) {
    const { companyId, status, page, limit } = params;
    const skip = (page - 1) * limit;

    let where: any;
    let isCompanyContext = false;

    if (companyId) {
      const membership = await prisma.companyMember.findFirst({
        where: {
          companyId,
          userId,
        },
      });

      if (!membership) {
        throw new AppError('Bạn không có quyền xem ticket của công ty này', 403, 'FORBIDDEN');
      }

      isCompanyContext = true;
      where = { companyId };
    } else {
      where = { applicantId: userId };
    }

    if (status) {
      where.status = status;
    }

    const [tickets, total] = await Promise.all([
      prisma.companyTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          company: {
            select: { id: true, name: true, slug: true, logoUrl: true, location: true },
          },
          applicant: {
            select: { id: true, name: true, email: true },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      }),
      prisma.companyTicket.count({ where }),
    ]);

    return {
      tickets: tickets.map((ticket) => this.serializeTicket(ticket)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      scope: isCompanyContext ? 'company' : 'applicant',
    };
  }

  async getTicketMessages(userId: string, params: GetTicketMessagesInput) {
    const { ticket, isApplicant, companyMembership } = await this.ensureTicketAccess(userId, params.ticketId);
    const skip = (params.page - 1) * params.limit;

    const [messages, total] = await Promise.all([
      prisma.companyTicketMessage.findMany({
        where: { ticketId: ticket.id },
        skip,
        take: params.limit,
        orderBy: { createdAt: 'asc' },
        include: {
          sender: {
            select: { id: true, name: true, email: true, profile: { select: { avatar: true } } },
          },
        },
      }),
      prisma.companyTicketMessage.count({ where: { ticketId: ticket.id } }),
    ]);

    await prisma.companyTicket.update({
      where: { id: ticket.id },
      data: isApplicant ? { applicantLastViewedAt: new Date() } : { companyLastViewedAt: new Date() },
    });

    return {
      ticket: this.serializeTicket(ticket),
      accessRole: isApplicant ? 'applicant' : companyMembership?.role ?? 'MEMBER',
      messages: messages.map((message) => ({
        id: message.id,
        ticketId: message.ticketId,
        senderId: message.senderId,
        content: message.content,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        sender: {
          id: message.sender.id,
          email: message.sender.email,
          ...(message.sender.name ? { name: message.sender.name } : {}),
          ...(message.sender.profile?.avatar ? { avatar: message.sender.profile.avatar } : {}),
        },
      })),
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    };
  }

  async sendMessage(userId: string, params: SendTicketMessageInput) {
    const { ticket, isApplicant, companyMembership } = await this.ensureTicketAccess(userId, params.ticketId);

    const message = await prisma.companyTicketMessage.create({
      data: {
        ticketId: ticket.id,
        senderId: userId,
        content: params.content.trim(),
      },
      include: {
        sender: {
          select: { id: true, name: true, email: true, profile: { select: { avatar: true } } },
        },
      },
    });

    await prisma.companyTicket.update({
      where: { id: ticket.id },
      data: {
        status: isApplicant ? TicketStatus.OPEN : TicketStatus.RESPONDED,
        updatedAt: new Date(),
        ...(isApplicant ? { applicantLastViewedAt: new Date() } : { companyLastViewedAt: new Date() }),
      },
    });

    if (isApplicant) {
      this.notifyOwners(ticket.companyId, {
        applicantName: ticket.applicant.name,
        applicantEmail: ticket.applicant.email,
        title: ticket.title,
        content: params.content,
        ticketId: ticket.id,
        companySlug: ticket.company.slug,
      }).catch(() => {});
    } else if (companyMembership) {
      this.notifyApplicant(ticket.applicant.email, {
        companyName: ticket.company.name,
        title: ticket.title,
        content: params.content,
        ticketId: ticket.id,
        companySlug: ticket.company.slug,
      }).catch(() => {});
    }

    return {
      id: message.id,
      ticketId: message.ticketId,
      senderId: message.senderId,
      content: message.content,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      sender: {
        id: message.sender.id,
        email: message.sender.email,
        ...(message.sender.name ? { name: message.sender.name } : {}),
        ...(message.sender.profile?.avatar ? { avatar: message.sender.profile.avatar } : {}),
      },
    };
  }

  async updateTicketStatus(userId: string, params: UpdateTicketStatusInput) {
    const { ticket, isApplicant, companyMembership } = await this.ensureTicketAccess(userId, params.ticketId);

    if (params.status === TicketStatus.CLOSED && isApplicant) {
      // applicant allowed to close their own ticket
    } else if (!companyMembership) {
      throw new AppError('Bạn không có quyền cập nhật trạng thái ticket này', 403, 'FORBIDDEN');
    }

    const updated = await prisma.companyTicket.update({
      where: { id: ticket.id },
      data: {
        status: params.status,
        updatedAt: new Date(),
      },
      include: {
        company: {
          select: { id: true, name: true, slug: true, logoUrl: true },
        },
        applicant: {
          select: { id: true, name: true, email: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    return this.serializeTicket(updated);
  }

  private async ensureTicketAccess(userId: string, ticketId: string) {
    const ticket = await prisma.companyTicket.findUnique({
      where: { id: ticketId },
      include: {
        company: {
          select: { id: true, name: true, slug: true, logoUrl: true },
        },
        applicant: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!ticket) {
      throw new AppError('Ticket không tồn tại', 404, 'TICKET_NOT_FOUND');
    }

    const isApplicant = ticket.applicantId === userId;
    const companyMembership = await prisma.companyMember.findFirst({
      where: {
        companyId: ticket.companyId,
        userId,
      },
      select: { role: true },
    });

    if (!isApplicant && !companyMembership) {
      throw new AppError('Bạn không có quyền truy cập ticket này', 403, 'FORBIDDEN');
    }

    return { ticket, isApplicant, companyMembership };
  }

  private serializeTicket(ticket: any) {
    const lastMessage = ticket.messages?.[0]
      ? {
          id: ticket.messages[0].id,
          content: ticket.messages[0].content,
          createdAt: ticket.messages[0].createdAt,
          sender: {
            id: ticket.messages[0].sender.id,
            ...(ticket.messages[0].sender.name ? { name: ticket.messages[0].sender.name } : {}),
            email: ticket.messages[0].sender.email,
          },
        }
      : undefined;

    return {
      id: ticket.id,
      company: {
        id: ticket.company.id,
        name: ticket.company.name,
        slug: ticket.company.slug,
        ...(ticket.company.logoUrl ? { logoUrl: ticket.company.logoUrl } : {}),
      },
      applicant: {
        id: ticket.applicant.id,
        email: ticket.applicant.email,
        ...(ticket.applicant.name ? { name: ticket.applicant.name } : {}),
      },
      title: ticket.title,
      status: ticket.status,
      applicantLastViewedAt: ticket.applicantLastViewedAt ?? null,
      companyLastViewedAt: ticket.companyLastViewedAt ?? null,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      lastMessage,
    };
  }

  private async notifyOwners(
    companyId: string,
    payload: {
      applicantName?: string | null;
      applicantEmail: string;
      title: string;
      content: string;
      ticketId: string;
      companySlug: string;
    },
  ) {
    const owners = await prisma.companyMember.findMany({
      where: {
        companyId,
        role: 'OWNER',
      },
      include: {
        user: {
          select: { email: true, name: true },
        },
      },
    });

    const ticketUrl = `${config.FRONTEND_ORIGIN}/tickets/${payload.ticketId}?company=${payload.companySlug}`;

    await Promise.all(
      owners
        .filter((owner) => owner.user.email)
        .map((owner) => {
          const basePayload: {
            ownerName?: string | null;
            applicantName?: string | null;
            applicantEmail: string;
            title: string;
            content: string;
            ticketUrl: string;
          } = {
            ownerName: owner.user.name ?? null,
            applicantEmail: payload.applicantEmail,
            title: payload.title,
            content: payload.content,
            ticketUrl,
          };
          if (payload.applicantName !== undefined) {
            basePayload.applicantName = payload.applicantName;
          }
          return emailService
            .sendCompanyTicketOwnerEmail(owner.user.email, basePayload)
            .catch(() => {});
        }),
    );
  }

  private async notifyApplicant(
    applicantEmail: string,
    payload: {
      companyName: string;
      title: string;
      content: string;
      ticketId: string;
      companySlug: string;
    },
  ) {
    if (!applicantEmail) return;
    const ticketUrl = `${config.FRONTEND_ORIGIN}/tickets/${payload.ticketId}`;
    await emailService.sendCompanyTicketApplicantEmail(applicantEmail, {
      companyName: payload.companyName,
      title: payload.title,
      content: payload.content,
      ticketUrl,
    });
  }
}

