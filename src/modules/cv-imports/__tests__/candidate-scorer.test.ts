import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  DECISION,
  isSkinPixel,
  scoreCandidates,
} from '../avatar/candidate-scorer';
import type { RawCandidate } from '../avatar/types';

async function createSolidImage(params: {
  width: number;
  height: number;
  r: number;
  g: number;
  b: number;
  alpha?: number;
}): Promise<Buffer> {
  const { width, height, r, g, b, alpha = 1 } = params;
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r, g, b, alpha },
    },
  })
    .png()
    .toBuffer();
}

async function createNoiseImage(width: number, height: number): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i += 3) {
    const idx = i / 3;
    raw[i] = (idx * 31) % 256;
    raw[i + 1] = (idx * 17) % 256;
    raw[i + 2] = (idx * 47) % 256;
  }
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
}

function candidate(params: {
  name: string;
  buffer: Buffer;
  width: number;
  height: number;
  kind: 1 | 2 | 3;
}): RawCandidate {
  return {
    name: params.name,
    buffer: params.buffer,
    width: params.width,
    height: params.height,
    kind: params.kind,
    source: 'pdf_embedded',
  };
}

describe('scoreCandidates', () => {
  it('ưu tiên ảnh chân dung có skin-ratio cao hơn logo alpha', async () => {
    const portrait = await createSolidImage({
      width: 420,
      height: 560,
      r: 210,
      g: 170,
      b: 145,
      alpha: 1,
    });
    const logo = await createSolidImage({
      width: 420,
      height: 560,
      r: 20,
      g: 120,
      b: 220,
      alpha: 0.6,
    });

    const ranked = await scoreCandidates([
      candidate({ name: 'logo', buffer: logo, width: 420, height: 560, kind: 3 }),
      candidate({ name: 'portrait', buffer: portrait, width: 420, height: 560, kind: 2 }),
    ]);

    expect(ranked[0]?.name).toBe('portrait');
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
  });

  it('ảnh noise (entropy cao nhưng skin thấp) không vượt ảnh chân dung', async () => {
    const portrait = await createSolidImage({
      width: 400,
      height: 520,
      r: 205,
      g: 150,
      b: 125,
      alpha: 1,
    });
    const noise = await createNoiseImage(400, 520);

    const ranked = await scoreCandidates([
      candidate({ name: 'noise', buffer: noise, width: 400, height: 520, kind: 2 }),
      candidate({ name: 'portrait', buffer: portrait, width: 400, height: 520, kind: 2 }),
    ]);

    expect(ranked[0]?.name).toBe('portrait');
    expect(ranked[0]?.score).toBeGreaterThan(DECISION.MIN_SCORE);
  });
});

describe('isSkinPixel', () => {
  it('đúng với một số pixel cơ bản', () => {
    expect(isSkinPixel(210, 170, 145)).toBe(true);
    expect(isSkinPixel(30, 120, 220)).toBe(false);
  });
});
