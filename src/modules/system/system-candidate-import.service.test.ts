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
    ONBOARDING_TOKEN_TTL_DAYS: 90,
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

  it('phân loại canva.link là CANVA và ưu tiên Portfolio auto khi CV không auto', async () => {
    const csv = [
      'Email,Họ tên,Link CV,Link Portfolio',
      'a@example.com,A,https://canva.link/abc123,https://drive.google.com/file/d/xyz/view',
      'b@example.com,B,https://drive.google.com/drive/folders/folder1,',
    ].join('\n');

    const report = await service.dryRun(Buffer.from(csv), 'links.csv', 'text/csv');

    expect(report.rows[0]?.cvLinkType).toBe('DRIVE_FILE');
    expect(report.rows[0]?.linkAction).toBe('AUTO_FETCHABLE');
    expect(report.rows[0]?.portfolioLink).toContain('drive.google.com/file');
    expect(report.rows[1]?.cvLinkType).toBe('FOLDER');
    expect(report.rows[1]?.linkAction).toBe('MANUAL_UPLOAD');
    expect(report.linkSummary.autoFetchable).toBe(1);
    expect(report.linkSummary.manualUpload).toBe(1);
  });

  it('loại bỏ link CV/Portfolio không hợp lệ và ghi cảnh báo', async () => {
    const csv = [
      'Email,Họ tên,Link CV,Link Portfolio,Link Social',
      'candidate@example.com,Nguyen F,Oki,Vang,https://linkedin.com/in/nguyenf',
    ].join('\n');

    const report = await service.dryRun(Buffer.from(csv), 'invalid-links.csv', 'text/csv');

    expect(report.totalRows).toBe(1);
    expect(report.validRows).toBe(1);
    expect(report.linkSummary.empty).toBe(1);
    expect(report.linkSummary.manualUpload).toBe(0);

    expect(report.rows[0]?.status).toBe('VALID');
    expect(report.rows[0]?.cvLink).toBeNull();
    expect(report.rows[0]?.portfolioLink).toBeNull();
    expect(report.rows[0]?.socialLink).toBe('https://linkedin.com/in/nguyenf');
    expect(report.rows[0]?.issues).toContain('Link CV không hợp lệ (chỉ chấp nhận URL http/https)');
    expect(report.rows[0]?.issues).toContain('Link Portfolio không hợp lệ (chỉ chấp nhận URL http/https)');
  });
});

describe('deriveCvStatus', () => {
  it('AUTO không còn chờ activate — queued khi chưa có job', async () => {
    const { deriveCvStatus } = await import('./system-candidate-import.service');
    expect(deriveCvStatus('DRIVE_FILE', null, null)).toBe('CV_AUTO_QUEUED');
    expect(deriveCvStatus('DRIVE_FILE', new Date(), null)).toBe('CV_AUTO_QUEUED');
    expect(deriveCvStatus('DRIVE_FILE', null, 'PROCESSING')).toBe('CV_AUTO_PROCESSING');
    expect(deriveCvStatus('DRIVE_FILE', null, 'APPLIED')).toBe('CV_APPLIED');
    expect(deriveCvStatus('DRIVE_FILE', null, 'FAILED')).toBe('CV_AUTO_FAILED');
    expect(deriveCvStatus('CANVA', null, null)).toBe('CV_MANUAL_PENDING');
    expect(deriveCvStatus('EMPTY', null, null)).toBe('CV_EMPTY');
  });
});
