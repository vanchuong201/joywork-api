/**
 * Map JoyWork User → Brevo contact attributes (whitelist cứng).
 *
 * CV_ACTIVATE uses evaluateCandidateCvReadiness (same rule that gates job apply).
 * Do not invent new attributes — Marketing creates them in Brevo first, then we update this mapper.
 */

import { evaluateCandidateCvReadiness } from '@/shared/candidates/cv-readiness';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type BrevoMapperProfile = {
  fullName?: string | null;
  title?: string | null;
  bio?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  locations?: string[] | null;
  knowledge?: string[] | null;
  skills?: string[] | null;
  attitude?: string[] | null;
  linkedin?: string | null;
};

export type BrevoMapperUser = {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  profile?: BrevoMapperProfile | null;
  experiences?: unknown[] | null;
};

/** Whitelist attributes we write to Brevo (names must exist on the account). */
export type BrevoContactAttributes = {
  EXT_ID: string;
  FIRSTNAME?: string;
  LASTNAME?: string;
  PHONE?: string;
  JOB_TITLE?: string;
  LINKEDIN?: string;
  CV_ACTIVATE: boolean;
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

/** CV apply readiness → Brevo CV_ACTIVATE. */
export function isCvActivate(user: BrevoMapperUser): boolean {
  const profile = user.profile;
  return evaluateCandidateCvReadiness({
    name: user.name ?? null,
    email: user.email,
    phone: user.phone ?? null,
    profile: profile
      ? {
          fullName: profile.fullName ?? null,
          title: profile.title ?? null,
          bio: profile.bio ?? null,
          contactEmail: profile.contactEmail ?? null,
          contactPhone: profile.contactPhone ?? null,
          locations: profile.locations ?? null,
          knowledge: profile.knowledge ?? null,
          skills: profile.skills ?? null,
          attitude: profile.attitude ?? null,
        }
      : null,
    experiencesCount: (user.experiences || []).length,
  }).isReady;
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/** Map one user to Brevo import payload, or null if email invalid. */
export function mapUserToBrevoContact(user: BrevoMapperUser): BrevoImportContact | null {
  const email = user.email?.trim().toLowerCase();
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
    CV_ACTIVATE: isCvActivate(user),
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
