import { PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import {
  buildS3ObjectUrl,
  createPresignedDownloadUrl,
  deleteS3Objects,
  extractS3KeyFromPublicObjectUrl,
  getS3BucketName,
  resolveReadableS3ObjectUrl,
  s3Client,
} from '@/shared/storage/s3';
import { HOMEPAGE_HERO_SLOT } from './banners.schema';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const DISPLAY_URL_EXPIRES_IN = 3600;

export type BannerPublicItem = {
  id: string;
  imageUrl: string;
  href: string;
  alt: string;
  openInNewTab: boolean;
};

export type BannerAdminItem = {
  id: string;
  slot: string;
  /** Canonical object URL lưu DB (có thể private). */
  imageUrl: string;
  /** URL đọc được để preview trong admin (presigned nếu cần). */
  imageDisplayUrl: string;
  href: string;
  alt: string;
  sortOrder: number;
  isActive: boolean;
  openInNewTab: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

async function toAdminItem(row: {
  id: string;
  slot: string;
  imageUrl: string;
  href: string;
  alt: string;
  sortOrder: number;
  isActive: boolean;
  openInNewTab: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): Promise<BannerAdminItem> {
  const imageDisplayUrl = (await resolveReadableS3ObjectUrl(row.imageUrl, DISPLAY_URL_EXPIRES_IN)) ?? row.imageUrl;
  return {
    id: row.id,
    slot: row.slot,
    imageUrl: row.imageUrl,
    imageDisplayUrl,
    href: row.href,
    alt: row.alt,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    openInNewTab: row.openInNewTab,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function assertScheduleWindow(startsAt?: Date | null, endsAt?: Date | null) {
  if (startsAt && endsAt && startsAt.getTime() > endsAt.getTime()) {
    throw new AppError('startsAt phải trước hoặc bằng endsAt', 400, 'INVALID_SCHEDULE');
  }
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

export class BannersService {
  async listPublicBySlot(slot: string): Promise<{ items: BannerPublicItem[] }> {
    const now = new Date();
    const rows = await prisma.bannerItem.findMany({
      where: {
        slot,
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        imageUrl: true,
        href: true,
        alt: true,
        openInNewTab: true,
      },
    });

    const items = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        imageUrl: (await resolveReadableS3ObjectUrl(row.imageUrl, DISPLAY_URL_EXPIRES_IN)) ?? row.imageUrl,
        href: row.href,
        alt: row.alt,
        openInNewTab: row.openInNewTab,
      })),
    );

    return { items };
  }

  async listForAdmin(slot?: string): Promise<{ items: BannerAdminItem[] }> {
    const rows = await prisma.bannerItem.findMany({
      ...(slot ? { where: { slot } } : {}),
      orderBy: [{ slot: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return { items: await Promise.all(rows.map((row) => toAdminItem(row))) };
  }

  async create(input: {
    slot: string;
    imageUrl: string;
    href: string;
    alt: string;
    isActive: boolean;
    openInNewTab: boolean;
    startsAt?: Date | null | undefined;
    endsAt?: Date | null | undefined;
    sortOrder?: number | undefined;
  }): Promise<{ item: BannerAdminItem }> {
    assertScheduleWindow(input.startsAt ?? null, input.endsAt ?? null);

    const maxOrder = await prisma.bannerItem.aggregate({
      where: { slot: input.slot },
      _max: { sortOrder: true },
    });
    const sortOrder =
      typeof input.sortOrder === 'number' ? input.sortOrder : (maxOrder._max.sortOrder ?? -1) + 1;

    const row = await prisma.bannerItem.create({
      data: {
        slot: input.slot,
        imageUrl: input.imageUrl,
        href: input.href,
        alt: input.alt,
        isActive: input.isActive,
        openInNewTab: input.openInNewTab,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        sortOrder,
      },
    });

    return { item: await toAdminItem(row) };
  }

  async update(
    id: string,
    input: {
      slot?: string | undefined;
      imageUrl?: string | undefined;
      href?: string | undefined;
      alt?: string | undefined;
      isActive?: boolean | undefined;
      openInNewTab?: boolean | undefined;
      startsAt?: Date | null | undefined;
      endsAt?: Date | null | undefined;
      sortOrder?: number | undefined;
    },
  ): Promise<{ item: BannerAdminItem }> {
    const existing = await prisma.bannerItem.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Không tìm thấy banner', 404, 'BANNER_NOT_FOUND');
    }

    const startsAt = input.startsAt !== undefined ? input.startsAt : existing.startsAt;
    const endsAt = input.endsAt !== undefined ? input.endsAt : existing.endsAt;
    assertScheduleWindow(startsAt, endsAt);

    const previousImageUrl = existing.imageUrl;
    const row = await prisma.bannerItem.update({
      where: { id },
      data: {
        ...(input.slot !== undefined ? { slot: input.slot } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
        ...(input.href !== undefined ? { href: input.href } : {}),
        ...(input.alt !== undefined ? { alt: input.alt } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.openInNewTab !== undefined ? { openInNewTab: input.openInNewTab } : {}),
        ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
        ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });

    if (input.imageUrl && input.imageUrl !== previousImageUrl) {
      await this.bestEffortDeleteImage(previousImageUrl);
    }

    return { item: await toAdminItem(row) };
  }

  async remove(id: string): Promise<{ id: string }> {
    const existing = await prisma.bannerItem.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Không tìm thấy banner', 404, 'BANNER_NOT_FOUND');
    }

    await prisma.bannerItem.delete({ where: { id } });
    await this.bestEffortDeleteImage(existing.imageUrl);
    await this.normalizeOrders(existing.slot);

    return { id };
  }

  async reorder(slot: string, ids: string[]): Promise<{ items: BannerAdminItem[] }> {
    const existing = await prisma.bannerItem.findMany({
      where: { slot },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((row) => row.id));
    if (ids.length !== existingIds.size || ids.some((id) => !existingIds.has(id))) {
      throw new AppError('Danh sách reorder không khớp banner trong slot', 400, 'INVALID_REORDER');
    }

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.bannerItem.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );

    return this.listForAdmin(slot);
  }

  async uploadImage(input: {
    fileName: string;
    fileType: 'image/jpeg' | 'image/png' | 'image/webp';
    fileData: string;
  }): Promise<{ url: string; previewUrl: string }> {
    const buffer = Buffer.from(input.fileData, 'base64');
    if (!buffer.length) {
      throw new AppError('Ảnh banner không được rỗng', 400, 'EMPTY_FILE');
    }
    if (buffer.length > MAX_UPLOAD_BYTES) {
      throw new AppError('Kích thước ảnh vượt quá giới hạn 8MB', 400, 'FILE_TOO_LARGE');
    }

    const ext = input.fileType === 'image/png' ? '.png' : input.fileType === 'image/webp' ? '.webp' : '.jpg';
    const safeName = sanitizeFileName(input.fileName);
    const base = safeName.replace(/\.[^.]+$/, '');
    const key = `system/banners/${base || 'banner'}-${randomUUID()}${ext}`;

    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: getS3BucketName(),
          Key: key,
          Body: buffer,
          ContentType: input.fileType,
          ContentLength: buffer.length,
        }),
      );
    } catch {
      throw new AppError('Không thể tải ảnh banner, vui lòng thử lại.', 500, 'UPLOAD_FAILED');
    }

    const url = buildS3ObjectUrl(key);
    let previewUrl = url;
    try {
      previewUrl = await createPresignedDownloadUrl({ key, expiresIn: DISPLAY_URL_EXPIRES_IN });
    } catch {
      // Fallback to canonical URL if presign fails.
    }

    return { url, previewUrl };
  }

  private async normalizeOrders(slot: string) {
    const rows = await prisma.bannerItem.findMany({
      where: { slot },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    if (!rows.length) return;

    await prisma.$transaction(
      rows.map((row, index) =>
        prisma.bannerItem.update({
          where: { id: row.id },
          data: { sortOrder: index },
        }),
      ),
    );
  }

  private async bestEffortDeleteImage(imageUrl: string) {
    const key = extractS3KeyFromPublicObjectUrl(imageUrl);
    if (!key || !key.startsWith('system/banners/')) {
      return;
    }
    try {
      await deleteS3Objects([key]);
    } catch {
      // Best-effort cleanup; DB row already removed/updated.
    }
  }
}

export const DEFAULT_BANNER_SLOT = HOMEPAGE_HERO_SLOT;
