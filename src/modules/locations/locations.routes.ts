import { FastifyInstance } from 'fastify';
import { PROVINCE_BY_CODE } from '@/shared/provinces';
import { getWardsForProvinceCodes } from '@/shared/wards';
import { AppError } from '@/shared/errors/errorHandler';

export async function locationsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/wards', {
    schema: {
      description: 'Danh sách phường/xã theo mã tỉnh JoyWork (slug)',
      tags: ['Locations'],
      querystring: {
        type: 'object',
        properties: {
          provinceCode: { type: 'string', description: 'Một tỉnh, ví dụ ha-noi' },
          provinceCodes: {
            type: 'string',
            description: 'Nhiều tỉnh phân tách bằng dấu phẩy',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                wards: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      code: { type: 'string' },
                      provinceCode: { type: 'string' },
                      name: { type: 'string' },
                      fullName: { type: 'string', nullable: true },
                      unitType: { type: 'string', nullable: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (request) => {
    const q = request.query as { provinceCode?: string; provinceCodes?: string };
    const codes: string[] = [];
    if (q.provinceCode?.trim()) codes.push(q.provinceCode.trim());
    if (q.provinceCodes?.trim()) {
      for (const part of q.provinceCodes.split(',')) {
        const c = part.trim();
        if (c) codes.push(c);
      }
    }
    if (!codes.length) {
      throw new AppError('Thiếu provinceCode hoặc provinceCodes', 400, 'LOCATIONS_QUERY_INVALID');
    }
    for (const c of codes) {
      if (!PROVINCE_BY_CODE.has(c)) {
        throw new AppError('Mã tỉnh/thành không hợp lệ', 400, 'UNKNOWN_PROVINCE');
      }
    }
    const wards = getWardsForProvinceCodes(codes);
    return {
      data: {
        wards: wards.map((w) => ({
          code: w.code,
          provinceCode: w.provinceCode,
          name: w.name,
          fullName: w.fullName,
          unitType: w.unitType,
        })),
      },
    };
  });
}
