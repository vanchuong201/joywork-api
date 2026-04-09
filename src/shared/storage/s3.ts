import { S3Client, DeleteObjectsCommand, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '@/config/env';

const s3Client = new S3Client({
  region: config.AWS_REGION,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
});

const bucketName = config.AWS_S3_BUCKET;

export function getS3BucketName(): string {
  return bucketName;
}

export function buildS3ObjectUrl(key: string): string {
  return `https://${bucketName}.s3.${config.AWS_REGION}.amazonaws.com/${key}`;
}

export async function createPresignedUploadUrl(params: {
  key: string;
  contentType: string;
  contentLength: number;
  expiresIn?: number;
}): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: params.key,
    ContentType: params.contentType,
    ContentLength: params.contentLength,
  });

  return getSignedUrl(s3Client, command, { expiresIn: params.expiresIn ?? 300 });
}

export async function createPresignedDownloadUrl(params: {
  key: string;
  expiresIn?: number;
  downloadFileName?: string;
  contentType?: string;
}): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: params.key,
    ...(params.downloadFileName
      ? { ResponseContentDisposition: `attachment; filename="${params.downloadFileName}"` }
      : {}),
    ...(params.contentType ? { ResponseContentType: params.contentType } : {}),
  });

  return getSignedUrl(s3Client, command, { expiresIn: params.expiresIn ?? 300 });
}

/** Lấy object key từ URL public kiểu https://{bucket}.s3.{region}.amazonaws.com/{key} */
export function extractS3KeyFromPublicObjectUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const bucketHost = `${bucketName}.s3.${config.AWS_REGION}.amazonaws.com`;
    if (parsed.host !== bucketHost) {
      return null;
    }
    const key = parsed.pathname.startsWith('/') ? parsed.pathname.slice(1) : parsed.pathname;
    return key || null;
  } catch {
    return null;
  }
}

/** Trả URL đọc được: presign nếu là object trong bucket JoyWork, giữ nguyên URL ngoài/CDN khác. */
export async function resolveReadableS3ObjectUrl(
  url: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> {
  if (!url) return null;
  const key = extractS3KeyFromPublicObjectUrl(url);
  if (!key) return url;
  try {
    return await createPresignedDownloadUrl({ key, expiresIn });
  } catch {
    return url;
  }
}

export async function deleteS3Objects(keys: string[]): Promise<void> {
  if (!keys.length) {
    return;
  }

  await s3Client.send(
    new DeleteObjectsCommand({
      Bucket: bucketName,
      Delete: {
        Objects: keys.map((key) => ({ Key: key })),
        Quiet: true,
      },
    })
  );
}

export { s3Client };

