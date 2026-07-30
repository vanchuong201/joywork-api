import sharp from 'sharp';

/** Avatar chuẩn: WebP 512x512. */
export async function normalizeAvatar(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(512, 512, {
      fit: 'cover',
      position: sharp.strategy.attention,
    })
    .webp({ quality: 85 })
    .toBuffer();
}
