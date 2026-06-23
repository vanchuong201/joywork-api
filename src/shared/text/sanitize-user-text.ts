/**
 * Lam sach chuoi free-text nguoi dung nhap truoc khi ghi xuong PostgreSQL qua Prisma.
 *
 * Hai loai ky tu gay vo tang luu tru:
 *  1. Byte NUL (U+0000) va cac C0 control khac: cot `text` cua PostgreSQL khong
 *     luu duoc NUL - Prisma bao "unexpected end of hex escape" khi serialize.
 *  2. Surrogate le (U+D800..U+DFFF khong ghep cap): chuoi UTF-16 khong hop le,
 *     pha vo JSON serialize cua query engine Prisma. Thuong lan vao khi user copy
 *     chu "in dam/sans-serif" tu Facebook (ky tu astral plane) roi dan lai.
 *
 * Giu lai tab (0x09), newline (0x0A), CR (0x0D) va moi ky tu astral hop le
 * (emoji, chu bold ghep du cap surrogate -> codePoint > 0xFFFF).
 */

const TAB = 0x09;
const NEWLINE = 0x0a;
const CARRIAGE_RETURN = 0x0d;
const C0_CONTROL_MAX = 0x1f;
const SURROGATE_MIN = 0xd800;
const SURROGATE_MAX = 0xdfff;

export function sanitizeUserText(input: string): string {
  let out = '';
  // Duyet theo code point: cap surrogate hop le gop thanh 1 ky tu (cp > 0xFFFF),
  // surrogate le con lai cp nam trong [D800, DFFF] -> bi loai.
  for (const ch of input) {
    const cp = ch.codePointAt(0)!;
    if (cp <= C0_CONTROL_MAX && cp !== TAB && cp !== NEWLINE && cp !== CARRIAGE_RETURN) {
      continue;
    }
    if (cp >= SURROGATE_MIN && cp <= SURROGATE_MAX) {
      continue;
    }
    out += ch;
  }
  return out;
}
