import type { Prisma, SeoDestinationType, SeoUrlMapping, SeoUrlMappingStatus } from '@prisma/client';
import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import { JobsService } from '@/modules/jobs/jobs.service';
import { searchJobsSchema } from '@/modules/jobs/jobs.schema';
import {
  buildDestinationPath,
  destinationLabel,
  headingFromTitle,
  normalizeSeoPath,
  parseDestination,
  seoSlugFromPath,
  toJobSearchQuery,
  type DestinationParams,
} from './seo-urls.destinations';
import type { CreateSeoUrlInput, UpdateSeoUrlInput, AdminListQuery, PreviewInput } from './seo-urls.schema';
import {
  SEO_DESCRIPTION_RECOMMENDED_MAX,
  SEO_TITLE_RECOMMENDED_MAX,
} from './seo-urls.schema';

const jobsService = new JobsService();

export type DestinationRender = {
  items: unknown[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export type PublicSeoUrlDto = {
  id: string;
  seoPath: string;
  slug: string;
  title: string;
  description: string;
  heading: string;
  destinationType: SeoDestinationType;
  destinationParams: DestinationParams;
  originalPath: string;
  /** Đường dẫn mang canonical của nhóm cùng bộ lọc; bằng `seoPath` nếu chính nó là URL chính. */
  canonicalPath: string;
  isCanonical: boolean;
  hasResults: boolean;
  jobs: unknown[];
  pagination: DestinationRender['pagination'];
};

export type AdminSeoUrlDto = {
  id: string;
  seoPath: string;
  slug: string;
  title: string;
  description: string;
  heading: string;
  originalPath: string;
  destinationType: SeoDestinationType;
  destinationLabel: string;
  destinationParams: DestinationParams;
  destinationKey: string;
  isCanonical: boolean;
  /** SEO URL chính của nhóm cùng bộ lọc, `null` nếu nhóm chưa có URL chính. */
  canonicalPath: string | null;
  /** Số SEO URL khác cùng bộ lọc (không tính chính nó). */
  aliasCount: number;
  status: SeoUrlMappingStatus;
  publishedAt: string | null;
  resultCount: number | null;
  createdAt: string;
  updatedAt: string;
};

/** Thông tin nhóm mapping cùng `destinationKey` để dựng DTO admin. */
type DestinationGroup = { canonicalPath: string | null; total: number };

function parseStoredParams(value: Prisma.JsonValue): DestinationParams {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError('Bộ lọc đích của SEO URL không hợp lệ', 500, 'INVALID_DESTINATION');
  }
  const params: DestinationParams = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (raw === null || raw === undefined) continue;
    params[key] = String(raw);
  }
  return params;
}

function toAdminDto(
  row: SeoUrlMapping,
  resultCount: number | null = null,
  group: DestinationGroup = { canonicalPath: null, total: 1 },
): AdminSeoUrlDto {
  const destinationParams = parseStoredParams(row.destinationParams);
  return {
    id: row.id,
    seoPath: row.seoPath,
    slug: seoSlugFromPath(row.seoPath),
    title: row.title,
    description: row.description,
    heading: row.heading ?? headingFromTitle(row.title),
    originalPath: row.originalPath,
    destinationType: row.destinationType,
    destinationLabel: destinationLabel(row.destinationType),
    destinationParams,
    destinationKey: row.destinationKey,
    isCanonical: row.isCanonical,
    canonicalPath: group.canonicalPath ?? (row.isCanonical ? row.seoPath : null),
    aliasCount: Math.max(group.total - 1, 0),
    status: row.status,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    resultCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Render nội dung đích. Thêm case mới khi bổ sung destination type. */
async function renderDestination(
  type: SeoDestinationType,
  params: DestinationParams,
): Promise<DestinationRender> {
  switch (type) {
    case 'JOB_SEARCH': {
      const input = searchJobsSchema.parse(toJobSearchQuery(params));
      const result = await jobsService.searchJobs(input);
      return { items: result.jobs, pagination: result.pagination };
    }
    default:
      throw new AppError(`Loại trang đích chưa được hỗ trợ: ${type}`, 500, 'UNSUPPORTED_DESTINATION');
  }
}

export function collectSeoWarnings(input: { title: string; description: string }): string[] {
  const warnings: string[] = [];
  if (!/\|\s*JOYWORK\s*$/i.test(input.title)) {
    warnings.push('Title chưa có hậu tố "| JOYWORK"');
  }
  if (input.title.length > SEO_TITLE_RECOMMENDED_MAX) {
    warnings.push(`Title dài ${input.title.length} ký tự, khuyến nghị tối đa ${SEO_TITLE_RECOMMENDED_MAX}`);
  }
  if (input.description.length > SEO_DESCRIPTION_RECOMMENDED_MAX) {
    warnings.push(
      `Description dài ${input.description.length} ký tự, khuyến nghị tối đa ${SEO_DESCRIPTION_RECOMMENDED_MAX}`,
    );
  }
  return warnings;
}

export class SeoUrlsService {
  private async assertSeoPathFree(seoPath: string, excludeId?: string) {
    const existing = await prisma.seoUrlMapping.findUnique({ where: { seoPath } });
    if (existing && existing.id !== excludeId) {
      throw new AppError(`SEO URL đã tồn tại: ${seoPath}`, 409, 'SEO_PATH_TAKEN');
    }
  }

  /**
   * Nhiều SEO URL được phép trỏ cùng bộ lọc. Mỗi nhóm `destinationKey` giữ đúng
   * một URL chính (`isCanonical`) để nhận canonical và vào sitemap; các URL còn
   * lại vẫn truy cập được nhưng canonical trỏ về URL chính đó.
   */
  private async loadGroups(destinationKeys: string[]): Promise<Map<string, DestinationGroup>> {
    const keys = Array.from(new Set(destinationKeys));
    if (keys.length === 0) return new Map();

    const rows = await prisma.seoUrlMapping.findMany({
      where: { destinationKey: { in: keys } },
      select: { destinationKey: true, seoPath: true, isCanonical: true },
    });

    const groups = new Map<string, DestinationGroup>();
    for (const key of keys) groups.set(key, { canonicalPath: null, total: 0 });
    for (const row of rows) {
      const group = groups.get(row.destinationKey);
      if (!group) continue;
      group.total += 1;
      if (row.isCanonical) group.canonicalPath = row.seoPath;
    }
    return groups;
  }

  private async loadGroup(destinationKey: string): Promise<DestinationGroup> {
    const groups = await this.loadGroups([destinationKey]);
    return groups.get(destinationKey) ?? { canonicalPath: null, total: 0 };
  }

  /**
   * Đảm bảo nhóm luôn có một URL chính: ưu tiên bản Published cũ nhất, sau đó
   * tới Draft. Gọi sau khi thêm, sửa bộ lọc, đổi trạng thái hoặc xóa mapping.
   */
  private async ensureGroupCanonical(destinationKey: string) {
    const rows = await prisma.seoUrlMapping.findMany({
      where: { destinationKey, status: { not: 'ARCHIVED' } },
      orderBy: [{ publishedAt: 'asc' }, { createdAt: 'asc' }],
    });

    if (rows.length === 0) {
      await prisma.seoUrlMapping.updateMany({
        where: { destinationKey, isCanonical: true },
        data: { isCanonical: false },
      });
      return;
    }

    // Ưu tiên bản Published để sitemap và canonical luôn trỏ tới URL công khai;
    // nếu nhóm chưa publish bản nào thì tạm giữ ở Draft.
    const published = rows.filter((row) => row.status === 'PUBLISHED');
    const pool = published.length > 0 ? published : rows;
    const next = pool.find((row) => row.isCanonical) ?? pool[0];
    if (!next) return;

    if (next.isCanonical) {
      // Chỉ giữ lại một cờ canonical nếu dữ liệu cũ có nhiều bản cùng bật.
      await prisma.seoUrlMapping.updateMany({
        where: { destinationKey, isCanonical: true, id: { not: next.id } },
        data: { isCanonical: false },
      });
      return;
    }

    await this.setCanonical(next.id);
  }

  /** Đặt một mapping làm URL chính của nhóm, tự tắt cờ ở các mapping còn lại. */
  async setCanonical(id: string): Promise<AdminSeoUrlDto> {
    const current = await prisma.seoUrlMapping.findUnique({ where: { id } });
    if (!current) {
      throw new AppError('Không tìm thấy SEO URL', 404, 'NOT_FOUND');
    }
    if (current.status === 'ARCHIVED') {
      throw new AppError('SEO URL đã lưu trữ không thể làm URL chính', 400, 'ARCHIVED_CANNOT_BE_CANONICAL');
    }

    const [, row] = await prisma.$transaction([
      prisma.seoUrlMapping.updateMany({
        where: { destinationKey: current.destinationKey, id: { not: id } },
        data: { isCanonical: false },
      }),
      prisma.seoUrlMapping.update({ where: { id }, data: { isCanonical: true } }),
    ]);

    return toAdminDto(row, null, await this.loadGroup(row.destinationKey));
  }

  async preview(input: PreviewInput) {
    const destination = parseDestination(input.originalPath);
    const seoPath = input.seoPath ? normalizeSeoPath(input.seoPath) : null;
    const render = await renderDestination(destination.type, destination.params);

    const conflicts: string[] = [];
    if (seoPath) {
      const samePath = await prisma.seoUrlMapping.findUnique({ where: { seoPath } });
      if (samePath && samePath.id !== input.excludeId) {
        conflicts.push(`SEO URL đã tồn tại: ${seoPath}`);
      }
    }

    const siblings = await prisma.seoUrlMapping.findMany({
      where: {
        destinationKey: destination.key,
        status: { not: 'ARCHIVED' },
        ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      },
      orderBy: [{ isCanonical: 'desc' }, { publishedAt: 'asc' }, { createdAt: 'asc' }],
      select: { seoPath: true, isCanonical: true },
    });

    const canonicalSibling = siblings.find((row) => row.isCanonical) ?? siblings[0] ?? null;
    const notes = [...destination.warnings];
    if (canonicalSibling) {
      notes.push(
        `Cùng bộ lọc với ${siblings.length} SEO URL khác; canonical sẽ trỏ về URL chính ${canonicalSibling.seoPath}`,
      );
    }

    return {
      seoPath,
      destinationType: destination.type,
      destinationLabel: destinationLabel(destination.type),
      destinationParams: destination.params,
      normalizedOriginalPath: destination.originalPath,
      heading: input.title ? headingFromTitle(input.title) : null,
      resultCount: render.pagination.total,
      hasResults: render.pagination.total > 0,
      /** SEO URL cùng bộ lọc đang tồn tại — thông tin, không phải lỗi. */
      duplicates: siblings.map((row) => row.seoPath),
      canonicalPath: canonicalSibling?.seoPath ?? null,
      warnings: [
        ...notes,
        ...(input.title ? collectSeoWarnings({ title: input.title, description: '' }) : []),
      ],
      conflicts,
    };
  }

  /**
   * Nguồn cho sitemap: chỉ URL chính của mỗi nhóm để không đưa nhiều URL cùng
   * nội dung vào sitemap.
   */
  async listPublished(includeEmpty = false) {
    const rows = await prisma.seoUrlMapping.findMany({
      where: { status: 'PUBLISHED', isCanonical: true },
      orderBy: { updatedAt: 'desc' },
    });

    const pages = await Promise.all(
      rows.map(async (row) => {
        let hasResults = false;
        try {
          const render = await renderDestination(row.destinationType, parseStoredParams(row.destinationParams));
          hasResults = render.pagination.total > 0;
        } catch {
          hasResults = false;
        }
        return {
          seoPath: row.seoPath,
          slug: seoSlugFromPath(row.seoPath),
          updatedAt: row.updatedAt.toISOString(),
          hasResults,
        };
      }),
    );

    return includeEmpty ? pages : pages.filter((page) => page.hasResults);
  }

  /** Public resolver: chỉ trả bản Published, kèm nội dung đích đã render. */
  async resolvePublished(rawPath: string): Promise<PublicSeoUrlDto> {
    const seoPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    const row = await prisma.seoUrlMapping.findUnique({ where: { seoPath } });
    if (!row || row.status !== 'PUBLISHED') {
      throw new AppError('Không tìm thấy SEO URL', 404, 'NOT_FOUND');
    }

    const destinationParams = parseStoredParams(row.destinationParams);
    const render = await renderDestination(row.destinationType, destinationParams);

    // Alias trỏ canonical về URL chính đang Published; nếu URL chính không còn
    // Published thì alias tự canonical để trang vẫn index được.
    const canonicalRow = row.isCanonical
      ? row
      : await prisma.seoUrlMapping.findFirst({
          where: { destinationKey: row.destinationKey, isCanonical: true, status: 'PUBLISHED' },
          select: { seoPath: true },
        });

    return {
      id: row.id,
      seoPath: row.seoPath,
      slug: seoSlugFromPath(row.seoPath),
      title: row.title,
      description: row.description,
      heading: row.heading ?? headingFromTitle(row.title),
      destinationType: row.destinationType,
      destinationParams,
      originalPath: buildDestinationPath(row.destinationType, destinationParams),
      canonicalPath: canonicalRow?.seoPath ?? row.seoPath,
      isCanonical: row.isCanonical,
      hasResults: render.pagination.total > 0,
      jobs: render.items,
      pagination: render.pagination,
    };
  }

  async listAdmin(query: AdminListQuery) {
    const where: Prisma.SeoUrlMappingWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.q) {
      where.OR = [
        { seoPath: { contains: query.q, mode: 'insensitive' } },
        { originalPath: { contains: query.q, mode: 'insensitive' } },
        { title: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.seoUrlMapping.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.seoUrlMapping.count({ where }),
    ]);

    const groups = await this.loadGroups(rows.map((row) => row.destinationKey));

    const items = await Promise.all(
      rows.map(async (row) => {
        const group = groups.get(row.destinationKey);
        try {
          const render = await renderDestination(row.destinationType, parseStoredParams(row.destinationParams));
          return toAdminDto(row, render.pagination.total, group);
        } catch {
          return toAdminDto(row, null, group);
        }
      }),
    );

    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 0,
      },
    };
  }

  async create(input: CreateSeoUrlInput): Promise<AdminSeoUrlDto> {
    const seoPath = normalizeSeoPath(input.seoPath);
    const destination = parseDestination(input.originalPath);

    await this.assertSeoPathFree(seoPath);

    // Mapping đầu tiên của nhóm thành URL chính; các URL thêm sau là alias.
    const group = await this.loadGroup(destination.key);

    const row = await prisma.seoUrlMapping.create({
      data: {
        seoPath,
        title: input.title.trim(),
        description: input.description.trim(),
        heading: input.heading?.trim() ? input.heading.trim() : null,
        originalPath: destination.originalPath,
        destinationType: destination.type,
        destinationParams: destination.params,
        destinationKey: destination.key,
        isCanonical: group.canonicalPath === null,
        status: 'DRAFT',
      },
    });

    return toAdminDto(row, null, await this.loadGroup(destination.key));
  }

  async update(id: string, input: UpdateSeoUrlInput): Promise<AdminSeoUrlDto> {
    const current = await prisma.seoUrlMapping.findUnique({ where: { id } });
    if (!current) {
      throw new AppError('Không tìm thấy SEO URL', 404, 'NOT_FOUND');
    }

    const data: Prisma.SeoUrlMappingUpdateInput = {};

    if (input.seoPath !== undefined) {
      const seoPath = normalizeSeoPath(input.seoPath);
      await this.assertSeoPathFree(seoPath, id);
      data.seoPath = seoPath;
    }

    let previousDestinationKey: string | null = null;
    if (input.originalPath !== undefined) {
      const destination = parseDestination(input.originalPath);
      data.originalPath = destination.originalPath;
      data.destinationType = destination.type;
      data.destinationParams = destination.params;
      data.destinationKey = destination.key;
      if (destination.key !== current.destinationKey) {
        previousDestinationKey = current.destinationKey;
        // Sang nhóm mới: chỉ nhận URL chính nếu nhóm đó chưa có.
        const targetGroup = await this.loadGroup(destination.key);
        data.isCanonical = targetGroup.canonicalPath === null;
      }
    }

    if (input.title !== undefined) data.title = input.title.trim();
    if (input.description !== undefined) data.description = input.description.trim();
    if (input.heading !== undefined) {
      data.heading = input.heading && input.heading.trim() ? input.heading.trim() : null;
    }

    const row = await prisma.seoUrlMapping.update({ where: { id }, data });

    if (previousDestinationKey) {
      await this.ensureGroupCanonical(previousDestinationKey);
    }
    await this.ensureGroupCanonical(row.destinationKey);

    const updated = await prisma.seoUrlMapping.findUniqueOrThrow({ where: { id } });
    return toAdminDto(updated, null, await this.loadGroup(updated.destinationKey));
  }

  async setStatus(id: string, status: SeoUrlMappingStatus): Promise<AdminSeoUrlDto> {
    const current = await prisma.seoUrlMapping.findUnique({ where: { id } });
    if (!current) {
      throw new AppError('Không tìm thấy SEO URL', 404, 'NOT_FOUND');
    }

    if (status === 'PUBLISHED') {
      // Publish lại phải qua đủ validate: URL và allowlist filter
      normalizeSeoPath(current.seoPath);
      parseDestination(current.originalPath);
    }

    await prisma.seoUrlMapping.update({
      where: { id },
      data: {
        status,
        // URL đã lưu trữ không được giữ canonical của nhóm
        ...(status === 'ARCHIVED' ? { isCanonical: false } : {}),
        publishedAt: status === 'PUBLISHED' ? (current.publishedAt ?? new Date()) : current.publishedAt,
      },
    });

    await this.ensureGroupCanonical(current.destinationKey);
    const row = await prisma.seoUrlMapping.findUniqueOrThrow({ where: { id } });

    let resultCount: number | null = null;
    try {
      const render = await renderDestination(row.destinationType, parseStoredParams(row.destinationParams));
      resultCount = render.pagination.total;
    } catch {
      resultCount = null;
    }

    return toAdminDto(row, resultCount, await this.loadGroup(row.destinationKey));
  }

  async bulkPublish(ids: string[]) {
    const published: string[] = [];
    const failed: Array<{ id: string; seoPath: string | null; message: string }> = [];

    for (const id of ids) {
      try {
        const dto = await this.setStatus(id, 'PUBLISHED');
        published.push(dto.seoPath);
      } catch (error) {
        const row = await prisma.seoUrlMapping.findUnique({ where: { id } });
        failed.push({
          id,
          seoPath: row?.seoPath ?? null,
          message: error instanceof AppError ? error.message : 'Publish thất bại',
        });
      }
    }

    return { publishedCount: published.length, published, failed };
  }

  async remove(id: string) {
    const current = await prisma.seoUrlMapping.findUnique({ where: { id } });
    if (!current) {
      throw new AppError('Không tìm thấy SEO URL', 404, 'NOT_FOUND');
    }
    await prisma.seoUrlMapping.delete({ where: { id } });
    await this.ensureGroupCanonical(current.destinationKey);
    return { id, seoPath: current.seoPath };
  }
}
