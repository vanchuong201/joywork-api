import ExcelJS from 'exceljs';
import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import { normalizeSeoPath, parseDestination } from './seo-urls.destinations';
import { collectSeoWarnings, SeoUrlsService } from './seo-urls.service';
import { createSeoUrlSchema, SEO_IMPORT_MIME_TYPES } from './seo-urls.schema';

export const SEO_IMPORT_COLUMNS = ['SEO URL', 'Original URL', 'Title', 'Description'] as const;

type RawRow = {
  rowNumber: number;
  seoPath: string;
  originalPath: string;
  title: string;
  description: string;
};

export type ImportRowReport = {
  rowNumber: number;
  seoPath: string;
  originalPath: string;
  title: string;
  description: string;
  status: 'READY' | 'ERROR';
  errors: string[];
  warnings: string[];
  normalizedSeoPath: string | null;
  normalizedOriginalPath: string | null;
  resultCount: number | null;
};

export type ImportDryRunReport = {
  fileName: string;
  totalRows: number;
  readyRows: number;
  errorRows: number;
  warningRows: number;
  rows: ImportRowReport[];
};

export type ImportCommitReport = {
  fileName: string;
  createdCount: number;
  skippedCount: number;
  created: string[];
  skipped: Array<{ rowNumber: number; seoPath: string; reason: string }>;
};

const HEADER_ALIASES: Record<string, keyof Omit<RawRow, 'rowNumber'>> = {
  'seo url': 'seoPath',
  'seo urls': 'seoPath',
  'seo friendly url': 'seoPath',
  'seo-friendly url': 'seoPath',
  'url seo': 'seoPath',
  'original url': 'originalPath',
  'origin url': 'originalPath',
  'url goc': 'originalPath',
  'url gốc': 'originalPath',
  title: 'title',
  'meta title': 'title',
  description: 'description',
  'meta description': 'description',
};

function normalizeCell(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('text' in value && typeof value.text === 'string') return value.text.trim();
    if ('hyperlink' in value && typeof value.hyperlink === 'string') return value.hyperlink.trim();
    if ('result' in value) return normalizeCell(value.result as ExcelJS.CellValue);
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join('').trim();
    }
  }
  return String(value).trim();
}

function headerKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Nhận diện hàng header và trả vị trí từng cột theo tên, không phụ thuộc thứ tự. */
function detectColumns(matrix: string[][]): { headerIndex: number; columns: Record<keyof Omit<RawRow, 'rowNumber'>, number> } {
  for (let rowIndex = 0; rowIndex < Math.min(matrix.length, 10); rowIndex += 1) {
    const columns: Partial<Record<keyof Omit<RawRow, 'rowNumber'>, number>> = {};
    (matrix[rowIndex] ?? []).forEach((cell, cellIndex) => {
      const field = HEADER_ALIASES[headerKey(cell)];
      if (field && columns[field] === undefined) {
        columns[field] = cellIndex;
      }
    });

    if (
      columns.seoPath !== undefined &&
      columns.originalPath !== undefined &&
      columns.title !== undefined &&
      columns.description !== undefined
    ) {
      return {
        headerIndex: rowIndex,
        columns: {
          seoPath: columns.seoPath,
          originalPath: columns.originalPath,
          title: columns.title,
          description: columns.description,
        },
      };
    }
  }

  throw new AppError(
    `File thiếu cột bắt buộc. Cần đủ 4 cột: ${SEO_IMPORT_COLUMNS.join(' | ')}`,
    400,
    'IMPORT_MISSING_COLUMNS',
  );
}

export class SeoUrlsImportService {
  constructor(private readonly seoUrlsService: SeoUrlsService = new SeoUrlsService()) {}

  private async readMatrix(fileBuffer: Buffer, mime: string): Promise<string[][]> {
    if (!SEO_IMPORT_MIME_TYPES.includes(mime as (typeof SEO_IMPORT_MIME_TYPES)[number])) {
      throw new AppError('Chỉ chấp nhận file Excel (.xlsx)', 400, 'IMPORT_INVALID_FILE_TYPE');
    }
    if (fileBuffer.length === 0) {
      throw new AppError('File rỗng', 400, 'IMPORT_EMPTY_FILE');
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
    worksheet.eachRow((row, rowNumber) => {
      const maxCell = Math.max(row.actualCellCount, row.cellCount);
      const values: string[] = [];
      for (let i = 1; i <= maxCell; i += 1) {
        values.push(normalizeCell(row.getCell(i).value));
      }
      matrix[rowNumber - 1] = values;
    });

    return Array.from(matrix, (row) => row ?? []);
  }

  private parseRows(matrix: string[][]): RawRow[] {
    const { headerIndex, columns } = detectColumns(matrix);
    const rows: RawRow[] = [];

    for (let rowIndex = headerIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
      const cells = matrix[rowIndex] ?? [];
      const row: RawRow = {
        rowNumber: rowIndex + 1,
        seoPath: cells[columns.seoPath] ?? '',
        originalPath: cells[columns.originalPath] ?? '',
        title: cells[columns.title] ?? '',
        description: cells[columns.description] ?? '',
      };
      if (!row.seoPath && !row.originalPath && !row.title && !row.description) continue;
      rows.push(row);
    }

    if (rows.length === 0) {
      throw new AppError('File không có dòng dữ liệu nào', 400, 'IMPORT_NO_ROWS');
    }

    return rows;
  }

  private async validateRows(rows: RawRow[]): Promise<ImportRowReport[]> {
    const seenSeoPaths = new Map<string, number>();
    const seenDestinations = new Map<string, number>();
    const reports: ImportRowReport[] = [];

    for (const row of rows) {
      const errors: string[] = [];
      const warnings: string[] = [];
      let normalizedSeoPath: string | null = null;
      let normalizedOriginalPath: string | null = null;
      let destinationKey: string | null = null;
      let resultCount: number | null = null;

      const parsedFields = createSeoUrlSchema.safeParse({
        seoPath: row.seoPath,
        originalPath: row.originalPath,
        title: row.title,
        description: row.description,
      });
      if (!parsedFields.success) {
        errors.push(...parsedFields.error.issues.map((issue) => issue.message));
      }

      try {
        normalizedSeoPath = normalizeSeoPath(row.seoPath);
      } catch (error) {
        errors.push(error instanceof AppError ? error.message : 'SEO URL không hợp lệ');
      }

      try {
        const destination = parseDestination(row.originalPath);
        normalizedOriginalPath = destination.originalPath;
        destinationKey = destination.key;
        warnings.push(...destination.warnings);
      } catch (error) {
        errors.push(error instanceof AppError ? error.message : 'URL gốc không hợp lệ');
      }

      if (normalizedSeoPath) {
        const duplicateRow = seenSeoPaths.get(normalizedSeoPath);
        if (duplicateRow) {
          errors.push(`SEO URL trùng với dòng ${duplicateRow} trong file`);
        } else {
          seenSeoPaths.set(normalizedSeoPath, row.rowNumber);
          const existing = await prisma.seoUrlMapping.findUnique({ where: { seoPath: normalizedSeoPath } });
          if (existing) {
            errors.push(`SEO URL đã tồn tại trong hệ thống (${existing.status})`);
          }
        }
      }

      // Nhiều SEO URL trỏ cùng bộ lọc là hợp lệ: dòng sau thành alias, canonical
      // trỏ về URL chính của nhóm nên chỉ cảnh báo để admin biết.
      if (destinationKey) {
        const duplicateRow = seenDestinations.get(destinationKey);
        if (duplicateRow) {
          warnings.push(`Cùng bộ lọc với dòng ${duplicateRow} trong file, sẽ tạo dưới dạng alias`);
        } else {
          seenDestinations.set(destinationKey, row.rowNumber);
        }

        const existing = await prisma.seoUrlMapping.findFirst({
          where: { destinationKey, status: { not: 'ARCHIVED' } },
          orderBy: [{ isCanonical: 'desc' }, { publishedAt: 'asc' }, { createdAt: 'asc' }],
          select: { seoPath: true },
        });
        if (existing) {
          warnings.push(`Cùng bộ lọc với ${existing.seoPath}, canonical sẽ trỏ về URL chính của nhóm`);
        }
      }

      if (parsedFields.success) {
        warnings.push(
          ...collectSeoWarnings({ title: parsedFields.data.title, description: parsedFields.data.description }),
        );
      }

      if (errors.length === 0 && normalizedOriginalPath) {
        try {
          const preview = await this.seoUrlsService.preview({ originalPath: normalizedOriginalPath });
          resultCount = preview.resultCount;
          if (!preview.hasResults) {
            warnings.push('Bộ lọc hiện không có việc làm nào, trang sẽ được noindex tới khi có kết quả');
          }
        } catch {
          resultCount = null;
        }
      }

      reports.push({
        rowNumber: row.rowNumber,
        seoPath: row.seoPath,
        originalPath: row.originalPath,
        title: row.title,
        description: row.description,
        status: errors.length > 0 ? 'ERROR' : 'READY',
        errors,
        warnings,
        normalizedSeoPath,
        normalizedOriginalPath,
        resultCount,
      });
    }

    return reports;
  }

  async dryRun(fileBuffer: Buffer, fileName: string, mime: string): Promise<ImportDryRunReport> {
    const matrix = await this.readMatrix(fileBuffer, mime);
    const rows = await this.validateRows(this.parseRows(matrix));

    return {
      fileName,
      totalRows: rows.length,
      readyRows: rows.filter((row) => row.status === 'READY').length,
      errorRows: rows.filter((row) => row.status === 'ERROR').length,
      warningRows: rows.filter((row) => row.warnings.length > 0).length,
      rows,
    };
  }

  /** Chỉ tạo các dòng READY, luôn ở trạng thái Draft để admin kiểm duyệt trước khi publish. */
  async commit(fileBuffer: Buffer, fileName: string, mime: string): Promise<ImportCommitReport> {
    const matrix = await this.readMatrix(fileBuffer, mime);
    const rows = await this.validateRows(this.parseRows(matrix));

    const created: string[] = [];
    const skipped: Array<{ rowNumber: number; seoPath: string; reason: string }> = [];

    for (const row of rows) {
      if (row.status === 'ERROR') {
        skipped.push({
          rowNumber: row.rowNumber,
          seoPath: row.seoPath,
          reason: row.errors[0] ?? 'Dòng không hợp lệ',
        });
        continue;
      }

      try {
        const dto = await this.seoUrlsService.create({
          seoPath: row.normalizedSeoPath ?? row.seoPath,
          originalPath: row.normalizedOriginalPath ?? row.originalPath,
          title: row.title,
          description: row.description,
        });
        created.push(dto.seoPath);
      } catch (error) {
        skipped.push({
          rowNumber: row.rowNumber,
          seoPath: row.seoPath,
          reason: error instanceof AppError ? error.message : 'Tạo SEO URL thất bại',
        });
      }
    }

    return {
      fileName,
      createdCount: created.length,
      skippedCount: skipped.length,
      created,
      skipped,
    };
  }
}
