import { PrismaClient } from '@prisma/client';
import { sanitizeWriteStringsExtension } from './sanitize-write-strings.extension';

declare global {
  // eslint-disable-next-line no-var
  var prismaBase: PrismaClient | undefined;
}

// Base client cached on globalThis to survive dev hot-reload; the extension is
// applied on each module load (cheap) so consumers always get the sanitized client.
const basePrisma =
  globalThis.prismaBase ??
  new PrismaClient({
    log: process.env['NODE_ENV'] === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalThis.prismaBase = basePrisma;
}

export const prisma = basePrisma.$extends(sanitizeWriteStringsExtension);

export default prisma;
