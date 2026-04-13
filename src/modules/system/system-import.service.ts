import ExcelJS from 'exceljs';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import {
  PROVINCES,
  getProvinceNameByCode,
  resolveProvinceCode,
} from '@/shared/provinces';

// ── Slugify (mirrors shared/provinces but exported for company names) ──

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value: string): string {
  return normalizeText(value).replace(/\s+/g, '-');
}

// ── Types ──

interface ImportError {
  sheet: 'company' | 'job';
  row: number;
  field?: string;
  message: string;
}

export interface ImportReport {
  totalCompanies: number;
  successCompanies: number;
  failedCompanies: number;
  totalJobs: number;
  successJobs: number;
  failedJobs: number;
  skippedJobs: number;
  errors: ImportError[];
  duration: number;
}

interface ParsedCompany {
  row: number;
  name: string;
  legalName?: string | undefined;
  tagline?: string | undefined;
  description?: string | undefined;
  website?: string | undefined;
  logoUrl?: string | undefined;
  location?: string | null | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  industry?: string | undefined;
  size?: string | undefined;
  foundedYear?: number | undefined;
  /** Ảnh section Giới thiệu chung (profile.training.image) */
  introductionImageUrl?: string | undefined;
}

interface ParsedJob {
  row: number;
  companyName: string;
  title: string;
  generalInfo: string;
  mission: string;
  tasks: string;
  knowledge: string;
  skills: string;
  attitude: string;
  locations?: string[] | undefined;
  remote?: boolean | undefined;
  salaryMin?: number | undefined;
  salaryMax?: number | undefined;
  employmentType?: string | undefined;
  experienceLevel?: string | undefined;
  department?: string | undefined;
  jobLevel?: string | undefined;
  educationLevel?: string | undefined;
  applicationDeadline?: Date | undefined;
  tags?: string[] | undefined;
  kpis?: string | undefined;
  authority?: string | undefined;
  relationships?: string | undefined;
  careerPath?: string | undefined;
  benefitsIncome?: string | undefined;
  benefitsPerks?: string | undefined;
  contact?: string | undefined;
}

// ── Enum values for validation ──

const EMPLOYMENT_TYPES = new Set([
  'FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE',
]);
const EXPERIENCE_LEVELS = new Set([
  'NO_EXPERIENCE', 'LT_1_YEAR', 'Y1_2', 'Y2_3', 'Y3_5', 'Y5_10', 'GT_10',
]);
const JOB_LEVELS = new Set([
  'INTERN_STUDENT', 'FRESH_GRAD', 'EMPLOYEE', 'SPECIALIST_TEAM_LEAD',
  'MANAGER_HEAD', 'DIRECTOR', 'EXECUTIVE',
]);
const EDUCATION_LEVELS = new Set([
  'NONE', 'HIGH_SCHOOL', 'COLLEGE', 'BACHELOR', 'MASTER', 'PHD',
]);

const BATCH_SIZE = 50;

// ── Helpers ──

function cellToString(cell: ExcelJS.CellValue): string {
  if (cell == null) return '';
  if (typeof cell === 'object' && 'richText' in (cell as ExcelJS.CellRichTextValue)) {
    return (cell as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join('');
  }
  if (typeof cell === 'object' && 'text' in (cell as ExcelJS.CellHyperlinkValue)) {
    return (cell as ExcelJS.CellHyperlinkValue).text;
  }
  return String(cell).trim();
}

function cellToNumber(cell: ExcelJS.CellValue): number | undefined {
  if (cell == null) return undefined;
  const n = Number(cell);
  return Number.isFinite(n) ? n : undefined;
}

function cellToBoolean(cell: ExcelJS.CellValue): boolean {
  if (cell == null) return false;
  if (typeof cell === 'boolean') return cell;
  const s = String(cell).trim().toLowerCase();
  return ['true', '1', 'yes', 'có', 'co'].includes(s);
}

function resolveLocationNames(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ── Template generation ──

export async function generateTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  // Sheet 1: Công ty
  const companySheet = wb.addWorksheet('Công ty');
  companySheet.columns = [
    { header: 'Tên công ty (*)', key: 'name', width: 30 },
    { header: 'Tên pháp lý', key: 'legalName', width: 30 },
    { header: 'Tagline', key: 'tagline', width: 30 },
    { header: 'Mô tả', key: 'description', width: 40 },
    { header: 'Website', key: 'website', width: 25 },
    { header: 'URL logo', key: 'logoUrl', width: 40 },
    { header: 'Tỉnh/Thành', key: 'location', width: 20 },
    { header: 'Email', key: 'email', width: 25 },
    { header: 'Số điện thoại', key: 'phone', width: 15 },
    { header: 'Ngành nghề', key: 'industry', width: 20 },
    { header: 'Quy mô', key: 'size', width: 15 },
    { header: 'Năm thành lập', key: 'foundedYear', width: 15 },
    { header: 'URL ảnh giới thiệu (tuỳ chọn)', key: 'introductionImageUrl', width: 40 },
  ];
  companySheet.getRow(1).font = { bold: true };
  companySheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  };
  companySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Sheet 2: Tin tuyển dụng
  const jobSheet = wb.addWorksheet('Tin tuyển dụng');
  jobSheet.columns = [
    { header: 'Tên công ty (*)', key: 'companyName', width: 30 },
    { header: 'Tiêu đề (*)', key: 'title', width: 35 },
    { header: 'Thông tin chung (*)', key: 'generalInfo', width: 40 },
    { header: 'Sứ mệnh (*)', key: 'mission', width: 40 },
    { header: 'Nhiệm vụ (*)', key: 'tasks', width: 40 },
    { header: 'Kiến thức (*)', key: 'knowledge', width: 40 },
    { header: 'Kỹ năng (*)', key: 'skills', width: 40 },
    { header: 'Thái độ (*)', key: 'attitude', width: 40 },
    { header: 'Địa điểm (tỉnh/thành, phân cách dấu phẩy)', key: 'locations', width: 25 },
    { header: 'Remote (true/false)', key: 'remote', width: 15 },
    { header: 'Lương tối thiểu', key: 'salaryMin', width: 15 },
    { header: 'Lương tối đa', key: 'salaryMax', width: 15 },
    { header: 'Loại hình', key: 'employmentType', width: 18 },
    { header: 'Kinh nghiệm', key: 'experienceLevel', width: 18 },
    { header: 'Bộ phận', key: 'department', width: 20 },
    { header: 'Cấp bậc', key: 'jobLevel', width: 22 },
    { header: 'Học vấn', key: 'educationLevel', width: 15 },
    { header: 'Hạn ứng tuyển (YYYY-MM-DD)', key: 'applicationDeadline', width: 22 },
    { header: 'Tags (phân cách dấu phẩy)', key: 'tags', width: 25 },
    { header: 'KPIs', key: 'kpis', width: 30 },
    { header: 'Quyền hạn', key: 'authority', width: 30 },
    { header: 'Quan hệ công việc', key: 'relationships', width: 30 },
    { header: 'Lộ trình phát triển', key: 'careerPath', width: 30 },
    { header: 'Thu nhập', key: 'benefitsIncome', width: 25 },
    { header: 'Phúc lợi', key: 'benefitsPerks', width: 30 },
    { header: 'Liên hệ', key: 'contact', width: 25 },
  ];
  jobSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  jobSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF548235' },
  };

  // Data validation dropdowns for enum columns
  const maxRows = 5000;
  const enumValidation = (values: string[]): ExcelJS.DataValidation => ({
    type: 'list',
    allowBlank: true,
    formulae: [`"${values.join(',')}"`],
    showErrorMessage: true,
    errorTitle: 'Giá trị không hợp lệ',
    error: `Chỉ chấp nhận: ${values.join(', ')}`,
  });

  for (let r = 2; r <= maxRows; r++) {
    jobSheet.getCell(r, 13).dataValidation = enumValidation([...EMPLOYMENT_TYPES]);
    jobSheet.getCell(r, 14).dataValidation = enumValidation([...EXPERIENCE_LEVELS]);
    jobSheet.getCell(r, 16).dataValidation = enumValidation([...JOB_LEVELS]);
    jobSheet.getCell(r, 17).dataValidation = enumValidation([...EDUCATION_LEVELS]);
  }

  // Sheet 3: Tỉnh thành (tham khảo)
  const provinceSheet = wb.addWorksheet('Tỉnh thành (tham khảo)');
  provinceSheet.columns = [
    { header: 'Tên tỉnh/thành', key: 'name', width: 25 },
    { header: 'Mã', key: 'code', width: 18 },
    { header: 'Vùng miền', key: 'region', width: 12 },
  ];
  provinceSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  provinceSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF7F7F7F' },
  };
  for (const p of PROVINCES) {
    provinceSheet.addRow({ name: p.name, code: p.code, region: p.region });
  }

  const arrayBuf = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuf as ArrayBuffer);
}

// ── Parsing ──

function parseCompanySheet(
  ws: ExcelJS.Worksheet,
  errors: ImportError[],
): ParsedCompany[] {
  const results: ParsedCompany[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    const name = cellToString(row.getCell(1));
    if (!name) {
      errors.push({ sheet: 'company', row: rowNumber, field: 'name', message: 'Tên công ty không được để trống' });
      return;
    }

    results.push({
      row: rowNumber,
      name,
      legalName: cellToString(row.getCell(2)) || undefined,
      tagline: cellToString(row.getCell(3)) || undefined,
      description: cellToString(row.getCell(4)) || undefined,
      website: cellToString(row.getCell(5)) || undefined,
      logoUrl: cellToString(row.getCell(6)) || undefined,
      location: cellToString(row.getCell(7)) || undefined,
      email: cellToString(row.getCell(8)) || undefined,
      phone: cellToString(row.getCell(9)) || undefined,
      industry: cellToString(row.getCell(10)) || undefined,
      size: cellToString(row.getCell(11)) || undefined,
      foundedYear: cellToNumber(row.getCell(12)),
      introductionImageUrl: cellToString(row.getCell(13)) || undefined,
    });
  });
  return results;
}

function parseJobSheet(
  ws: ExcelJS.Worksheet,
  errors: ImportError[],
): ParsedJob[] {
  const results: ParsedJob[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const companyName = cellToString(row.getCell(1));
    const title = cellToString(row.getCell(2));
    const generalInfo = cellToString(row.getCell(3));
    const mission = cellToString(row.getCell(4));
    const tasks = cellToString(row.getCell(5));
    const knowledge = cellToString(row.getCell(6));
    const skills = cellToString(row.getCell(7));
    const attitude = cellToString(row.getCell(8));

    const rowErrors: string[] = [];
    if (!companyName) rowErrors.push('Tên công ty');
    if (!title) rowErrors.push('Tiêu đề');
    if (!generalInfo) rowErrors.push('Thông tin chung');
    if (!mission) rowErrors.push('Sứ mệnh');
    if (!tasks) rowErrors.push('Nhiệm vụ');
    if (!knowledge) rowErrors.push('Kiến thức');
    if (!skills) rowErrors.push('Kỹ năng');
    if (!attitude) rowErrors.push('Thái độ');

    if (rowErrors.length) {
      errors.push({
        sheet: 'job',
        row: rowNumber,
        message: `Thiếu trường bắt buộc: ${rowErrors.join(', ')}`,
      });
      return;
    }

    const empType = cellToString(row.getCell(13)).toUpperCase();
    if (empType && !EMPLOYMENT_TYPES.has(empType)) {
      errors.push({ sheet: 'job', row: rowNumber, field: 'employmentType', message: `Loại hình không hợp lệ: ${empType}` });
      return;
    }

    const expLevel = cellToString(row.getCell(14)).toUpperCase();
    if (expLevel && !EXPERIENCE_LEVELS.has(expLevel)) {
      errors.push({ sheet: 'job', row: rowNumber, field: 'experienceLevel', message: `Kinh nghiệm không hợp lệ: ${expLevel}` });
      return;
    }

    const jLevel = cellToString(row.getCell(16)).toUpperCase();
    if (jLevel && !JOB_LEVELS.has(jLevel)) {
      errors.push({ sheet: 'job', row: rowNumber, field: 'jobLevel', message: `Cấp bậc không hợp lệ: ${jLevel}` });
      return;
    }

    const eduLevel = cellToString(row.getCell(17)).toUpperCase();
    if (eduLevel && !EDUCATION_LEVELS.has(eduLevel)) {
      errors.push({ sheet: 'job', row: rowNumber, field: 'educationLevel', message: `Học vấn không hợp lệ: ${eduLevel}` });
      return;
    }

    let deadline: Date | undefined;
    const deadlineRaw = cellToString(row.getCell(18));
    if (deadlineRaw) {
      const d = new Date(deadlineRaw);
      if (Number.isNaN(d.getTime())) {
        errors.push({ sheet: 'job', row: rowNumber, field: 'applicationDeadline', message: `Ngày không hợp lệ: ${deadlineRaw}` });
        return;
      }
      d.setUTCHours(12, 0, 0, 0);
      deadline = d;
    }

    const tagsRaw = cellToString(row.getCell(19));
    const tags = tagsRaw
      ? tagsRaw.split(/[,;|]/).map((t) => t.trim()).filter(Boolean)
      : [];

    results.push({
      row: rowNumber,
      companyName,
      title,
      generalInfo,
      mission,
      tasks,
      knowledge,
      skills,
      attitude,
      locations: resolveLocationNames(cellToString(row.getCell(9))),
      remote: cellToBoolean(row.getCell(10)),
      salaryMin: cellToNumber(row.getCell(11)),
      salaryMax: cellToNumber(row.getCell(12)),
      employmentType: empType || undefined,
      experienceLevel: expLevel || undefined,
      department: cellToString(row.getCell(15)) || undefined,
      jobLevel: jLevel || undefined,
      educationLevel: eduLevel || undefined,
      applicationDeadline: deadline,
      tags,
      kpis: cellToString(row.getCell(20)) || undefined,
      authority: cellToString(row.getCell(21)) || undefined,
      relationships: cellToString(row.getCell(22)) || undefined,
      careerPath: cellToString(row.getCell(23)) || undefined,
      benefitsIncome: cellToString(row.getCell(24)) || undefined,
      benefitsPerks: cellToString(row.getCell(25)) || undefined,
      contact: cellToString(row.getCell(26)) || undefined,
    });
  });
  return results;
}

// ── Slug dedup ──

async function buildUniqueSlugMap(companies: ParsedCompany[]): Promise<Map<number, string>> {
  const baseSlugByRow = new Map<number, string>();
  for (const c of companies) {
    baseSlugByRow.set(c.row, slugify(c.name));
  }

  const allBases = new Set(baseSlugByRow.values());
  const existingSlugs = new Set<string>();
  for (const base of allBases) {
    const matches = await prisma.company.findMany({
      where: { slug: { startsWith: base } },
      select: { slug: true },
    });
    for (const m of matches) existingSlugs.add(m.slug);
  }

  // Also track slugs we assign within the same batch to avoid duplicates
  const assignedSlugs = new Set<string>();
  const result = new Map<number, string>();

  for (const c of companies) {
    const base = baseSlugByRow.get(c.row)!;
    let candidate = base;
    let counter = 2;

    while (existingSlugs.has(candidate) || assignedSlugs.has(candidate)) {
      candidate = `${base}-${counter}`;
      counter++;
    }

    assignedSlugs.add(candidate);
    result.set(c.row, candidate);
  }

  return result;
}

// ── Location resolution ──

function resolveCompanyLocation(
  locationName: string | null | undefined,
  row: number,
  errors: ImportError[],
): string | null {
  if (!locationName) return null;
  const code = resolveProvinceCode(locationName);
  if (!code) {
    errors.push({
      sheet: 'company',
      row,
      field: 'location',
      message: `Không tìm thấy tỉnh/thành: "${locationName}"`,
    });
    return null;
  }
  return code;
}

function resolveJobLocations(
  names: string[],
  row: number,
  errors: ImportError[],
): string[] {
  const codes: string[] = [];
  for (const name of names) {
    const code = resolveProvinceCode(name);
    if (!code) {
      errors.push({
        sheet: 'job',
        row,
        field: 'locations',
        message: `Không tìm thấy tỉnh/thành: "${name}"`,
      });
    } else {
      codes.push(code);
    }
  }
  return [...new Set(codes)];
}

// ── Main import ──

export async function importCompaniesAndJobs(
  fileBuffer: Buffer,
  adminUserId: string,
): Promise<ImportReport> {
  const startTime = Date.now();
  const errors: ImportError[] = [];

  // Parse Excel
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(new Uint8Array(fileBuffer).buffer as ArrayBuffer);
  } catch {
    throw new AppError('File Excel không hợp lệ hoặc bị lỗi', 400, 'INVALID_FILE');
  }

  const companySheet = wb.getWorksheet('Công ty') ?? wb.getWorksheet(1);
  const jobSheet = wb.getWorksheet('Tin tuyển dụng') ?? wb.getWorksheet(2);

  if (!companySheet || !jobSheet) {
    throw new AppError(
      'File Excel phải có ít nhất 2 sheet: "Công ty" và "Tin tuyển dụng"',
      400,
      'MISSING_SHEETS',
    );
  }

  // Parse rows
  const parsedCompanies = parseCompanySheet(companySheet, errors);
  const parsedJobs = parseJobSheet(jobSheet, errors);

  if (parsedCompanies.length === 0) {
    throw new AppError('Sheet "Công ty" không có dữ liệu hợp lệ', 400, 'EMPTY_COMPANIES');
  }

  // Build slug map
  const slugMap = await buildUniqueSlugMap(parsedCompanies);

  // Build company name → parsedCompany mapping (for linking jobs)
  const companyByName = new Map<string, ParsedCompany>();
  for (const c of parsedCompanies) {
    const key = c.name.toLowerCase().trim();
    if (companyByName.has(key)) {
      errors.push({
        sheet: 'company',
        row: c.row,
        field: 'name',
        message: `Tên công ty trùng lặp trong file: "${c.name}"`,
      });
    } else {
      companyByName.set(key, c);
    }
  }

  // Validate that each job references a valid company
  const validJobs: ParsedJob[] = [];
  for (const job of parsedJobs) {
    const key = job.companyName.toLowerCase().trim();
    if (!companyByName.has(key)) {
      errors.push({
        sheet: 'job',
        row: job.row,
        field: 'companyName',
        message: `Không tìm thấy công ty "${job.companyName}" trong sheet Công ty`,
      });
    } else {
      validJobs.push(job);
    }
  }

  // Remove duplicate companies (keep first occurrence)
  const uniqueCompanies: ParsedCompany[] = [];
  const seenNames = new Set<string>();
  for (const c of parsedCompanies) {
    const key = c.name.toLowerCase().trim();
    if (!seenNames.has(key)) {
      seenNames.add(key);
      uniqueCompanies.push(c);
    }
  }

  // Resolve locations for companies
  const companyLocationMap = new Map<number, string | null>();
  for (const c of uniqueCompanies) {
    const code = resolveCompanyLocation(c.location, c.row, errors);
    companyLocationMap.set(c.row, code);
  }

  // Process in batches
  let successCompanies = 0;
  let failedCompanies = 0;
  let successJobs = 0;
  let failedJobs = 0;
  let skippedJobs = 0;

  const createdCompanyIdByName = new Map<string, string>();

  const batches: ParsedCompany[][] = [];
  for (let i = 0; i < uniqueCompanies.length; i += BATCH_SIZE) {
    batches.push(uniqueCompanies.slice(i, i + BATCH_SIZE));
  }

  for (const batch of batches) {
    try {
      await prisma.$transaction(async (tx) => {
        for (const company of batch) {
          const slug = slugMap.get(company.row)!;
          const locationCode = companyLocationMap.get(company.row) ?? null;
          const locationDisplayName =
            locationCode != null ? (getProvinceNameByCode(locationCode) ?? null) : null;

          const created = await tx.company.create({
            data: {
              name: company.name,
              slug,
              legalName: company.legalName ?? null,
              tagline: company.tagline ?? null,
              description: company.description ?? null,
              website: company.website ?? null,
              logoUrl: company.logoUrl ?? null,
              location: locationDisplayName,
              email: company.email ?? null,
              phone: company.phone ?? null,
              industry: company.industry ?? null,
              size: company.size ?? null,
              foundedYear: company.foundedYear ?? null,
            },
          });

          await tx.companyMember.create({
            data: {
              userId: adminUserId,
              companyId: created.id,
              role: 'OWNER',
            },
          });

          const hasIntroTraining =
            company.description ||
            company.size ||
            company.introductionImageUrl;
          const trainingJson: Prisma.InputJsonValue = {
            programs: [],
            ...(company.description ? { description: company.description } : {}),
            ...(company.size ? { workforceSize: company.size } : {}),
            ...(company.introductionImageUrl ? { image: company.introductionImageUrl } : {}),
          };

          if (hasIntroTraining) {
            await tx.companyProfile.create({
              data: {
                companyId: created.id,
                training: trainingJson,
              },
            });
          } else {
            await tx.companyProfile.create({
              data: { companyId: created.id },
            });
          }

          createdCompanyIdByName.set(company.name.toLowerCase().trim(), created.id);
          successCompanies++;
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      for (const c of batch) {
        errors.push({
          sheet: 'company',
          row: c.row,
          message: `Batch lỗi: ${msg}`,
        });
      }
      failedCompanies += batch.length;
    }
  }

  // Create jobs for successfully created companies
  const jobsByCompany = new Map<string, ParsedJob[]>();
  for (const job of validJobs) {
    const key = job.companyName.toLowerCase().trim();
    if (!jobsByCompany.has(key)) jobsByCompany.set(key, []);
    jobsByCompany.get(key)!.push(job);
  }

  for (const [companyKey, jobs] of jobsByCompany) {
    const companyId = createdCompanyIdByName.get(companyKey);
    if (!companyId) {
      skippedJobs += jobs.length;
      for (const job of jobs) {
        errors.push({
          sheet: 'job',
          row: job.row,
          message: `Bỏ qua vì công ty "${job.companyName}" tạo không thành công`,
        });
      }
      continue;
    }

    // Batch jobs in groups of 100
    const jobBatches: ParsedJob[][] = [];
    for (let i = 0; i < jobs.length; i += 100) {
      jobBatches.push(jobs.slice(i, i + 100));
    }

    for (const jobBatch of jobBatches) {
      try {
        await prisma.$transaction(async (tx) => {
          for (const job of jobBatch) {
            const locationCodes = resolveJobLocations(job.locations ?? [], job.row, errors);

            await tx.job.create({
              data: {
                companyId,
                title: job.title,
                generalInfo: job.generalInfo,
                mission: job.mission,
                tasks: job.tasks,
                knowledge: job.knowledge,
                skills: job.skills,
                attitude: job.attitude,
                locations: locationCodes,
                remote: job.remote ?? false,
                salaryMin: job.salaryMin ?? null,
                salaryMax: job.salaryMax ?? null,
                currency: 'VND',
                employmentType: (job.employmentType as 'FULL_TIME') ?? 'FULL_TIME',
                experienceLevel: (job.experienceLevel as 'NO_EXPERIENCE') ?? 'NO_EXPERIENCE',
                department: job.department ?? null,
                jobLevel: (job.jobLevel as 'EMPLOYEE') ?? null,
                educationLevel: (job.educationLevel as 'BACHELOR') ?? null,
                applicationDeadline: job.applicationDeadline ?? null,
                tags: job.tags ?? [],
                kpis: job.kpis ?? null,
                authority: job.authority ?? null,
                relationships: job.relationships ?? null,
                careerPath: job.careerPath ?? null,
                benefitsIncome: job.benefitsIncome ?? null,
                benefitsPerks: job.benefitsPerks ?? null,
                contact: job.contact ?? null,
                isActive: true,
              },
            });
            successJobs++;
          }
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        for (const job of jobBatch) {
          errors.push({
            sheet: 'job',
            row: job.row,
            message: `Batch lỗi: ${msg}`,
          });
        }
        failedJobs += jobBatch.length;
      }
    }
  }

  return {
    totalCompanies: uniqueCompanies.length,
    successCompanies,
    failedCompanies,
    totalJobs: parsedJobs.length,
    successJobs,
    failedJobs,
    skippedJobs,
    errors,
    duration: Date.now() - startTime,
  };
}
