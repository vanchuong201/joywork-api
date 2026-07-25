import { createHash, randomBytes } from 'crypto';
import path from 'path';
import ExcelJS from 'exceljs';
import { CandidateCvLinkType, CandidateImportRecordStatus, Prisma } from '@prisma/client';
import { prisma } from '@/shared/database/prisma';
import { config } from '@/config/env';
import { AppError } from '@/shared/errors/errorHandler';
import { emailService } from '@/shared/services/email.service';
import { sendEmailInBackground } from '@/shared/services/send-email-async';
import { hashPassword } from '@/shared/security/password-hash';
import { resolveUniqueUserSlug } from '@/modules/users/user-profile.service';
import { resolveProvinceCode } from '@/shared/provinces';
import { getWardsByProvinceCode } from '@/shared/wards';
import {
  CANDIDATE_IMPORT_MIME_TYPES,
  type CandidateImportDryRunReport,
  type CandidateImportDryRunRow,
  type CandidateImportLinkAction,
  type CandidateImportRow,
} from './system-candidate-import.schema';

const ONBOARDING_TOKEN_TTL_MS = config.ONBOARDING_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
const ADMIN_RESEND_COOLDOWN_MS = 2 * 60 * 1000;
const EMAIL_BATCH_SIZE = 20;
const EMAIL_BATCH_DELAY_MS = 5_000;
const EMAIL_INTRA_DELAY_MS = 300;

interface ParsedImportPayload {
  fileName: string;
  rows: CandidateImportRow[];
}

interface CommitResultSummary {
  batchId: string;
  totalRows: number;
  created: number;
  skipped: number;
  failed: number;
  records: Array<{
    id: string;
    rowNumber: number;
    email: string | null;
    status: CandidateImportRecordStatus;
    error: string | null;
  }>;
}

interface CandidateRowWithMeta extends CandidateImportDryRunRow {
  normalizedEmail: string | null;
  safeSocialLink: string | null;
  safeCvLink: string | null;
  safePortfolioLink: string | null;
}

interface ScheduledEmailPayload {
  email: string;
  name: string | null;
  rawToken: string;
}

const AUTO_FETCHABLE_TYPES = new Set<CandidateCvLinkType>(['DRIVE_FILE', 'DRIVE_DOC']);

const WARD_PREFIXES = ['phuong', 'p', 'xa', 'x', 'thi-tran', 'tt'];

interface HeaderIndexes {
  email: number | null;
  name: number | null;
  phone: number | null;
  province: number | null;
  district: number | null;
  position: number | null;
  salary: number | null;
  experience: number | null;
  socialLink: number | null;
  cvLink: number | null;
  portfolioLink: number | null;
}

function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeCell(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return Number.isFinite(value) ? String(value).trim() : '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';

  if (typeof value === 'object') {
    const candidate = value as { text?: string; richText?: Array<{ text?: string }> };
    if (typeof candidate.text === 'string') return candidate.text.trim();
    if (Array.isArray(candidate.richText)) {
      return candidate.richText
        .map((item) => item?.text ?? '')
        .join('')
        .trim();
    }
  }

  return String(value).trim();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizePhone(raw: string | null): string | null {
  if (!raw) return null;
  const normalized = raw.replace(/[^\d+]/g, '').trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeEmail(raw: string | null): string | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizeExternalUrl(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (!parsed.hostname) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function classifyCvLink(link: string | null | undefined): CandidateCvLinkType {
  if (!link) return 'EMPTY';
  const normalized = link.toLowerCase();

  if (normalized.includes('drive.google.com/drive/folders/')) return 'FOLDER';
  if (normalized.includes('drive.google.com/file/')) return 'DRIVE_FILE';
  if (normalized.includes('docs.google.com/document/')) return 'DRIVE_DOC';
  if (normalized.includes('canva.com/')) return 'CANVA';
  if (normalized.includes('linkedin.com/')) return 'LINKEDIN';
  return 'OTHER';
}

function toLinkAction(type: CandidateCvLinkType): CandidateImportLinkAction {
  if (type === 'EMPTY') return 'EMPTY';
  if (AUTO_FETCHABLE_TYPES.has(type)) return 'AUTO_FETCHABLE';
  return 'MANUAL_UPLOAD';
}

function extractPreferredLink(row: CandidateImportRow): string | null {
  return row.cvLink || row.portfolioLink || null;
}

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  const pushCell = () => {
    currentRow.push(currentCell);
    currentCell = '';
  };

  const pushRow = () => {
    rows.push(currentRow);
    currentRow = [];
  };

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i]!;
    const next = content[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        currentCell += '"';
        i += 1;
        continue;
      }
      if (char === '"') {
        inQuotes = false;
        continue;
      }
      currentCell += char;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ',') {
      pushCell();
      continue;
    }
    if (char === '\r') {
      continue;
    }
    if (char === '\n') {
      pushCell();
      pushRow();
      continue;
    }
    currentCell += char;
  }

  pushCell();
  pushRow();
  return rows;
}

function resolveHeaderIndexes(headers: string[]): HeaderIndexes {
  const normalized = headers.map((header) => normalizeHeader(header));
  const used = new Set<number>();

  const find = (predicates: Array<(value: string) => boolean>): number | null => {
    for (const predicate of predicates) {
      const idx = normalized.findIndex((value, index) => !used.has(index) && predicate(value));
      if (idx >= 0) {
        used.add(idx);
        return idx;
      }
    }
    return null;
  };

  const contains = (token: string) => (value: string) => value.includes(token);

  const portfolioLink = find([contains('portfolio')]);
  const cvLink = find([
    contains('link-cv'),
    contains('cv-link'),
    (value) => value.includes('cv') && !value.includes('portfolio'),
  ]);

  return {
    email: find([contains('email')]),
    name: find([
      contains('ho-ten'),
      contains('ho-va-ten'),
      contains('ten-ung-vien'),
      contains('full-name'),
      (value) => value === 'ten',
    ]),
    phone: find([contains('so-dien-thoai'), contains('dien-thoai'), contains('phone'), contains('sdt')]),
    province: find([contains('tinh'), contains('thanh-pho'), contains('province'), contains('dia-diem')]),
    district: find([contains('quan'), contains('huyen'), contains('district')]),
    position: find([contains('vi-tri'), contains('chuc-danh'), contains('position'), contains('title')]),
    salary: find([contains('luong'), contains('salary'), contains('thu-nhap')]),
    experience: find([contains('kinh-nghiem'), contains('experience')]),
    socialLink: find([contains('social'), contains('facebook'), contains('linkedin'), contains('mang-xa-hoi')]),
    cvLink,
    portfolioLink,
  };
}

function pickCell(values: string[], index: number | null): string | null {
  if (index == null) return null;
  const raw = values[index];
  if (!raw) return null;
  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseRowsFromMatrix(fileName: string, matrix: string[][]): ParsedImportPayload {
  if (matrix.length === 0) {
    throw new AppError('File import không có dữ liệu', 400, 'IMPORT_EMPTY_FILE');
  }

  const headerRow = matrix[0]!.map((item) => item.replace(/^\uFEFF/, '').trim());
  const indexes = resolveHeaderIndexes(headerRow);

  if (indexes.email == null) {
    throw new AppError('Không tìm thấy cột email trong file import', 400, 'IMPORT_EMAIL_COLUMN_REQUIRED');
  }

  const rows: CandidateImportRow[] = [];
  for (let rowIndex = 1; rowIndex < matrix.length; rowIndex += 1) {
    const values = matrix[rowIndex]!.map((item) => item.trim());
    const hasData = values.some((value) => value.length > 0);
    if (!hasData) continue;

    rows.push({
      rowNumber: rowIndex + 1,
      email: pickCell(values, indexes.email),
      name: pickCell(values, indexes.name),
      phone: pickCell(values, indexes.phone),
      province: pickCell(values, indexes.province),
      district: pickCell(values, indexes.district),
      position: pickCell(values, indexes.position),
      salary: pickCell(values, indexes.salary),
      experience: pickCell(values, indexes.experience),
      socialLink: pickCell(values, indexes.socialLink),
      cvLink: pickCell(values, indexes.cvLink),
      portfolioLink: pickCell(values, indexes.portfolioLink),
    });
  }

  return { fileName, rows };
}

function sanitizeWardText(raw: string): string {
  let normalized = normalizeHeader(raw);
  for (const prefix of WARD_PREFIXES) {
    if (normalized.startsWith(`${prefix}-`)) {
      normalized = normalized.slice(prefix.length + 1);
      break;
    }
  }
  return normalized;
}

function resolveWardCodeFromDistrict(rawDistrict: string | null, provinceCode: string | null): string[] {
  if (!rawDistrict || !provinceCode) return [];
  const expected = sanitizeWardText(rawDistrict);
  if (!expected) return [];

  const wards = getWardsByProvinceCode(provinceCode);
  const candidates = wards.filter((ward) => {
    const name = sanitizeWardText(ward.name);
    const full = sanitizeWardText(ward.fullName ?? '');
    return name === expected || full === expected || name.includes(expected) || full.includes(expected);
  });

  if (candidates.length !== 1) return [];
  return [candidates[0]!.code];
}

function createOnboardingToken(): { raw: string; hash: string; expiresAt: Date } {
  const raw = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(Date.now() + ONBOARDING_TOKEN_TTL_MS);
  return { raw, hash, expiresAt };
}

function buildActivationUrl(rawToken: string): string {
  return `${config.FRONTEND_ORIGIN}/onboarding?token=${encodeURIComponent(rawToken)}`;
}

function scheduleOnboardingEmail(payload: ScheduledEmailPayload, delayMs: number): void {
  setTimeout(() => {
    sendEmailInBackground(
      () => emailService.sendCandidateOnboardingEmail(payload.email, payload.name, buildActivationUrl(payload.rawToken)),
      `candidate onboarding email ${payload.email}`,
    );
  }, delayMs);
}

export class SystemCandidateImportService {
  async parseImportFile(fileBuffer: Buffer, fileName: string, mime: string): Promise<ParsedImportPayload> {
    if (!CANDIDATE_IMPORT_MIME_TYPES.includes(mime as (typeof CANDIDATE_IMPORT_MIME_TYPES)[number])) {
      throw new AppError('Chỉ chấp nhận file CSV hoặc Excel (.xlsx)', 400, 'IMPORT_INVALID_FILE_TYPE');
    }
    if (fileBuffer.length === 0) {
      throw new AppError('File rỗng', 400, 'IMPORT_EMPTY_FILE');
    }

    const ext = path.extname(fileName).toLowerCase();
    if (ext === '.csv' || mime === 'text/csv' || mime === 'application/csv') {
      const content = fileBuffer.toString('utf-8');
      const matrix = parseCsvRows(content);
      return parseRowsFromMatrix(fileName, matrix);
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(new Uint8Array(fileBuffer).buffer as ArrayBuffer);
    } catch {
      throw new AppError('File Excel không hợp lệ hoặc bị lỗi', 400, 'IMPORT_INVALID_EXCEL');
    }

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new AppError('File Excel không có sheet dữ liệu', 400, 'IMPORT_EMPTY_EXCEL');
    }

    const matrix: string[][] = [];
    worksheet.eachRow((row) => {
      const maxCell = Math.max(row.actualCellCount, row.cellCount);
      const values: string[] = [];
      for (let i = 1; i <= maxCell; i += 1) {
        values.push(normalizeCell(row.getCell(i).value));
      }
      matrix.push(values);
    });

    return parseRowsFromMatrix(fileName, matrix);
  }

  async dryRun(fileBuffer: Buffer, fileName: string, mime: string): Promise<CandidateImportDryRunReport> {
    const parsed = await this.parseImportFile(fileBuffer, fileName, mime);
    const rows = await this.buildRowsWithStatus(parsed.rows);
    return this.buildDryRunReport(parsed.fileName, rows);
  }

  async commit(fileBuffer: Buffer, fileName: string, mime: string, adminUserId: string): Promise<CommitResultSummary> {
    const parsed = await this.parseImportFile(fileBuffer, fileName, mime);
    const rows = await this.buildRowsWithStatus(parsed.rows);

    const batch = await prisma.candidateImportBatch.create({
      data: {
        createdByAdminId: adminUserId,
        fileName: parsed.fileName,
        totalRows: rows.length,
        created: 0,
        skipped: 0,
        failed: 0,
      },
    });

    let created = 0;
    let skipped = 0;
    let failed = 0;
    const records: CommitResultSummary['records'] = [];
    const emailQueue: ScheduledEmailPayload[] = [];

    for (const row of rows) {
      if (row.status === 'INVALID' || row.status === 'DUPLICATE_EMAIL_IN_FILE') {
        const record = await prisma.candidateImportRecord.create({
          data: {
            batchId: batch.id,
            email: row.email ?? '',
            rawName: row.name,
            rawPhone: row.phone,
            rawProvince: row.province,
            rawDistrict: row.district,
            rawPosition: row.position,
            rawSalary: row.salary,
            rawExperience: row.experience,
            rawSocialLink: row.safeSocialLink,
            rawCvLink: row.safeCvLink,
            rawPortfolioLink: row.safePortfolioLink,
            cvLinkType: row.cvLinkType,
            status: 'FAILED',
            error: row.issues.join('; '),
          },
        });
        failed += 1;
        records.push({
          id: record.id,
          rowNumber: row.rowNumber,
          email: row.email,
          status: record.status,
          error: record.error,
        });
        continue;
      }

      if (!row.normalizedEmail) {
        failed += 1;
        continue;
      }

      const existing = await prisma.user.findUnique({
        where: { email: row.normalizedEmail },
        select: { id: true },
      });

      if (existing) {
        const record = await prisma.candidateImportRecord.create({
          data: {
            batchId: batch.id,
            userId: existing.id,
            email: row.normalizedEmail,
            rawName: row.name,
            rawPhone: row.phone,
            rawProvince: row.province,
            rawDistrict: row.district,
            rawPosition: row.position,
            rawSalary: row.salary,
            rawExperience: row.experience,
            rawSocialLink: row.safeSocialLink,
            rawCvLink: row.safeCvLink,
            rawPortfolioLink: row.safePortfolioLink,
            cvLinkType: row.cvLinkType,
            status: 'SKIPPED_EXISTING',
          },
        });
        skipped += 1;
        records.push({
          id: record.id,
          rowNumber: row.rowNumber,
          email: row.email,
          status: record.status,
          error: null,
        });
        continue;
      }

      const fallbackName = row.name || row.normalizedEmail.split('@')[0] || 'Ứng viên';
      const normalizedPhone = normalizePhone(row.phone);
      const provinceCode = resolveProvinceCode(row.province ?? row.district);
      const wardCodes = resolveWardCodeFromDistrict(row.district, provinceCode);

      const randomPassword = randomBytes(16).toString('hex');
      const hashedPassword = await hashPassword(randomPassword);

      try {
        const result = await prisma.$transaction(async (tx) => {
          const slug = await resolveUniqueUserSlug({
            name: fallbackName,
            email: row.normalizedEmail!,
          });

          const user = await tx.user.create({
            data: {
              email: row.normalizedEmail!,
              password: hashedPassword,
              name: fallbackName,
              phone: normalizedPhone,
              role: 'USER',
              slug,
              emailVerified: false,
            },
          });

          await tx.userProfile.create({
            data: {
              userId: user.id,
              fullName: fallbackName,
              title: row.position,
              contactEmail: row.normalizedEmail,
              contactPhone: normalizedPhone,
              locations: provinceCode ? [provinceCode] : [],
              wardCodes,
              linkedin: row.safeSocialLink?.toLowerCase().includes('linkedin.com') ? row.safeSocialLink : null,
            },
          });

          const token = createOnboardingToken();

          await tx.onboardingToken.create({
            data: {
              userId: user.id,
              batchId: batch.id,
              tokenHash: token.hash,
              expiresAt: token.expiresAt,
            },
          });

          const record = await tx.candidateImportRecord.create({
            data: {
              batchId: batch.id,
              userId: user.id,
              email: row.normalizedEmail!,
              rawName: row.name,
              rawPhone: row.phone,
              rawProvince: row.province,
              rawDistrict: row.district,
              rawPosition: row.position,
              rawSalary: row.salary,
              rawExperience: row.experience,
              rawSocialLink: row.safeSocialLink,
              rawCvLink: row.safeCvLink,
              rawPortfolioLink: row.safePortfolioLink,
              cvLinkType: row.cvLinkType,
              status: 'CREATED',
            },
          });

          return {
            record,
            tokenRaw: token.raw,
            email: user.email,
            name: user.name,
          };
        });

        created += 1;
        records.push({
          id: result.record.id,
          rowNumber: row.rowNumber,
          email: row.email,
          status: result.record.status,
          error: null,
        });

        emailQueue.push({
          email: result.email,
          name: result.name,
          rawToken: result.tokenRaw,
        });
      } catch (error) {
        const message =
          error instanceof AppError
            ? error.message
            : error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
              ? 'Email đã tồn tại trong hệ thống'
              : 'Không thể tạo tài khoản ứng viên';

        const record = await prisma.candidateImportRecord.create({
          data: {
            batchId: batch.id,
            email: row.normalizedEmail,
            rawName: row.name,
            rawPhone: row.phone,
            rawProvince: row.province,
            rawDistrict: row.district,
            rawPosition: row.position,
            rawSalary: row.salary,
            rawExperience: row.experience,
            rawSocialLink: row.safeSocialLink,
            rawCvLink: row.safeCvLink,
            rawPortfolioLink: row.safePortfolioLink,
            cvLinkType: row.cvLinkType,
            status: 'FAILED',
            error: message,
          },
        });
        failed += 1;
        records.push({
          id: record.id,
          rowNumber: row.rowNumber,
          email: row.email,
          status: record.status,
          error: record.error,
        });
      }
    }

    await prisma.candidateImportBatch.update({
      where: { id: batch.id },
      data: {
        created,
        skipped,
        failed,
      },
    });

    emailQueue.forEach((payload, index) => {
      const batchOffset = Math.floor(index / EMAIL_BATCH_SIZE) * EMAIL_BATCH_DELAY_MS;
      const withinBatchOffset = (index % EMAIL_BATCH_SIZE) * EMAIL_INTRA_DELAY_MS;
      scheduleOnboardingEmail(payload, batchOffset + withinBatchOffset);
    });

    return {
      batchId: batch.id,
      totalRows: rows.length,
      created,
      skipped,
      failed,
      records,
    };
  }

  async adminResend(recordId: string): Promise<{ message: string; expiresAt: string }> {
    const record = await prisma.candidateImportRecord.findUnique({
      where: { id: recordId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!record || !record.userId || !record.user) {
      throw new AppError('Không tìm thấy bản ghi import hợp lệ để gửi lại', 404, 'CANDIDATE_IMPORT_RECORD_NOT_FOUND');
    }

    if (record.activatedAt) {
      throw new AppError('Ứng viên đã kích hoạt tài khoản', 409, 'ONBOARDING_ALREADY_ACTIVATED');
    }

    const latestToken = await prisma.onboardingToken.findFirst({
      where: {
        userId: record.userId,
        batchId: record.batchId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (latestToken) {
      const elapsed = Date.now() - latestToken.createdAt.getTime();
      if (elapsed < ADMIN_RESEND_COOLDOWN_MS) {
        throw new AppError('Vui lòng chờ trước khi gửi lại email kích hoạt', 429, 'ONBOARDING_RESEND_COOLDOWN');
      }
    }

    const token = createOnboardingToken();
    await prisma.onboardingToken.create({
      data: {
        userId: record.userId,
        batchId: record.batchId,
        tokenHash: token.hash,
        expiresAt: token.expiresAt,
      },
    });

    scheduleOnboardingEmail(
      {
        email: record.user.email,
        name: record.user.name,
        rawToken: token.raw,
      },
      0,
    );

    return {
      message: 'Đã lên lịch gửi lại email kích hoạt',
      expiresAt: token.expiresAt.toISOString(),
    };
  }

  private async buildRowsWithStatus(rows: CandidateImportRow[]): Promise<CandidateRowWithMeta[]> {
    const uniqueEmails = Array.from(
      new Set(
        rows
          .map((row) => normalizeEmail(row.email))
          .filter((email): email is string => Boolean(email)),
      ),
    );

    const existingUsers = uniqueEmails.length
      ? await prisma.user.findMany({
        where: { email: { in: uniqueEmails } },
        select: { email: true },
      })
      : [];
    const existingEmailSet = new Set(existingUsers.map((item) => item.email.toLowerCase()));

    const seenEmails = new Set<string>();

    return rows.map((row) => {
      const normalizedEmail = normalizeEmail(row.email);
      const issues: string[] = [];
      let status: CandidateRowWithMeta['status'] = 'VALID';
      const safeCvLink = normalizeExternalUrl(row.cvLink);
      const safePortfolioLink = normalizeExternalUrl(row.portfolioLink);
      const safeSocialLink = normalizeExternalUrl(row.socialLink);

      if (!normalizedEmail) {
        issues.push('Thiếu email');
        status = 'INVALID';
      } else if (!isValidEmail(normalizedEmail)) {
        issues.push('Email không hợp lệ');
        status = 'INVALID';
      } else if (seenEmails.has(normalizedEmail)) {
        issues.push('Email bị trùng trong file');
        status = 'DUPLICATE_EMAIL_IN_FILE';
      } else {
        seenEmails.add(normalizedEmail);
        if (existingEmailSet.has(normalizedEmail)) {
          issues.push('Email đã tồn tại trong hệ thống');
          status = 'EXISTING_EMAIL';
        }
      }

      if (row.cvLink && !safeCvLink) {
        issues.push('Link CV không hợp lệ (chỉ chấp nhận URL http/https)');
      }
      if (row.portfolioLink && !safePortfolioLink) {
        issues.push('Link Portfolio không hợp lệ (chỉ chấp nhận URL http/https)');
      }
      if (row.socialLink && !safeSocialLink) {
        issues.push('Link Social không hợp lệ (chỉ chấp nhận URL http/https)');
      }

      const preferredLink = extractPreferredLink({
        ...row,
        cvLink: safeCvLink,
        portfolioLink: safePortfolioLink,
      });
      const cvLinkType = classifyCvLink(preferredLink);

      return {
        ...row,
        normalizedEmail,
        safeSocialLink,
        safeCvLink,
        safePortfolioLink,
        status,
        issues,
        cvLinkType,
        linkAction: toLinkAction(cvLinkType),
      };
    });
  }

  private buildDryRunReport(fileName: string, rows: CandidateRowWithMeta[]): CandidateImportDryRunReport {
    let validRows = 0;
    let existingRows = 0;
    let duplicateRows = 0;
    let invalidRows = 0;
    let autoFetchable = 0;
    let manualUpload = 0;
    let empty = 0;

    const byType: Record<CandidateCvLinkType, number> = {
      DRIVE_FILE: 0,
      DRIVE_DOC: 0,
      CANVA: 0,
      LINKEDIN: 0,
      FOLDER: 0,
      OTHER: 0,
      EMPTY: 0,
    };

    for (const row of rows) {
      if (row.status === 'VALID') validRows += 1;
      if (row.status === 'EXISTING_EMAIL') existingRows += 1;
      if (row.status === 'DUPLICATE_EMAIL_IN_FILE') duplicateRows += 1;
      if (row.status === 'INVALID') invalidRows += 1;

      byType[row.cvLinkType] = (byType[row.cvLinkType] ?? 0) + 1;
      if (row.linkAction === 'AUTO_FETCHABLE') autoFetchable += 1;
      if (row.linkAction === 'MANUAL_UPLOAD') manualUpload += 1;
      if (row.linkAction === 'EMPTY') empty += 1;
    }

    return {
      fileName,
      totalRows: rows.length,
      validRows,
      existingRows,
      duplicateRows,
      invalidRows,
      linkSummary: {
        autoFetchable,
        manualUpload,
        empty,
        byType,
      },
      rows: rows.map((row) => ({
        rowNumber: row.rowNumber,
        email: row.email,
        name: row.name,
        phone: row.phone,
        province: row.province,
        district: row.district,
        position: row.position,
        salary: row.salary,
        experience: row.experience,
        socialLink: row.safeSocialLink,
        cvLink: row.safeCvLink,
        portfolioLink: row.safePortfolioLink,
        status: row.status,
        issues: row.issues,
        cvLinkType: row.cvLinkType,
        linkAction: row.linkAction,
      })),
    };
  }
}
