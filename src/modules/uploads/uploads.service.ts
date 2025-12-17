import { randomUUID } from 'crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import { buildS3ObjectUrl, createPresignedUploadUrl, deleteS3Objects, getS3BucketName, s3Client } from '@/shared/storage/s3';
import {
  CreatePresignInput,
  DeleteObjectInput,
  CreateProfileAvatarPresignInput,
  UploadProfileAvatarInput,
  UploadCompanyPostImageInput,
  UploadCompanyLogoInput,
  UploadCompanyCoverInput,
} from './uploads.schema';

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB
const AVATAR_MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
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
  return parts[1] ?? null;
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

  async createProfileAvatarPresignedUrl(userId: string, input: CreateProfileAvatarPresignInput) {
    const { fileName, fileType, fileSize } = input;

    if (fileSize > AVATAR_MAX_FILE_SIZE) {
      throw new AppError('Kích thước ảnh đại diện tối đa 4MB', 400, 'FILE_TOO_LARGE');
    }

    if (!ALLOWED_MIME_TYPES.has(fileType)) {
      throw new AppError('Định dạng ảnh đại diện không được hỗ trợ. Chỉ chấp nhận JPG, PNG, WEBP', 400, 'UNSUPPORTED_FILE_TYPE');
    }

    const extFromMime = getExtensionFromMime(fileType);
    const fallbackExt = (() => {
      const sanitized = sanitizeFileName(fileName);
      const idx = sanitized.lastIndexOf('.');
      if (idx === -1) return '';
      return `.${sanitized.slice(idx + 1).toLowerCase()}`;
    })();
    const extension = extFromMime ?? fallbackExt ?? '';
    const key = `users/${userId}/avatar/${randomUUID()}${extension}`;

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
      maxFileSize: AVATAR_MAX_FILE_SIZE,
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

  async uploadProfileAvatar(userId: string, input: UploadProfileAvatarInput) {
    const { fileName, fileType, fileData, previousKey } = input;

    if (!ALLOWED_MIME_TYPES.has(fileType)) {
      throw new AppError('Định dạng ảnh đại diện không được hỗ trợ. Chỉ chấp nhận JPG, PNG, WEBP', 400, 'UNSUPPORTED_FILE_TYPE');
    }

    const buffer = Buffer.from(fileData, 'base64');

    if (!buffer.length) {
      throw new AppError('Ảnh đại diện không được rỗng', 400, 'EMPTY_FILE');
    }

    if (buffer.length > AVATAR_MAX_FILE_SIZE) {
      throw new AppError('Kích thước ảnh đại diện tối đa 4MB', 400, 'FILE_TOO_LARGE');
    }

    const extFromMime = getExtensionFromMime(fileType);
    const fallbackExt = (() => {
      const sanitized = sanitizeFileName(fileName);
      const idx = sanitized.lastIndexOf('.');
      if (idx === -1) return '';
      return `.${sanitized.slice(idx + 1).toLowerCase()}`;
    })();
    const extension = extFromMime ?? fallbackExt ?? '';
    const key = `users/${userId}/avatar/${randomUUID()}${extension}`;

    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: getS3BucketName(),
        Key: key,
        Body: buffer,
        ContentType: fileType,
        ContentLength: buffer.length,
      }));
    } catch (error) {
      console.error('Failed to upload avatar to S3', error);
      throw new AppError('Không thể tải ảnh đại diện, vui lòng thử lại.', 500, 'UPLOAD_FAILED');
    }

    if (previousKey && previousKey.startsWith(`users/${userId}/avatar/`)) {
      try {
        await deleteS3Objects([previousKey]);
      } catch (error) {
        // ignore deletion errors to avoid blocking upload success
        console.error('Failed to delete previous avatar', error);
      }
    }

    return {
      key,
      assetUrl: buildS3ObjectUrl(key),
    };
  }

  async uploadCompanyPostImage(userId: string, input: UploadCompanyPostImageInput) {
    const { companyId, fileName, fileType, fileData, previousKey } = input;

    const membership = await prisma.companyMember.findFirst({
      where: {
        userId,
        companyId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      throw new AppError('Bạn không có quyền tải ảnh cho công ty này', 403, 'FORBIDDEN');
    }

    if (!ALLOWED_MIME_TYPES.has(fileType)) {
      throw new AppError('Định dạng tệp không được hỗ trợ. Chỉ chấp nhận JPG, PNG, WEBP', 400, 'UNSUPPORTED_FILE_TYPE');
    }

    const buffer = Buffer.from(fileData, 'base64');

    if (!buffer.length) {
      throw new AppError('Tệp không được rỗng', 400, 'EMPTY_FILE');
    }

    if (buffer.length > MAX_FILE_SIZE) {
      throw new AppError('Kích thước tệp vượt quá giới hạn 8MB', 400, 'FILE_TOO_LARGE');
    }

    const extFromMime = getExtensionFromMime(fileType);
    const fallbackExt = (() => {
      const sanitized = sanitizeFileName(fileName);
      const idx = sanitized.lastIndexOf('.');
      if (idx === -1) return '';
      return `.${sanitized.slice(idx + 1).toLowerCase()}`;
    })();
    const extension = extFromMime ?? fallbackExt ?? '';
    const key = `companies/${companyId}/posts/${randomUUID()}${extension}`;

    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: getS3BucketName(),
        Key: key,
        Body: buffer,
        ContentType: fileType,
        ContentLength: buffer.length,
      }));
    } catch (error) {
      console.error('Failed to upload company post image to S3', error);
      throw new AppError('Không thể tải ảnh lên, vui lòng thử lại.', 500, 'UPLOAD_FAILED');
    }

    if (previousKey && previousKey.startsWith(`companies/${companyId}/posts/`)) {
      try {
        await deleteS3Objects([previousKey]);
      } catch (error) {
        console.error('Failed to delete previous company post image', error);
      }
    }

    return {
      key,
      assetUrl: buildS3ObjectUrl(key),
    };
  }

  async uploadCompanyLogo(userId: string, input: UploadCompanyLogoInput) {
    const { companyId, fileName, fileType, fileData, previousKey } = input;

    const membership = await prisma.companyMember.findFirst({
      where: {
        userId,
        companyId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      throw new AppError('Bạn không có quyền tải logo cho công ty này', 403, 'FORBIDDEN');
    }

    if (!ALLOWED_MIME_TYPES.has(fileType)) {
      throw new AppError('Định dạng tệp không được hỗ trợ. Chỉ chấp nhận JPG, PNG, WEBP', 400, 'UNSUPPORTED_FILE_TYPE');
    }

    const buffer = Buffer.from(fileData, 'base64');

    if (!buffer.length) {
      throw new AppError('Tệp không được rỗng', 400, 'EMPTY_FILE');
    }

    if (buffer.length > MAX_FILE_SIZE) {
      throw new AppError('Kích thước tệp vượt quá giới hạn 8MB', 400, 'FILE_TOO_LARGE');
    }

    const extFromMime = getExtensionFromMime(fileType);
    const fallbackExt = (() => {
      const sanitized = sanitizeFileName(fileName);
      const idx = sanitized.lastIndexOf('.');
      if (idx === -1) return '';
      return `.${sanitized.slice(idx + 1).toLowerCase()}`;
    })();
    const extension = extFromMime ?? fallbackExt ?? '';
    const key = `companies/${companyId}/logo/${randomUUID()}${extension}`;

    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: getS3BucketName(),
        Key: key,
        Body: buffer,
        ContentType: fileType,
        ContentLength: buffer.length,
      }));

      // Update company logoUrl in database
      await prisma.company.update({
        where: { id: companyId },
        data: { logoUrl: buildS3ObjectUrl(key) },
      });

    } catch (error) {
      console.error('Failed to upload company logo to S3 or update DB', error);
      throw new AppError('Không thể tải logo lên, vui lòng thử lại.', 500, 'UPLOAD_FAILED');
    }

    if (previousKey && previousKey.startsWith(`companies/${companyId}/logo/`)) {
      try {
        await deleteS3Objects([previousKey]);
      } catch (error) {
        console.error('Failed to delete previous company logo', error);
      }
    }

    return {
      key,
      assetUrl: buildS3ObjectUrl(key),
    };
  }

  async uploadCompanyCover(userId: string, input: UploadCompanyCoverInput) {
    const { companyId, fileName, fileType, fileData, previousKey } = input;

    const membership = await prisma.companyMember.findFirst({
      where: {
        userId,
        companyId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      throw new AppError('Bạn không có quyền tải ảnh cover cho công ty này', 403, 'FORBIDDEN');
    }

    if (!ALLOWED_MIME_TYPES.has(fileType)) {
      throw new AppError('Định dạng tệp không được hỗ trợ. Chỉ chấp nhận JPG, PNG, WEBP', 400, 'UNSUPPORTED_FILE_TYPE');
    }

    const buffer = Buffer.from(fileData, 'base64');

    if (!buffer.length) {
      throw new AppError('Tệp không được rỗng', 400, 'EMPTY_FILE');
    }

    if (buffer.length > MAX_FILE_SIZE) {
      throw new AppError('Kích thước tệp vượt quá giới hạn 8MB', 400, 'FILE_TOO_LARGE');
    }

    const extFromMime = getExtensionFromMime(fileType);
    const fallbackExt = (() => {
      const sanitized = sanitizeFileName(fileName);
      const idx = sanitized.lastIndexOf('.');
      if (idx === -1) return '';
      return `.${sanitized.slice(idx + 1).toLowerCase()}`;
    })();
    const extension = extFromMime ?? fallbackExt ?? '';
    const key = `companies/${companyId}/cover/${randomUUID()}${extension}`;

    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: getS3BucketName(),
        Key: key,
        Body: buffer,
        ContentType: fileType,
        ContentLength: buffer.length,
      }));

      // Update company coverUrl in database
      await prisma.company.update({
        where: { id: companyId },
        data: { coverUrl: buildS3ObjectUrl(key) },
      });

    } catch (error) {
      console.error('Failed to upload company cover to S3 or update DB', error);
      throw new AppError('Không thể tải ảnh cover lên, vui lòng thử lại.', 500, 'UPLOAD_FAILED');
    }

    if (previousKey && previousKey.startsWith(`companies/${companyId}/cover/`)) {
      try {
        await deleteS3Objects([previousKey]);
      } catch (error) {
        console.error('Failed to delete previous company cover', error);
      }
    }

    return {
      key,
      assetUrl: buildS3ObjectUrl(key),
    };
  }
}

