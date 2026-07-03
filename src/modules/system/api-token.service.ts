import { randomBytes, createHash } from 'crypto';
import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import type { CreateApiTokenInput, UpdateApiTokenInput } from './api-token.schema';

function generateApiToken(): { rawToken: string; tokenHash: string; tokenPrefix: string } {
  const random = randomBytes(20).toString('hex'); // 40 hex chars
  const rawToken = `jw_${random}`;
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const tokenPrefix = rawToken.substring(0, 8); // "jw_xxxxx"
  return { rawToken, tokenHash, tokenPrefix };
}

// Fields returned in list/get — tokenHash is never exposed
const TOKEN_SELECT = {
  id: true,
  name: true,
  tokenPrefix: true,
  scopes: true,
  expiresAt: true,
  lastUsedAt: true,
  enabled: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class ApiTokenService {
  async createToken(adminUserId: string, input: CreateApiTokenInput) {
    const { rawToken, tokenHash, tokenPrefix } = generateApiToken();

    const token = await prisma.apiToken.create({
      data: {
        name: input.name,
        tokenHash,
        tokenPrefix,
        scopes: input.scopes,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        createdById: adminUserId,
      },
      select: TOKEN_SELECT,
    });

    return { token, rawToken };
  }

  async listTokens() {
    return prisma.apiToken.findMany({
      select: TOKEN_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateToken(id: string, input: UpdateApiTokenInput) {
    const existing = await prisma.apiToken.findUnique({ where: { id } });
    if (!existing) throw new AppError('Token không tồn tại', 404, 'NOT_FOUND');

    return prisma.apiToken.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.scopes !== undefined && { scopes: input.scopes }),
        ...(input.enabled !== undefined && { enabled: input.enabled }),
        ...(input.expiresAt !== undefined && {
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        }),
      },
      select: TOKEN_SELECT,
    });
  }

  async deleteToken(id: string) {
    const existing = await prisma.apiToken.findUnique({ where: { id } });
    if (!existing) throw new AppError('Token không tồn tại', 404, 'NOT_FOUND');
    await prisma.apiToken.delete({ where: { id } });
  }

  async validateToken(rawToken: string): Promise<
    { valid: false } | { valid: true; scopes: string[]; tokenId: string }
  > {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const token = await prisma.apiToken.findUnique({ where: { tokenHash } });

    if (!token || !token.enabled) return { valid: false };
    if (token.expiresAt && token.expiresAt < new Date()) return { valid: false };

    // Fire-and-forget lastUsedAt update — do not await to avoid adding latency
    prisma.apiToken.update({
      where: { id: token.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => undefined);

    return { valid: true, scopes: token.scopes, tokenId: token.id };
  }
}
