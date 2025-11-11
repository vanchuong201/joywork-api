import { S3Client, DeleteObjectsCommand, PutObjectCommand } from '@aws-sdk/client-s3';
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

