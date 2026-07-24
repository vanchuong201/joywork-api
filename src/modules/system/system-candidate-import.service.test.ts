import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SystemCandidateImportService } from './system-candidate-import.service';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/shared/database/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('@/config/env', () => ({
  config: {
    FRONTEND_ORIGIN: 'http://localhost:3000',
  },
}));

vi.mock('@/shared/services/email.service', () => ({
  emailService: {
    sendCandidateOnboardingEmail: vi.fn(),
  },
}));

vi.mock('@/shared/services/send-email-async', () => ({
  sendEmailInBackground: vi.fn(),
}));

describe('SystemCandidateImportService.dryRun', () => {
  const service = new SystemCandidateImportService();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findMany.mockResolvedValue([
      {
        email: 'existing@example.com',
      },
    ]);
  });

  it('parse CSV, dedupe email và phân loại link đúng trong dry-run', async () => {
    const csv = [
      'Email,Họ tên,Link CV,Link Portfolio',
      'new@example.com,Nguyen A,https://drive.google.com/file/d/abc/view,',
      'existing@example.com,Nguyen B,https://linkedin.com/in/nguyenb,',
      'new@example.com,Nguyen C,https://docs.google.com/document/d/xyz/edit,',
      'invalid-email,Nguyen D,https://canva.com/design/abc,',
      ',Nguyen E,,',
    ].join('\n');

    const report = await service.dryRun(Buffer.from(csv), 'candidates.csv', 'text/csv');

    expect(report.totalRows).toBe(5);
    expect(report.validRows).toBe(1);
    expect(report.existingRows).toBe(1);
    expect(report.duplicateRows).toBe(1);
    expect(report.invalidRows).toBe(2);
    expect(report.linkSummary.autoFetchable).toBe(2);
    expect(report.linkSummary.manualUpload).toBe(2);
    expect(report.linkSummary.empty).toBe(1);

    expect(report.rows[0]?.status).toBe('VALID');
    expect(report.rows[0]?.linkAction).toBe('AUTO_FETCHABLE');
    expect(report.rows[1]?.status).toBe('EXISTING_EMAIL');
    expect(report.rows[1]?.linkAction).toBe('MANUAL_UPLOAD');
    expect(report.rows[2]?.status).toBe('DUPLICATE_EMAIL_IN_FILE');
    expect(report.rows[3]?.status).toBe('INVALID');
    expect(report.rows[4]?.status).toBe('INVALID');
    expect(report.rows[4]?.issues).toContain('Thiếu email');
  });
});
