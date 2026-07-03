export function maskNameToInitials(name: string | null | undefined): string {
  const raw = (name || 'Ung vien').trim();
  const parts = raw.split(/\s+/).filter((part) => part.length > 0);
  if (parts.length === 0) {
    return '?';
  }

  return parts
    .map((word) => {
      const ch = Array.from(word)[0] ?? '';
      return ch.toLocaleUpperCase('vi-VN');
    })
    .join('');
}
