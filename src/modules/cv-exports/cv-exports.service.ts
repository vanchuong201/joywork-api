import { AppError } from '@/shared/errors/errorHandler';
import { getProvinceNameByCode } from '@/shared/provinces';
import { WARD_BY_CODE } from '@/shared/wards';
import { CvFlipService } from '@/modules/cv-flip/cv-flip.service';
import { UserProfileService } from '@/modules/users/user-profile.service';
import {
  CvPdfContactItem,
  CvPdfDocument,
  CvPdfEducationItem,
  CvPdfExperienceItem,
  renderCvPdf,
} from './cv-pdf.renderer';

type VisibilityFlags = {
  bio: boolean;
  experience: boolean;
  education: boolean;
  ksa: boolean;
  expectations: boolean;
};

type ExportPdfResult = {
  fileName: string;
  buffer: Buffer;
  masked: boolean;
};

interface LooseRecord {
  [key: string]: unknown;
  id?: unknown;
  slug?: unknown;
  name?: unknown;
  fullName?: unknown;
  title?: unknown;
  headline?: unknown;
  bio?: unknown;
  visibility?: unknown;
  profile?: unknown;
  candidate?: unknown;
  access?: unknown;
  maskedInitials?: unknown;
  identityMasked?: unknown;
  maskedFields?: unknown;
  email?: unknown;
  phone?: unknown;
  contactEmail?: unknown;
  contactPhone?: unknown;
  website?: unknown;
  linkedin?: unknown;
  github?: unknown;
  cvUrl?: unknown;
  specificAddress?: unknown;
  location?: unknown;
  locations?: unknown;
  wardCodes?: unknown;
  dayOfBirth?: unknown;
  monthOfBirth?: unknown;
  yearOfBirth?: unknown;
  dateOfBirth?: unknown;
  address?: unknown;
  salaryCurrency?: unknown;
  expectedSalaryMin?: unknown;
  expectedSalaryMax?: unknown;
  workMode?: unknown;
  expectedCulture?: unknown;
  educationLevel?: unknown;
  knowledge?: unknown;
  skills?: unknown;
  attitude?: unknown;
  careerGoals?: unknown;
  experiences?: unknown;
  educations?: unknown;
  role?: unknown;
  company?: unknown;
  period?: unknown;
  desc?: unknown;
  achievements?: unknown;
  school?: unknown;
  degree?: unknown;
  gpa?: unknown;
  honors?: unknown;
  bioVisibility?: unknown;
  experience?: unknown;
  education?: unknown;
  ksa?: unknown;
  expectations?: unknown;
  isFlipped?: unknown;
  hasAppliedToCompany?: unknown;
}

const DEFAULT_VISIBILITY: VisibilityFlags = {
  bio: true,
  experience: true,
  education: true,
  ksa: true,
  expectations: true,
};

function asRecord(value: unknown): LooseRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as LooseRecord;
}

function asRecordArray(value: unknown): LooseRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(item => asRecord(item))
    .filter((item): item is LooseRecord => item !== null);
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(item => asString(item))
    .filter((item): item is string => item !== null)
    .map(item => sanitizeText(item))
    .filter(item => item.length > 0);
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  return null;
}

function sanitizeText(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Ký tự cấm trên filesystem/HTTP header + control chars; giữ nguyên Unicode (dấu tiếng Việt)
// eslint-disable-next-line no-control-regex
const FILE_NAME_FORBIDDEN_CHARS = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;
const FILE_NAME_BASE_MAX_LENGTH = 100;

/**
 * Tên file PDF theo tên ứng viên: `{Tên} - {Vị trí} - joywork.vn.pdf`.
 * Giữ dấu tiếng Việt; browser nhận tên đúng qua header `filename*=UTF-8''`.
 */
export function buildCvFileName(name: string, title: string | null): string {
  const clean = (value: string) =>
    value.replace(FILE_NAME_FORBIDDEN_CHARS, ' ').replace(/\s+/g, ' ').trim();

  const base = [clean(name), title ? clean(title) : '']
    .filter(part => part.length > 0)
    .join(' - ')
    .slice(0, FILE_NAME_BASE_MAX_LENGTH)
    .replace(/[\s-]+$/, '');

  return `${base || 'Ứng viên'} - joywork.vn.pdf`;
}

function toOptionalSanitized(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) {
    return null;
  }
  const text = sanitizeText(raw);
  return text.length > 0 ? text : null;
}

function toVisibility(value: unknown): VisibilityFlags {
  const data = asRecord(value);
  if (!data) {
    return DEFAULT_VISIBILITY;
  }
  return {
    bio: asBoolean(data.bio) ?? true,
    experience: asBoolean(data.experience) ?? true,
    education: asBoolean(data.education) ?? true,
    ksa: asBoolean(data.ksa) ?? true,
    expectations: asBoolean(data.expectations) ?? true,
  };
}

function formatBirthDate(profile: LooseRecord | null): string | null {
  if (!profile) {
    return null;
  }
  const day = asNumber(profile.dayOfBirth);
  const month = asNumber(profile.monthOfBirth);
  const year = asNumber(profile.yearOfBirth);
  if (!day && !month && !year) {
    return null;
  }
  const dd = day ? String(Math.trunc(day)).padStart(2, '0') : '??';
  const mm = month ? String(Math.trunc(month)).padStart(2, '0') : '??';
  const yyyy = year ? String(Math.trunc(year)) : '????';
  return `${dd}/${mm}/${yyyy}`;
}

function formatSalaryExpectation(profile: LooseRecord | null): string | null {
  if (!profile) {
    return null;
  }
  const currency = asString(profile.salaryCurrency) ?? 'VND';
  const min = asNumber(profile.expectedSalaryMin);
  const max = asNumber(profile.expectedSalaryMax);
  if (min === null && max === null) {
    return null;
  }

  const formatNumber = (value: number) =>
    new Intl.NumberFormat('vi-VN').format(Math.trunc(value));

  if (min !== null && max !== null) {
    return `${formatNumber(min)} - ${formatNumber(max)} ${currency}`;
  }
  if (min !== null) {
    return `Từ ${formatNumber(min)} ${currency}`;
  }
  return `Đến ${formatNumber(max ?? 0)} ${currency}`;
}

/**
 * Địa chỉ đầy đủ khớp web: `Địa chỉ cụ thể - Phường/Xã - Tỉnh/Thành`.
 * Phường/xã resolve từ `wardCodes`, tỉnh/thành ưu tiên `location` (đã resolve),
 * fallback resolve từ mã trong `locations`. Khi bị ẩn danh tính thì
 * `wardCodes`/`specificAddress` rỗng nên chỉ còn tỉnh/thành.
 */
function buildAddressValue(profile: LooseRecord | null): string | null {
  if (!profile) {
    return null;
  }

  const parts: string[] = [];

  const specific = toOptionalSanitized(profile.specificAddress);
  if (specific) {
    parts.push(specific);
  }

  const firstWardCode = asStringArray(profile.wardCodes).find(code =>
    code.includes('/')
  );
  if (firstWardCode) {
    const ward = WARD_BY_CODE.get(firstWardCode);
    if (ward) {
      const wardName = sanitizeText(ward.fullName ?? ward.name);
      if (wardName) {
        parts.push(wardName);
      }
    }
  }

  const provinceName = toOptionalSanitized(profile.location);
  if (provinceName) {
    parts.push(provinceName);
  } else {
    const firstProvinceCode = asStringArray(profile.locations)[0];
    if (firstProvinceCode) {
      parts.push(getProvinceNameByCode(firstProvinceCode) ?? firstProvinceCode);
    }
  }

  return parts.length > 0 ? parts.join(' - ') : null;
}

function isLikelyHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function buildExpectations(profile: LooseRecord | null): string[] {
  if (!profile) {
    return [];
  }
  const expectations: string[] = [];
  const salaryText = formatSalaryExpectation(profile);
  if (salaryText) {
    expectations.push(`Mức lương mong muốn: ${salaryText}`);
  }

  const workMode = toOptionalSanitized(profile.workMode);
  if (workMode) {
    expectations.push(`Hình thức làm việc: ${workMode}`);
  }

  const expectedCulture = toOptionalSanitized(profile.expectedCulture);
  if (expectedCulture) {
    expectations.push(`Văn hóa mong muốn: ${expectedCulture}`);
  }

  const educationLevel = toOptionalSanitized(profile.educationLevel);
  if (educationLevel) {
    expectations.push(`Trình độ học vấn: ${educationLevel}`);
  }

  return expectations;
}

function mapExperiences(value: unknown): CvPdfExperienceItem[] {
  return asRecordArray(value)
    .map(row => {
      const role = toOptionalSanitized(row.role) ?? 'Vai trò chưa cập nhật';
      const company =
        toOptionalSanitized(row.company) ?? 'Doanh nghiệp chưa cập nhật';
      const period = toOptionalSanitized(row.period);
      const description = toOptionalSanitized(row.desc);
      const achievements = asStringArray(row.achievements);
      return {
        role,
        company,
        period,
        description,
        achievements,
      };
    })
    .filter(row => Boolean(row.role || row.company));
}

function mapEducations(value: unknown): CvPdfEducationItem[] {
  return asRecordArray(value)
    .map(row => {
      const school = toOptionalSanitized(row.school) ?? 'Trường chưa cập nhật';
      const degree = toOptionalSanitized(row.degree) ?? 'Chưa cập nhật';
      const period = toOptionalSanitized(row.period);
      const gpa = toOptionalSanitized(row.gpa);
      const honors = toOptionalSanitized(row.honors);
      return {
        school,
        degree,
        period,
        gpa,
        honors,
      };
    })
    .filter(row => Boolean(row.school || row.degree));
}

function maskedValue(label: string): string {
  if (label.toLowerCase().includes('email')) {
    return 'Đã ẩn';
  }
  if (label.toLowerCase().includes('điện thoại')) {
    return 'Đã ẩn';
  }
  return 'Thông tin đã được ẩn';
}

export class CvExportsService {
  private readonly userProfileService: UserProfileService;
  private readonly cvFlipService: CvFlipService;

  constructor(
    userProfileService?: UserProfileService,
    cvFlipService?: CvFlipService
  ) {
    this.userProfileService = userProfileService ?? new UserProfileService();
    this.cvFlipService = cvFlipService ?? new CvFlipService();
  }

  async exportOwnCvPdf(userId: string): Promise<ExportPdfResult> {
    const ownProfile = await this.userProfileService.getOwnProfile(userId);
    const root = asRecord(ownProfile);
    if (!root) {
      throw new AppError(
        'Không tìm thấy hồ sơ ứng viên',
        404,
        'PROFILE_NOT_FOUND'
      );
    }

    const profile = asRecord(root.profile);
    const displayName =
      toOptionalSanitized(profile?.fullName) ??
      toOptionalSanitized(root.name) ??
      'Ứng viên';

    const contactItems: CvPdfContactItem[] = [];
    const contactEmail =
      toOptionalSanitized(profile?.contactEmail) ??
      toOptionalSanitized(root.email);
    if (contactEmail) {
      contactItems.push({ label: 'Email', value: contactEmail });
    }

    const contactPhone =
      toOptionalSanitized(profile?.contactPhone) ??
      toOptionalSanitized(root.phone);
    if (contactPhone) {
      contactItems.push({ label: 'Điện thoại', value: contactPhone });
    }

    const website = toOptionalSanitized(profile?.website);
    if (website && isLikelyHttpUrl(website)) {
      contactItems.push({ label: 'Website/Portfolio', value: website });
    }

    const linkedin = toOptionalSanitized(profile?.linkedin);
    if (linkedin && isLikelyHttpUrl(linkedin)) {
      contactItems.push({ label: 'LinkedIn', value: linkedin });
    }

    const github = toOptionalSanitized(profile?.github);
    if (github && isLikelyHttpUrl(github)) {
      contactItems.push({ label: 'GitHub', value: github });
    }

    const cvUrl = toOptionalSanitized(profile?.cvUrl);
    if (cvUrl && isLikelyHttpUrl(cvUrl)) {
      contactItems.push({ label: 'File CV', value: cvUrl });
    }

    const addressValue = buildAddressValue(profile);
    if (addressValue) {
      contactItems.push({ label: 'Khu vực', value: addressValue });
    }

    const birthDate = formatBirthDate(profile);
    if (birthDate) {
      contactItems.push({ label: 'Ngày sinh', value: birthDate });
    }

    const document: CvPdfDocument = {
      generatedAt: new Date(),
      displayName,
      title: toOptionalSanitized(profile?.title),
      headline: toOptionalSanitized(profile?.headline),
      masked: false,
      privacyNote: null,
      contactItems,
      summary: toOptionalSanitized(profile?.bio),
      knowledge: asStringArray(profile?.knowledge),
      skills: asStringArray(profile?.skills),
      attitude: asStringArray(profile?.attitude),
      expectations: buildExpectations(profile),
      careerGoals: asStringArray(profile?.careerGoals),
      experiences: mapExperiences(root.experiences),
      educations: mapEducations(root.educations),
    };

    const buffer = await renderCvPdf(document);
    return {
      buffer,
      fileName: buildCvFileName(displayName, document.title),
      masked: false,
    };
  }

  async exportCandidateCvPdf(params: {
    slug: string;
    viewerUserId: string;
    companyId: string;
  }): Promise<ExportPdfResult> {
    const detail = await this.cvFlipService.getCandidateDetail(
      params.slug,
      params.viewerUserId,
      {
        companyId: params.companyId,
      }
    );
    const detailRecord = asRecord(detail);
    const candidate = asRecord(detailRecord?.candidate);
    const access = asRecord(detailRecord?.access);
    if (!candidate) {
      throw new AppError(
        'Không tìm thấy hồ sơ ứng viên',
        404,
        'PROFILE_NOT_FOUND'
      );
    }

    const publicProfileRaw =
      await this.userProfileService.getPublicProfileBySlug(
        params.slug,
        params.viewerUserId,
        { companyId: params.companyId }
      );
    const publicProfile = asRecord(publicProfileRaw);
    if (!publicProfile) {
      throw new AppError(
        'Không tìm thấy hồ sơ ứng viên',
        404,
        'PROFILE_NOT_FOUND'
      );
    }

    const candidateProfile = asRecord(candidate.profile);
    const publicNestedProfile = asRecord(publicProfile.profile);
    const visibility = toVisibility(publicNestedProfile?.visibility);

    const identityMasked = asBoolean(candidate.identityMasked) ?? false;
    const maskedFields = asRecord(candidate.maskedFields);
    const displayName =
      toOptionalSanitized(candidate.name) ??
      toOptionalSanitized(candidate.maskedInitials) ??
      toOptionalSanitized(publicProfile.name) ??
      'Ứng viên';

    const contactItems: CvPdfContactItem[] = [];
    const pushContact = (
      label: string,
      value: string | null,
      maskKey?: string
    ) => {
      if (value) {
        contactItems.push({
          label,
          value,
          masked: identityMasked && Boolean(maskKey),
        });
        return;
      }
      if (identityMasked && maskKey && asBoolean(maskedFields?.[maskKey])) {
        contactItems.push({ label, value: maskedValue(label), masked: true });
      }
    };

    pushContact(
      'Email',
      toOptionalSanitized(candidateProfile?.contactEmail),
      'contactEmail'
    );
    pushContact(
      'Điện thoại',
      toOptionalSanitized(candidateProfile?.contactPhone),
      'contactPhone'
    );

    const website = toOptionalSanitized(candidateProfile?.website);
    pushContact(
      'Website/Portfolio',
      website && isLikelyHttpUrl(website) ? website : null,
      'website'
    );

    const linkedin = toOptionalSanitized(candidateProfile?.linkedin);
    pushContact(
      'LinkedIn',
      linkedin && isLikelyHttpUrl(linkedin) ? linkedin : null,
      'linkedin'
    );

    const github = toOptionalSanitized(candidateProfile?.github);
    pushContact(
      'GitHub',
      github && isLikelyHttpUrl(github) ? github : null,
      'github'
    );

    const cvUrl = toOptionalSanitized(candidateProfile?.cvUrl);
    pushContact(
      'File CV',
      cvUrl && isLikelyHttpUrl(cvUrl) ? cvUrl : null,
      'cvUrl'
    );

    const addressValue = buildAddressValue(candidateProfile);
    if (addressValue) {
      contactItems.push({
        label: 'Khu vực',
        value: addressValue,
        masked: identityMasked,
      });
    } else if (identityMasked && asBoolean(maskedFields?.address)) {
      contactItems.push({
        label: 'Khu vực',
        value: maskedValue('địa chỉ'),
        masked: true,
      });
    }

    const birthDate = formatBirthDate(candidateProfile);
    if (birthDate) {
      contactItems.push({
        label: 'Ngày sinh',
        value: birthDate,
        masked: identityMasked,
      });
    } else if (identityMasked && asBoolean(maskedFields?.dateOfBirth)) {
      contactItems.push({ label: 'Ngày sinh', value: 'Đã ẩn', masked: true });
    }

    const expectations = visibility.expectations
      ? buildExpectations(publicNestedProfile)
      : [];
    const careerGoals =
      visibility.expectations || visibility.bio
        ? asStringArray(publicNestedProfile?.careerGoals)
        : [];

    const isFlipped = asBoolean(access?.isFlipped) ?? false;
    const hasApplied = asBoolean(access?.hasAppliedToCompany) ?? false;
    const privacyNote =
      identityMasked || (!isFlipped && !hasApplied)
        ? 'Thông tin liên hệ và danh tính đang được ẩn theo quyền truy cập hiện tại của doanh nghiệp.'
        : null;

    const document: CvPdfDocument = {
      generatedAt: new Date(),
      displayName,
      title:
        toOptionalSanitized(publicNestedProfile?.title) ??
        toOptionalSanitized(candidateProfile?.title),
      headline:
        toOptionalSanitized(publicNestedProfile?.headline) ??
        toOptionalSanitized(candidateProfile?.headline),
      masked: identityMasked,
      privacyNote,
      contactItems,
      summary: visibility.bio
        ? toOptionalSanitized(publicNestedProfile?.bio)
        : null,
      knowledge: visibility.ksa
        ? asStringArray(publicNestedProfile?.knowledge)
        : [],
      skills: visibility.ksa ? asStringArray(publicNestedProfile?.skills) : [],
      attitude: visibility.ksa
        ? asStringArray(publicNestedProfile?.attitude)
        : [],
      expectations,
      careerGoals,
      experiences: visibility.experience
        ? mapExperiences(publicProfile.experiences)
        : [],
      educations: visibility.education
        ? mapEducations(publicProfile.educations)
        : [],
    };

    const buffer = await renderCvPdf(document);
    // Khi ẩn danh tính, tên file dùng initials — không được lộ tên thật
    const fileNameBase = identityMasked
      ? (toOptionalSanitized(candidate.maskedInitials) ?? displayName)
      : displayName;
    return {
      buffer,
      fileName: buildCvFileName(fileNameBase, document.title),
      masked: identityMasked,
    };
  }
}
