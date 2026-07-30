export const LIMITS = {
  maxFileSizeBytes: 10 * 1024 * 1024,
  maxPages: 10,
  pagesToProcess: [1] as const,
  maxCandidates: 30,
  maxDecodedImagePixels: 16_777_216, // 4096 x 4096
  scoringTimeoutMs: 10_000,
} as const;
