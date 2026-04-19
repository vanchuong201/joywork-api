import { randomUUID } from 'crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import { buildS3ObjectUrl, createPresignedUploadUrl, createPresignedDownloadUrl, deleteS3Objects, getS3BucketName, s3Client } from '@/shared/storage/s3';
import {
  CreatePresignInput,
  DeleteObjectInput,
  CreateProfileAvatarPresignInput,
  UploadProfileAvatarInput,
  UploadCompanyPostImageInput,
  UploadCompanyLogoInput,
  UploadCompanyCoverInput,
  UploadProfileCVInput,
  UploadCompanyVerificationInput,
  CreateCourseAssetPresignInput,
} from './uploads.schema';
import { config } from '@/config/env';
import { emailService } from '@/shared/services/email.service';

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB for videos
const COURSE_THUMB_MAX = 8 * 1024 * 1024;
const COURSE_VIDEO_MAX = 200 * 1024 * 1024;
const COURSE_ATTACH_MAX = 25 * 1024 * 1024;
const AVATAR_MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
const CV_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DKKD_MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']); // mp4, webm, mov
const ALLOWED_CV_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const ALLOWED_DKKD_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
]);

const ALLOWED_COURSE_ATTACHMENT_TYPES = new Set<string>([
  ...Array.from(ALLOWED_CV_MIME_TYPES),
  ...Array.from(ALLOWED_MIME_TYPES),
  'application/zip',
  'application/x-zip-compressed',
]);
const DEFAULT_PROFILE_YEAR_OF_BIRTH = new Date().getFullYear() - 18;

function getExtensionFromMime(mime: string): string | null {
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'video/mp4') return '.mp4';
  if (mime === 'video/webm') return '.webm';
  if (mime === 'video/quicktime') return '.mov';
  return null;
}

function getDocExtensionFromMime(mime: string): string | null {
  if (mime === 'application/pdf') return '.pdf';
  if (mime === 'application/msword') return '.doc';
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return '.docx';
  if (mime === 'application/zip' || mime === 'application/x-zip-compressed') return '.zip';
  return null;
}

function isVideoType(mime: string): boolean {
  return ALLOWED_VIDEO_TYPES.has(mime);
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
  private async hasCompanyAssetPermission(userId: string, companyId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role === 'ADMIN') {
      return true;
    }

    const membership = await prisma.companyMember.findFirst({
      where: {
        userId,
        companyId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
      select: { userId: true },
    });
    return Boolean(membership);
  }

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

  /** Presign tài sản khóa học (chỉ ADMIN qua route). */
  async createCourseAssetPresignUrl(_adminUserId: string, input: CreateCourseAssetPresignInput) {
    const { kind, fileName, fileType, fileSize } = input;

    let prefixFolder: string;
    let maxSize: number;
    let allowed: Set<string>;

    if (kind === 'thumbnail') {
      prefixFolder = 'courses/thumbnails';
      maxSize = COURSE_THUMB_MAX;
      allowed = ALLOWED_MIME_TYPES;
      if (fileSize > maxSize) {
        throw new AppError('Ảnh đại diện khóa học tối đa 8MB', 400, 'FILE_TOO_LARGE');
      }
      if (!allowed.has(fileType)) {
        throw new AppError('Định dạng ảnh không được hỗ trợ', 400, 'UNSUPPORTED_FILE_TYPE');
      }
    } else if (kind === 'video') {
      prefixFolder = 'courses/videos';
      maxSize = COURSE_VIDEO_MAX;
      allowed = ALLOWED_VIDEO_TYPES;
      if (fileSize > maxSize) {
        throw new AppError('Video khóa học tối đa 200MB', 400, 'FILE_TOO_LARGE');
      }
      if (!allowed.has(fileType)) {
        throw new AppError('Định dạng video không được hỗ trợ', 400, 'UNSUPPORTED_FILE_TYPE');
      }
    } else {
      prefixFolder = 'courses/attachments';
      maxSize = COURSE_ATTACH_MAX;
      allowed = ALLOWED_COURSE_ATTACHMENT_TYPES;
      if (fileSize > maxSize) {
        throw new AppError('Tệp đính kèm tối đa 25MB', 400, 'FILE_TOO_LARGE');
      }
      if (!allowed.has(fileType)) {
        throw new AppError('Định dạng tệp đính kèm không được hỗ trợ', 400, 'UNSUPPORTED_FILE_TYPE');
      }
    }

    let extFromMime: string | null = null;
    if (kind === 'thumbnail' || kind === 'video') {
      extFromMime = getExtensionFromMime(fileType);
    } else {
      extFromMime = getDocExtensionFromMime(fileType) ?? getExtensionFromMime(fileType);
    }
    const fallbackExt = (() => {
      const sanitized = sanitizeFileName(fileName);
      const idx = sanitized.lastIndexOf('.');
      if (idx === -1) return '';
      return `.${sanitized.slice(idx + 1).toLowerCase()}`;
    })();
    const extension = extFromMime ?? fallbackExt ?? '';
    const key = `${prefixFolder}/${randomUUID()}${extension}`;

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
      maxFileSize: maxSize,
      allowedTypes: Array.from(allowed),
    };
  }

  /**
   * Upload khóa học qua máy chủ (multipart) — tránh CORS khi PUT trực tiếp lên S3 từ trình duyệt.
   * Chỉ ADMIN (đã qua middleware).
   */
  async uploadCourseAssetAdmin(
    adminUserId: string,
    input: {
      kind: CreateCourseAssetPresignInput['kind'];
      fileName: string;
      fileType: string;
      buffer: Buffer;
    },
  ) {
    const admin = await prisma.user.findUnique({
      where: { id: adminUserId },
      select: { role: true, accountStatus: true },
    });
    if (!admin || admin.role !== 'ADMIN') {
      throw new AppError('Bạn không có quyền thực hiện thao tác này', 403, 'FORBIDDEN');
    }
    if (admin.accountStatus !== 'ACTIVE') {
      throw new AppError('Tài khoản không hoạt động', 403, 'FORBIDDEN');
    }

    const { kind, fileName, fileType, buffer } = input;
    const fileSize = buffer.length;

    let prefixFolder: string;
    let maxSize: number;
    let allowed: Set<string>;

    if (kind === 'thumbnail') {
      prefixFolder = 'courses/thumbnails';
      maxSize = COURSE_THUMB_MAX;
      allowed = ALLOWED_MIME_TYPES;
      if (fileSize > maxSize) {
        throw new AppError('Ảnh đại diện khóa học tối đa 8MB', 400, 'FILE_TOO_LARGE');
      }
      if (!allowed.has(fileType)) {
        throw new AppError('Định dạng ảnh không được hỗ trợ', 400, 'UNSUPPORTED_FILE_TYPE');
      }
    } else if (kind === 'video') {
      prefixFolder = 'courses/videos';
      maxSize = COURSE_VIDEO_MAX;
      allowed = ALLOWED_VIDEO_TYPES;
      if (fileSize > maxSize) {
        throw new AppError('Video khóa học tối đa 200MB', 400, 'FILE_TOO_LARGE');
      }
      if (!allowed.has(fileType)) {
        throw new AppError('Định dạng video không được hỗ trợ', 400, 'UNSUPPORTED_FILE_TYPE');
      }
    } else {
      prefixFolder = 'courses/attachments';
      maxSize = COURSE_ATTACH_MAX;
      allowed = ALLOWED_COURSE_ATTACHMENT_TYPES;
      if (fileSize > maxSize) {
        throw new AppError('Tệp đính kèm tối đa 25MB', 400, 'FILE_TOO_LARGE');
      }
      if (!allowed.has(fileType)) {
        throw new AppError('Định dạng tệp đính kèm không được hỗ trợ', 400, 'UNSUPPORTED_FILE_TYPE');
      }
    }

    let extFromMime: string | null = null;
    if (kind === 'thumbnail' || kind === 'video') {
      extFromMime = getExtensionFromMime(fileType);
    } else {
      extFromMime = getDocExtensionFromMime(fileType) ?? getExtensionFromMime(fileType);
    }
    const fallbackExt = (() => {
      const sanitized = sanitizeFileName(fileName);
      const idx = sanitized.lastIndexOf('.');
      if (idx === -1) return '';
      return `.${sanitized.slice(idx + 1).toLowerCase()}`;
    })();
    const extension = extFromMime ?? fallbackExt ?? '';
    const key = `${prefixFolder}/${randomUUID()}${extension}`;

    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: getS3BucketName(),
          Key: key,
          Body: buffer,
          ContentType: fileType,
          ContentLength: buffer.length,
        }),
      );
    } catch {
      throw new AppError('Không thể lưu tệp lên kho lưu trữ', 500, 'UPLOAD_FAILED');
    }

    const canonical = buildS3ObjectUrl(key);
    /** Thumbnail: bucket thường private — trả presign GET để preview ngay trong admin (PATCH vẫn chuẩn hóa về canonical). */
    const assetUrl =
      kind === 'thumbnail'
        ? await createPresignedDownloadUrl({ key, expiresIn: 3600 })
        : canonical;

    return {
      key,
      assetUrl,
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
    const { fileName, fileType, fileData, previousKey, target = 'profile' } = input;

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
    const key = `users/${userId}/avatar/${target}/${randomUUID()}${extension}`;

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

    // Delete previous avatar if exists
    if (previousKey && previousKey.startsWith(`users/${userId}/avatar/`)) {
      try {
        await deleteS3Objects([previousKey]);
      } catch (error) {
        // ignore deletion errors to avoid blocking upload success
        console.error('Failed to delete previous avatar', error);
      }
    }

    const assetUrl = buildS3ObjectUrl(key);

    // Update database based on target
    if (target === 'account') {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { avatar: assetUrl },
        select: { id: true, avatar: true },
      });
      console.log(`[Upload] Updated User.avatar for userId=${userId}, avatar=${updated.avatar}`);
    } else {
      // Update or create profile
      const updated = await prisma.userProfile.upsert({
        where: { userId },
        update: { avatar: assetUrl },
        create: {
          userId,
          avatar: assetUrl,
          yearOfBirth: DEFAULT_PROFILE_YEAR_OF_BIRTH,
        },
        select: { id: true, userId: true, avatar: true },
      });
      console.log(`[Upload] Updated UserProfile.avatar for userId=${userId}, avatar=${updated.avatar}`);
    }

    return {
      key,
      assetUrl,
    };
  }

  async uploadCompanyPostImage(userId: string, input: UploadCompanyPostImageInput) {
    const { companyId, fileName, fileType, fileData, previousKey } = input;
    const canManage = await this.hasCompanyAssetPermission(userId, companyId);
    if (!canManage) {
      throw new AppError('Bạn không có quyền tải media cho công ty này', 403, 'FORBIDDEN');
    }

    const isVideo = isVideoType(fileType);
    const isImage = ALLOWED_MIME_TYPES.has(fileType);

    if (!isImage && !isVideo) {
      throw new AppError('Định dạng tệp không được hỗ trợ. Chỉ chấp nhận JPG, PNG, WEBP, MP4, WEBM, MOV', 400, 'UNSUPPORTED_FILE_TYPE');
    }

    const buffer = Buffer.from(fileData, 'base64');

    if (!buffer.length) {
      throw new AppError('Tệp không được rỗng', 400, 'EMPTY_FILE');
    }

    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_FILE_SIZE;
    if (buffer.length > maxSize) {
      const sizeLimit = isVideo ? '50MB' : '8MB';
      throw new AppError(`Kích thước tệp vượt quá giới hạn ${sizeLimit}`, 400, 'FILE_TOO_LARGE');
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
      console.error('Failed to upload company post media to S3', error);
      throw new AppError('Không thể tải media lên, vui lòng thử lại.', 500, 'UPLOAD_FAILED');
    }

    if (previousKey && previousKey.startsWith(`companies/${companyId}/posts/`)) {
      try {
        await deleteS3Objects([previousKey]);
      } catch (error) {
        console.error('Failed to delete previous company post media', error);
      }
    }

    return {
      key,
      assetUrl: buildS3ObjectUrl(key),
      type: isVideo ? 'VIDEO' : 'IMAGE',
    };
  }

  async uploadCompanyLogo(userId: string, input: UploadCompanyLogoInput) {
    const { companyId, fileName, fileType, fileData, previousKey } = input;
    const canManage = await this.hasCompanyAssetPermission(userId, companyId);
    if (!canManage) {
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
    const canManage = await this.hasCompanyAssetPermission(userId, companyId);
    if (!canManage) {
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

  async uploadProfileCV(userId: string, input: UploadProfileCVInput) {
    const { fileName, fileType, fileData, previousKey } = input;

    if (!ALLOWED_CV_MIME_TYPES.has(fileType)) {
      throw new AppError('Định dạng tệp không được hỗ trợ. Chỉ chấp nhận PDF, DOC, DOCX', 400, 'UNSUPPORTED_FILE_TYPE');
    }

    const buffer = Buffer.from(fileData, 'base64');

    if (!buffer.length) {
      throw new AppError('Tệp không được rỗng', 400, 'EMPTY_FILE');
    }

    if (buffer.length > CV_MAX_FILE_SIZE) {
      throw new AppError('Kích thước tệp vượt quá giới hạn 10MB', 400, 'FILE_TOO_LARGE');
    }

    const extFromMime = (() => {
      if (fileType === 'application/pdf') return '.pdf';
      if (fileType === 'application/msword') return '.doc';
      if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return '.docx';
      return null;
    })();
    
    const fallbackExt = (() => {
      const sanitized = sanitizeFileName(fileName);
      const idx = sanitized.lastIndexOf('.');
      if (idx === -1) return '';
      return `.${sanitized.slice(idx + 1).toLowerCase()}`;
    })();
    
    const extension = extFromMime ?? fallbackExt ?? '.pdf';
    const key = `users/${userId}/cv/${randomUUID()}${extension}`;

    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: getS3BucketName(),
        Key: key,
        Body: buffer,
        ContentType: fileType,
        ContentLength: buffer.length,
      }));
    } catch (error) {
      console.error('Failed to upload CV to S3', error);
      throw new AppError('Không thể tải CV lên, vui lòng thử lại.', 500, 'UPLOAD_FAILED');
    }

    if (previousKey && previousKey.startsWith(`users/${userId}/cv/`)) {
      try {
        await deleteS3Objects([previousKey]);
      } catch (error) {
        console.error('Failed to delete previous CV', error);
      }
    }

    const assetUrl = buildS3ObjectUrl(key);

    // Update database
    const updated = await prisma.userProfile.upsert({
      where: { userId },
      update: { cvUrl: assetUrl },
      create: {
        userId,
        cvUrl: assetUrl,
        yearOfBirth: DEFAULT_PROFILE_YEAR_OF_BIRTH,
      },
      select: { id: true, userId: true, cvUrl: true },
    });
    console.log(`[Upload] Updated UserProfile.cvUrl for userId=${userId}, cvUrl=${updated.cvUrl}`);

    return {
      key,
      assetUrl,
    };
  }

  async uploadCompanyVerificationDocument(userId: string, input: UploadCompanyVerificationInput) {
    const { companyId, fileName, fileType, fileData, previousKey } = input;

    const membership = await prisma.companyMember.findFirst({
      where: {
        userId,
        companyId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      throw new AppError('Bạn không có quyền tải giấy tờ xác thực cho công ty này', 403, 'FORBIDDEN');
    }

    if (!ALLOWED_DKKD_MIME_TYPES.has(fileType)) {
      throw new AppError('Định dạng tệp không được hỗ trợ. Chỉ chấp nhận PDF, DOC, DOCX, JPG, PNG', 400, 'UNSUPPORTED_FILE_TYPE');
    }

    const buffer = Buffer.from(fileData, 'base64');

    if (!buffer.length) {
      throw new AppError('Tệp không được rỗng', 400, 'EMPTY_FILE');
    }

    if (buffer.length > DKKD_MAX_FILE_SIZE) {
      throw new AppError('Kích thước tệp vượt quá giới hạn 15MB', 400, 'FILE_TOO_LARGE');
    }

    const extFromMime = getDocExtensionFromMime(fileType) ?? getExtensionFromMime(fileType);
    const fallbackExt = (() => {
      const sanitized = sanitizeFileName(fileName);
      const idx = sanitized.lastIndexOf('.');
      if (idx === -1) return '';
      return `.${sanitized.slice(idx + 1).toLowerCase()}`;
    })();
    const extension = extFromMime ?? fallbackExt ?? '';
    const key = `companies/${companyId}/verification/${randomUUID()}${extension}`;

    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: getS3BucketName(),
        Key: key,
        Body: buffer,
        ContentType: fileType,
        ContentLength: buffer.length,
      }));

      await prisma.company.update({
        where: { id: companyId },
        data: {
          verificationStatus: 'PENDING',
          verificationFileKey: key,
          verificationFileUrl: buildS3ObjectUrl(key),
          verificationSubmittedAt: new Date(),
          verificationReviewedAt: null,
          verificationReviewedById: null,
          verificationRejectReason: null,
          isVerified: false,
        },
      });
    } catch (error) {
      console.error('Failed to upload verification document', error);
      throw new AppError('Không thể tải hồ sơ xác thực, vui lòng thử lại.', 500, 'UPLOAD_FAILED');
    }

    if (previousKey && previousKey.startsWith(`companies/${companyId}/verification/`)) {
      try {
        await deleteS3Objects([previousKey]);
      } catch (error) {
        console.error('Failed to delete previous verification document', error);
      }
    }

    const assetUrl = buildS3ObjectUrl(key);

    // Get company info and owner email for notifications
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, legalName: true, slug: true },
    });

    // Send Lark notification
    if (config.LARK_COMPANY_VERIFICATION_WEBHOOK) {
      try {
        await fetch(config.LARK_COMPANY_VERIFICATION_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            msg_type: 'text',
            content: {
              text: `DN đã nộp hồ sơ xác thực DKKD.\nCompany: ${company?.name ?? 'N/A'}\nLegal name: ${company?.legalName ?? 'N/A'}\nSlug: ${company?.slug ?? 'N/A'}\nCompanyId: ${companyId}\nFile: ${assetUrl}`,
            },
          }),
        });
      } catch (error) {
        console.error('Failed to notify Lark for company verification', error);
      }
    }

    // Send email to owner
    try {
      const ownerMember = await prisma.companyMember.findFirst({
        where: {
          companyId,
          role: 'OWNER',
        },
        include: {
          user: {
            select: {
              email: true,
              name: true,
            },
          },
        },
      });

      if (ownerMember?.user?.email) {
        const manageUrl = `${config.FRONTEND_ORIGIN}/companies/${company?.slug}/manage`;
        await emailService.sendCompanyVerificationSubmittedEmail(ownerMember.user.email, {
          companyName: company?.name || 'Doanh nghiệp của bạn',
          ownerName: ownerMember.user.name,
          manageUrl,
        });
      }
    } catch (error) {
      console.error('Failed to send verification submitted email', error);
      // Don't throw - email failure shouldn't block the upload
    }

    return { key, assetUrl };
  }

  async getCompanyVerificationDownloadUrl(userId: string, companyId: string) {
    const membership = await prisma.companyMember.findFirst({
      where: {
        userId,
        companyId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!membership) {
      throw new AppError('Bạn không có quyền tải hồ sơ xác thực của công ty này', 403, 'FORBIDDEN');
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { verificationFileKey: true },
    });

    if (!company?.verificationFileKey) {
      throw new AppError('Chưa có hồ sơ xác thực', 404, 'FILE_NOT_FOUND');
    }

    const key = company.verificationFileKey;
    const fileName = key.split('/').pop() || 'verification';
    const url = await createPresignedDownloadUrl({
      key,
      downloadFileName: fileName,
      expiresIn: 300,
    });

    return { url };
  }
}
