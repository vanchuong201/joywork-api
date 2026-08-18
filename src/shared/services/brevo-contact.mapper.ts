/**
 * Map JoyWork User → Brevo contact attributes (whitelist cứng).
 *
 * CV_COMPLETED mirrors joywork-web `useProfileCompletion.ts` (5 sections × 20% = 100%).
 * Do not invent new attributes — Marketing creates them in Brevo first, then we update this mapper.
 */

const isFilledText = (value?: string | null): boolean => Boolean(value?.trim());

const hasNonEmptyArrayItem = (items?: string[] | null): boolean =>
  (items || []).some((item) => item.trim().length > 0);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type BrevoMapperProfile = {
  fullName?: string | null;
  title?: string | null;
  bio?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  locations?: string[] | null;
  /** Legacy single location string (web still checks this). */
  location?: string | null;
  knowledge?: string[] | null;
  skills?: string[] | null;
  attitude?: string[] | null;
  expectedCulture?: string | null;
  careerGoals?: string[] | null;
  expectedSalaryMin?: bigint | number | null;
  expectedSalaryMax?: bigint | number | null;
  workMode?: string | null;
  linkedin?: string | null;
};

export type BrevoMapperUser = {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  profile?: BrevoMapperProfile | null;
  experiences?: unknown[] | null;
  educations?: unknown[] | null;
};

/** Whitelist attributes we write to Brevo (names must exist on the account). */
export type BrevoContactAttributes = {
  EXT_ID: string;
  FIRSTNAME?: string;
  LASTNAME?: string;
  PHONE?: string;
  JOB_TITLE?: string;
  LINKEDIN?: string;
  CV_COMPLETED: boolean;
};

export type BrevoImportContact = {
  email: string;
  attributes: BrevoContactAttributes;
};

/**
 * Vietnamese name split: last token → FIRSTNAME (tên gọi), remainder → LASTNAME.
 * Single token → FIRSTNAME only.
 */
export function splitVietnameseName(fullName: string): {
  firstName: string;
  lastName?: string;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: '' };
  }
  const last = parts[parts.length - 1] ?? '';
  if (parts.length === 1) {
    return { firstName: last };
  }
  return {
    firstName: last,
    lastName: parts.slice(0, -1).join(' '),
  };
}

function isBasicInfoComplete(user: BrevoMapperUser): boolean {
  const profile = user.profile;
  const hasFullName = isFilledText(profile?.fullName || user.name);
  const hasTitle = isFilledText(profile?.title);
  const hasBio = isFilledText(profile?.bio);
  const hasContactEmail = isFilledText(profile?.contactEmail || user.email);
  const hasContactPhone = isFilledText(profile?.contactPhone || user.phone);
  const hasLocation =
    hasNonEmptyArrayItem(profile?.locations) || isFilledText(profile?.location);

  return (
    hasFullName &&
    hasTitle &&
    hasBio &&
    hasContactEmail &&
    hasContactPhone &&
    hasLocation
  );
}

/**
 * Same 5-section rule as joywork-web `buildProfileCompletion` /
 * `useProfileCompletion.ts`. Keep in sync manually.
 */
export function isCvCompleted(user: BrevoMapperUser): boolean {
  const profile = user.profile;

  const basicInfo = isBasicInfoComplete(user);
  const ksa =
    hasNonEmptyArrayItem(profile?.knowledge) ||
    hasNonEmptyArrayItem(profile?.skills) ||
    hasNonEmptyArrayItem(profile?.attitude);
  const expectations =
    isFilledText(profile?.expectedCulture) ||
    hasNonEmptyArrayItem(profile?.careerGoals) ||
    profile?.expectedSalaryMin != null ||
    profile?.expectedSalaryMax != null ||
    isFilledText(profile?.workMode);
  const experiences = (user.experiences || []).length > 0;
  const educations = (user.educations || []).length > 0;

  return basicInfo && ksa && expectations && experiences && educations;
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/** Map one user to Brevo import payload, or null if email invalid. */
export function mapUserToBrevoContact(user: BrevoMapperUser): BrevoImportContact | null {
  const email = user.email?.trim();
  if (!email || !isValidEmail(email)) {
    return null;
  }

  const displayName = (user.profile?.fullName || user.name || '').trim();
  const { firstName, lastName } = displayName
    ? splitVietnameseName(displayName)
    : { firstName: '', lastName: undefined };

  const phone = (user.phone || user.profile?.contactPhone || '').trim();
  const jobTitle = (user.profile?.title || '').trim();
  const linkedin = (user.profile?.linkedin || '').trim();

  const attributes: BrevoContactAttributes = {
    EXT_ID: user.id,
    CV_COMPLETED: isCvCompleted(user),
  };

  if (firstName) {
    attributes.FIRSTNAME = firstName;
  }
  if (lastName) {
    attributes.LASTNAME = lastName;
  }
  if (phone) {
    attributes.PHONE = phone;
  }
  if (jobTitle) {
    attributes.JOB_TITLE = jobTitle;
  }
  if (linkedin) {
    attributes.LINKEDIN = linkedin;
  }

  return { email, attributes };
}
