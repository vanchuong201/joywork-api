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

type MaskedProfilePresenceSource = {
  avatar?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  cvUrl?: string | null;
  website?: string | null;
  linkedin?: string | null;
  github?: string | null;
  specificAddress?: string | null;
  wardCodes?: string[] | null;
  locations?: string[] | null;
  dayOfBirth?: number | null;
  monthOfBirth?: number | null;
  yearOfBirth?: number | null;
} | null | undefined;

export type MaskedFieldPresence = {
  avatar: boolean;
  contactEmail: boolean;
  contactPhone: boolean;
  cvUrl: boolean;
  website: boolean;
  linkedin: boolean;
  github: boolean;
  address: boolean;
  dateOfBirth: boolean;
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export function buildMaskedFieldPresence(profile: MaskedProfilePresenceSource): MaskedFieldPresence {
  const wardCodes = profile?.wardCodes ?? [];
  const hasValidWardCode = wardCodes.some((code) => {
    const parts = code.split('/');
    return parts.length === 2 && Boolean(parts[0]) && Boolean(parts[1]);
  });

  const hasAddress =
    hasText(profile?.specificAddress) ||
    hasValidWardCode ||
    Boolean(profile?.locations?.length);

  const hasDateOfBirth = Boolean(
    (profile?.yearOfBirth ?? 0) > 0 ||
      (profile?.monthOfBirth ?? 0) > 0 ||
      (profile?.dayOfBirth ?? 0) > 0
  );

  return {
    avatar: hasText(profile?.avatar),
    contactEmail: hasText(profile?.contactEmail),
    contactPhone: hasText(profile?.contactPhone),
    cvUrl: hasText(profile?.cvUrl),
    website: hasText(profile?.website),
    linkedin: hasText(profile?.linkedin),
    github: hasText(profile?.github),
    address: hasAddress,
    dateOfBirth: hasDateOfBirth,
  };
}
