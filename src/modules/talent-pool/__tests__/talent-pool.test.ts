import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TalentPoolService } from '../talent-pool.service';

vi.mock('@/shared/database/prisma', () => ({
  prisma: {
    talentPoolMember: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    talentPoolRequest: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    talentPoolLog: {
      create: vi.fn(),
    },
    companyMember: {
      findMany: vi.fn(),
    },
    companyFeatureEntitlement: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb({
      talentPoolRequest: {
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      talentPoolMember: {
        upsert: vi.fn(),
        update: vi.fn(),
      },
      talentPoolLog: {
        create: vi.fn(),
      },
    })),
  },
}));

vi.mock('@/shared/services/email.service', () => ({
  emailService: {
    sendTalentPoolApprovedEmail: vi.fn(),
    sendTalentPoolRejectedEmail: vi.fn(),
    sendTalentPoolRemovedEmail: vi.fn(),
    sendTalentPoolAdminAddedEmail: vi.fn(),
  },
}));

vi.mock('@/config/env', () => ({
  config: {
    FRONTEND_ORIGIN: 'http://localhost:3000',
  },
}));

import { prisma } from '@/shared/database/prisma';
import { emailService } from '@/shared/services/email.service';

const service = new TalentPoolService();

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  slug: 'test-user',
  emailVerified: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TalentPoolService', () => {

  describe('getMyStatus', () => {
    it('returns member and latest request', async () => {
      const member = { id: 'm1', status: 'ACTIVE', source: 'SELF_REQUEST', reason: null, createdAt: new Date() };
      const request = { id: 'r1', status: 'APPROVED', message: null, reason: null, createdAt: new Date(), reviewedAt: new Date() };

      vi.mocked(prisma.talentPoolMember.findUnique).mockResolvedValue(member as never);
      vi.mocked(prisma.talentPoolRequest.findFirst).mockResolvedValue(request as never);

      const result = await service.getMyStatus('user-1');
      expect(result.member).toEqual(member);
      expect(result.latestRequest).toEqual(request);
    });
  });

  describe('createRequest', () => {
    it('creates a request when no active membership or pending request', async () => {
      vi.mocked(prisma.talentPoolMember.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.talentPoolRequest.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.talentPoolRequest.create).mockResolvedValue({
        id: 'r1', status: 'PENDING', message: 'Hello', createdAt: new Date(),
      } as never);
      vi.mocked(prisma.talentPoolLog.create).mockResolvedValue({} as never);

      const result = await service.createRequest('user-1', 'Hello');
      expect(result.id).toBe('r1');
      expect(result.status).toBe('PENDING');
    });

    it('throws ALREADY_MEMBER if user is active member', async () => {
      vi.mocked(prisma.talentPoolMember.findUnique).mockResolvedValue({ status: 'ACTIVE' } as never);

      await expect(service.createRequest('user-1')).rejects.toThrow('Bạn đã là thành viên Talent Pool');
    });

    it('throws PENDING_REQUEST_EXISTS if pending request exists', async () => {
      vi.mocked(prisma.talentPoolMember.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.talentPoolRequest.findFirst).mockResolvedValue({ id: 'r1', status: 'PENDING' } as never);

      await expect(service.createRequest('user-1')).rejects.toThrow('Bạn đã có yêu cầu đang chờ duyệt');
    });
  });

  describe('approveRequest', () => {
    it('approves a PENDING request and sends email', async () => {
      vi.mocked(prisma.talentPoolRequest.findUnique).mockResolvedValue({
        id: 'r1',
        status: 'PENDING',
        userId: 'user-1',
        user: mockUser,
      } as never);

      vi.mocked(prisma.$transaction).mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
        await cb({
          talentPoolRequest: { update: vi.fn() },
          talentPoolMember: { upsert: vi.fn() },
          talentPoolLog: { create: vi.fn() },
        });
      });

      const result = await service.approveRequest('r1', 'admin-1');
      expect(result.success).toBe(true);
      expect(emailService.sendTalentPoolApprovedEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({ name: 'Test User' }),
      );
    });

    it('throws if request not PENDING', async () => {
      vi.mocked(prisma.talentPoolRequest.findUnique).mockResolvedValue({
        id: 'r1',
        status: 'APPROVED',
        userId: 'user-1',
        user: mockUser,
      } as never);

      await expect(service.approveRequest('r1', 'admin-1')).rejects.toThrow('Yêu cầu đã được xử lý');
    });
  });

  describe('rejectRequest', () => {
    it('rejects a PENDING request with reason and sends email', async () => {
      vi.mocked(prisma.talentPoolRequest.findUnique).mockResolvedValue({
        id: 'r1',
        status: 'PENDING',
        userId: 'user-1',
        user: mockUser,
      } as never);

      vi.mocked(prisma.$transaction).mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
        await cb({
          talentPoolRequest: { update: vi.fn() },
          talentPoolLog: { create: vi.fn() },
        });
      });

      const result = await service.rejectRequest('r1', 'admin-1', 'Profile incomplete');
      expect(result.success).toBe(true);
      expect(emailService.sendTalentPoolRejectedEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({ reason: 'Profile incomplete' }),
      );
    });
  });

  describe('adminAddMember', () => {
    it('adds user by email', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);
      vi.mocked(prisma.talentPoolMember.findUnique).mockResolvedValue(null);

      vi.mocked(prisma.$transaction).mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
        await cb({
          talentPoolMember: { upsert: vi.fn() },
          talentPoolRequest: { updateMany: vi.fn() },
          talentPoolLog: { create: vi.fn() },
        });
      });

      const result = await service.adminAddMember('admin-1', {
        email: 'test@example.com',
        reason: 'Great candidate',
      });
      expect(result.success).toBe(true);
      expect(emailService.sendTalentPoolAdminAddedEmail).toHaveBeenCalled();
    });

    it('throws if user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        service.adminAddMember('admin-1', { email: 'nope@example.com', reason: 'test' }),
      ).rejects.toThrow('Không tìm thấy người dùng');
    });

    it('throws if user already active member', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as never);
      vi.mocked(prisma.talentPoolMember.findUnique).mockResolvedValue({ status: 'ACTIVE' } as never);

      await expect(
        service.adminAddMember('admin-1', { email: 'test@example.com', reason: 'test' }),
      ).rejects.toThrow('Người dùng đã là thành viên Talent Pool');
    });
  });

  describe('removeMember', () => {
    it('removes an active member and sends email', async () => {
      vi.mocked(prisma.talentPoolMember.findUnique).mockResolvedValue({
        id: 'm1',
        status: 'ACTIVE',
        userId: 'user-1',
        user: mockUser,
      } as never);

      vi.mocked(prisma.$transaction).mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
        await cb({
          talentPoolMember: { update: vi.fn() },
          talentPoolLog: { create: vi.fn() },
        });
      });

      const result = await service.removeMember('m1', 'admin-1', 'Inactive');
      expect(result.success).toBe(true);
      expect(emailService.sendTalentPoolRemovedEmail).toHaveBeenCalled();
    });
  });

  describe('checkAccess', () => {
    it('returns hasAccess: true when user is OWNER/ADMIN of premium company', async () => {
      vi.mocked(prisma.companyMember.findMany).mockResolvedValue([
        { companyId: 'c1' },
      ] as never);
      vi.mocked(prisma.companyFeatureEntitlement.findFirst).mockResolvedValue({
        id: 'e1',
        enabled: true,
      } as never);

      const result = await service.checkAccess('user-1');
      expect(result.hasAccess).toBe(true);
    });

    it('returns hasAccess: false when no eligible company', async () => {
      vi.mocked(prisma.companyMember.findMany).mockResolvedValue([]);

      const result = await service.checkAccess('user-1');
      expect(result.hasAccess).toBe(false);
      expect(result.reason).toBe('NO_ELIGIBLE_COMPANY');
    });

    it('returns hasAccess: false when no premium entitlement', async () => {
      vi.mocked(prisma.companyMember.findMany).mockResolvedValue([
        { companyId: 'c1' },
      ] as never);
      vi.mocked(prisma.companyFeatureEntitlement.findFirst).mockResolvedValue(null);

      const result = await service.checkAccess('user-1');
      expect(result.hasAccess).toBe(false);
      expect(result.reason).toBe('NO_PREMIUM_ACCESS');
    });
  });

  describe('lookupUserByEmail', () => {
    it('returns user with talent pool status', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockUser,
        accountStatus: 'ACTIVE',
        profile: { avatar: null, headline: 'Dev', location: 'HCMC' },
        talentPoolMember: null,
      } as never);

      const result = await service.lookupUserByEmail('test@example.com');
      expect(result.email).toBe('test@example.com');
    });

    it('throws if user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(service.lookupUserByEmail('nope@example.com')).rejects.toThrow('Không tìm thấy người dùng');
    });
  });

  describe('toggleEntitlement', () => {
    it('enables talent pool for a company', async () => {
      vi.mocked(prisma.company.findUnique).mockResolvedValue({ id: 'c1' } as never);
      vi.mocked(prisma.companyFeatureEntitlement.upsert).mockResolvedValue({} as never);

      const result = await service.toggleEntitlement('c1', true);
      expect(result.companyId).toBe('c1');
      expect(result.enabled).toBe(true);
    });

    it('throws if company not found', async () => {
      vi.mocked(prisma.company.findUnique).mockResolvedValue(null);

      await expect(service.toggleEntitlement('nope', true)).rejects.toThrow('Không tìm thấy công ty');
    });
  });
});
