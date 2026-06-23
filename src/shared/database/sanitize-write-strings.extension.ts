import { Prisma } from '@prisma/client';
import { sanitizeUserText } from '@/shared/text/sanitize-user-text';

/**
 * Prisma client extension lam sach moi gia tri string trong write-args truoc khi
 * xuong PostgreSQL. Ngan loi "unexpected end of hex escape" do byte NUL / C0 control
 * / surrogate le (vd: user dan chu "in dam" tu Facebook hoac CV co ky tu rac).
 *
 * Chi dong vao `data` / `create` / `update` cua cac thao tac ghi. KHONG cham vao
 * `where` de tranh doi ngu nghia truy van. Vi sanitizeUserText la no-op tren chuoi
 * sach (slug, email, url, enum, cuid khong bao gio chua cac ky tu nay), ap dung
 * toan cuc an toan: chi loai dung nhung byte se lam vo lenh ghi.
 */

const WRITE_OPERATIONS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
]);

const WRITE_ARG_KEYS = ['data', 'create', 'update'] as const;

// Chi de quy vao plain object va array. Bo qua Date, Buffer/Uint8Array, Decimal,
// BigInt... (chung khong phai chuoi va khong nen bi sao chep/sua doi).
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function deepSanitize(value: unknown): unknown {
  if (typeof value === 'string') return sanitizeUserText(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      value[i] = deepSanitize(value[i]);
    }
    return value;
  }
  if (isPlainObject(value)) {
    for (const key of Object.keys(value)) {
      value[key] = deepSanitize(value[key]);
    }
    return value;
  }
  return value;
}

export const sanitizeWriteStringsExtension = Prisma.defineExtension({
  name: 'sanitizeWriteStrings',
  query: {
    $allModels: {
      $allOperations({ args, query, operation }) {
        if (WRITE_OPERATIONS.has(operation) && isPlainObject(args)) {
          const writeArgs = args as Record<string, unknown>;
          for (const key of WRITE_ARG_KEYS) {
            if (key in writeArgs) {
              writeArgs[key] = deepSanitize(writeArgs[key]);
            }
          }
        }
        return query(args);
      },
    },
  },
});
