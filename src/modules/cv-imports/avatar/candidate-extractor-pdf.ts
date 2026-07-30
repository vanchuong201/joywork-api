import { LIMITS } from './limits';
import type { PdfImageKind, RawCandidate } from './types';

const PDF_IMAGE_THRESHOLD = 80;

function normalizePdfKind(kind: unknown): PdfImageKind | undefined {
  if (kind === 1 || kind === 2 || kind === 3) return kind;
  return undefined;
}

export async function extractPdfCandidates(buffer: Buffer): Promise<RawCandidate[]> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const result = await parser.getImage({
      partial: [...LIMITS.pagesToProcess],
      imageThreshold: PDF_IMAGE_THRESHOLD,
      imageBuffer: true,
      imageDataUrl: false,
    });

    const candidates: RawCandidate[] = [];
    for (const page of result.pages ?? []) {
      const pageNumber = typeof page?.pageNumber === 'number' ? page.pageNumber : 1;
      for (const image of page?.images ?? []) {
        const width = typeof image?.width === 'number' ? image.width : 0;
        const height = typeof image?.height === 'number' ? image.height : 0;
        const data = image?.data;
        if (!data || width <= 0 || height <= 0) continue;

        const imageBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data as Uint8Array);
        if (imageBuffer.length === 0) continue;

        const imageName =
          typeof image?.name === 'string' && image.name.trim().length > 0
            ? image.name.trim()
            : `page${pageNumber}_img${candidates.length + 1}`;

        const normalizedKind = normalizePdfKind(image?.kind);
        candidates.push({
          buffer: imageBuffer,
          width,
          height,
          ...(normalizedKind ? { kind: normalizedKind } : {}),
          name: imageName,
          source: 'pdf_embedded',
        });
      }
    }

    return candidates;
  } finally {
    try {
      await parser.destroy();
    } catch {
      // no-op cleanup
    }
  }
}
