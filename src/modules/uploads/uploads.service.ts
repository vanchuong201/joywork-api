import { randomUUID } from 'crypto';
import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import { buildS3ObjectUrl, createPresignedUploadUrl, deleteS3Objects } from '@/shared/storage/s3';
import { CreatePresignInput, DeleteObjectInput } from './uploads.schema';

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function getExtensionFromMime(mime: string): string | null {
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  return null;
}

function sanitizeFileName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9.\-_]+/g, '-');
}

function extractCompanyIdFromKey(key: string): string | null {
  const parts = key.split('/');
  if (parts.length < 3) {
    return null;
  }
  if (parts[0] !== 'companies') {
    return null;
  }
  return parts[1];
}

export class UploadsService {
  async createPresignedUrl(userId: string, input: CreatePresignInput) {
    const { companyId, fileName, fileType, fileSize } = input;

    const membership = await prisma.companyMember.findFirst({
      where: {
        userId,
        companyId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      throw new AppError('Bạn không có quyền tải tệp lên cho công ty này', 403, 'FORBIDDEN');
    }

    if (fileSize > MAX_FILE_SIZE) {
      throw new AppError('Kích thước tệp vượt quá giới hạn 8MB', 400, 'FILE_TOO_LARGE');
    }

    if (!ALLOWED_MIME_TYPES.has(fileType)) {
      throw new AppError('Định dạng tệp không được hỗ trợ. Chỉ chấp nhận JPG, PNG, WEBP', 400, 'UNSUPPORTED_FILE_TYPE');
    }

    const extFromMime = getExtensionFromMime(fileType);
    const fallbackExt = (() => {
      const sanitized = sanitizeFileName(fileName);
      const idx = sanitized.lastIndexOf('.');
      if (idx === -1) return '';
      return `.${sanitized.slice(idx + 1).toLowerCase()}`;
    })();
    const extension = extFromMime ?? fallbackExt ?? '';
    const key = `companies/${companyId}/posts/drafts/${randomUUID()}${extension}`;

    const uploadUrl = await createPresignedUploadUrl({
      key,
      contentType: fileType,
      contentLength: fileSize,
      expiresIn: 300,
    });

    return {
      key,
      uploadUrl,
      assetUrl: buildS3ObjectUrl(key),
      expiresIn: 300,
      maxFileSize: MAX_FILE_SIZE,
      allowedTypes: Array.from(ALLOWED_MIME_TYPES),
    };
  }

  async deleteObject(userId: string, input: DeleteObjectInput) {
    const { key } = input;
    const companyId = extractCompanyIdFromKey(key);

    if (!companyId) {
      throw new AppError('Đường dẫn tệp không hợp lệ', 400, 'INVALID_OBJECT_KEY');
    }

    const membership = await prisma.companyMember.findFirst({
      where: {
        userId,
        companyId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      throw new AppError('Bạn không có quyền xóa tệp này', 403, 'FORBIDDEN');
    }

    await deleteS3Objects([key]);
  }
}

