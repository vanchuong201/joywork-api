import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CvFlipService } from '@/modules/cv-flip/cv-flip.service';
import { UserProfileService } from '@/modules/users/user-profile.service';
import { renderCvPdf } from './cv-pdf.renderer';
import { buildCvFileName, CvExportsService } from './cv-exports.service';

vi.mock('./cv-pdf.renderer', async () => {
  const actual =
    await vi.importActual<typeof import('./cv-pdf.renderer')>(
      './cv-pdf.renderer'
    );
  return {
    ...actual,
    renderCvPdf: vi.fn().mockResolvedValue(Buffer.from('pdf-buffer')),
  };
});

describe('CvExportsService', () => {
  const renderCvPdfMock = vi.mocked(renderCvPdf);
  const mockUserProfileService = {
    getOwnProfile: vi.fn(),
    getPublicProfileBySlug: vi.fn(),
  };
  const mockCvFlipService = {
    getCandidateDetail: vi.fn(),
  };

  const service = new CvExportsService(
    mockUserProfileService as unknown as UserProfileService,
    mockCvFlipService as unknown as CvFlipService
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('xuất PDF đầy đủ cho ứng viên sở hữu CV', async () => {
    mockUserProfileService.getOwnProfile.mockResolvedValue({
      id: 'user_1',
      slug: 'ung-vien-1',
      name: 'Nguyen Van A',
      email: 'owner@example.com',
      profile: {
        fullName: 'Nguyen Van A',
        title: 'Talent Acquisition',
        headline: '8 năm tuyển dụng',
        contactPhone: '0909000999',
        website: 'https://joywork.vn',
        bio: 'Kinh nghiệm xây hệ thống tuyển dụng nội bộ.',
        skills: ['Talent Mapping'],
        knowledge: ['Labor market'],
        attitude: ['Ownership'],
        careerGoals: ['Lead TA team'],
      },
      experiences: [
        {
          role: 'TA Lead',
          company: 'JoyWork',
          period: '2021 - nay',
          desc: 'Quản lý team tuyển dụng',
          achievements: ['Tăng 40% tỉ lệ tuyển đúng hạn'],
        },
      ],
      educations: [
        {
          school: 'UEH',
          degree: 'Human Resource Management',
          period: '2012 - 2016',
        },
      ],
    });

    const result = await service.exportOwnCvPdf('user_1');

    expect(result.fileName).toBe(
      'Nguyen Van A - Talent Acquisition - joywork.vn.pdf'
    );
    expect(result.masked).toBe(false);
    expect(result.buffer.equals(Buffer.from('pdf-buffer'))).toBe(true);
    expect(renderCvPdfMock).toHaveBeenCalledTimes(1);

    const payload = renderCvPdfMock.mock.calls[0]?.[0];
    expect(payload?.displayName).toBe('Nguyen Van A');
    expect(payload?.masked).toBe(false);
    expect(payload?.contactItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Email', value: 'owner@example.com' }),
        expect.objectContaining({ label: 'Điện thoại', value: '0909000999' }),
      ])
    );
    expect(payload?.skills).toContain('Talent Mapping');
  });

  it('xuất PDF dạng masked cho doanh nghiệp chưa mở CV', async () => {
    mockCvFlipService.getCandidateDetail.mockResolvedValue({
      candidate: {
        slug: 'masked-candidate',
        name: 'NVA',
        identityMasked: true,
        maskedInitials: 'NVA',
        maskedFields: {
          contactEmail: true,
          contactPhone: true,
          cvUrl: true,
          website: true,
          linkedin: false,
          github: false,
          address: true,
          dateOfBirth: true,
        },
        profile: {
          contactEmail: null,
          contactPhone: null,
          cvUrl: null,
          website: null,
          linkedin: null,
          github: null,
          specificAddress: null,
          locations: [],
          dayOfBirth: null,
          monthOfBirth: null,
          yearOfBirth: null,
          title: 'Marketing',
          headline: 'Growth',
        },
      },
      access: {
        isFlipped: false,
        hasAppliedToCompany: false,
      },
    });

    mockUserProfileService.getPublicProfileBySlug.mockResolvedValue({
      id: 'candidate_1',
      name: 'NVA',
      profile: {
        title: 'Marketing',
        headline: 'Growth',
        visibility: {
          bio: false,
          experience: true,
          education: false,
          ksa: true,
          expectations: true,
        },
        skills: ['SEO'],
        knowledge: ['Analytics'],
        attitude: ['Collaborative'],
        expectedSalaryMin: 20000000,
        salaryCurrency: 'VND',
      },
      experiences: [
        {
          role: 'Senior Marketer',
          company: 'JoyWork',
          period: '2022 - nay',
          achievements: ['Tăng conversion 30%'],
        },
      ],
      educations: [
        {
          school: 'UEH',
          degree: 'Marketing',
        },
      ],
    });

    const result = await service.exportCandidateCvPdf({
      slug: 'masked-candidate',
      viewerUserId: 'viewer_1',
      companyId: 'company_1',
    });

    expect(result.masked).toBe(true);
    expect(result.fileName).toBe('NVA - Marketing - joywork.vn.pdf');
    const payload = renderCvPdfMock.mock.calls[0]?.[0];
    expect(payload?.masked).toBe(true);
    expect(payload?.summary).toBeNull();
    expect(payload?.privacyNote).toBeTruthy();
    expect(payload?.contactItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Email',
          value: 'Đã ẩn',
          masked: true,
        }),
        expect.objectContaining({
          label: 'Điện thoại',
          value: 'Đã ẩn',
          masked: true,
        }),
      ])
    );
    expect(payload?.experiences).toHaveLength(1);
    expect(payload?.educations).toHaveLength(0);
  });

  it('xuất PDF full contact cho doanh nghiệp đã có quyền xem', async () => {
    mockCvFlipService.getCandidateDetail.mockResolvedValue({
      candidate: {
        slug: 'full-candidate',
        name: 'Tran Thi B',
        identityMasked: false,
        maskedFields: null,
        profile: {
          contactEmail: 'candidate@example.com',
          contactPhone: '0911222333',
          website: 'https://portfolio.dev',
          cvUrl: 'https://cdn.joywork.vn/cv.pdf',
          title: 'Backend Engineer',
          headline: 'Node.js',
          locations: ['HCM'],
        },
      },
      access: {
        isFlipped: true,
        hasAppliedToCompany: false,
      },
    });

    mockUserProfileService.getPublicProfileBySlug.mockResolvedValue({
      id: 'candidate_2',
      profile: {
        title: 'Backend Engineer',
        headline: 'Node.js',
        bio: 'Xây dựng hệ thống API scale.',
        visibility: {
          bio: true,
          experience: true,
          education: true,
          ksa: true,
          expectations: true,
        },
        expectedSalaryMin: 30000000,
        expectedSalaryMax: 40000000,
        salaryCurrency: 'VND',
      },
      experiences: [],
      educations: [],
    });

    const result = await service.exportCandidateCvPdf({
      slug: 'full-candidate',
      viewerUserId: 'viewer_2',
      companyId: 'company_2',
    });

    expect(result.fileName).toBe(
      'Tran Thi B - Backend Engineer - joywork.vn.pdf'
    );
    const payload = renderCvPdfMock.mock.calls[0]?.[0];
    expect(payload?.masked).toBe(false);
    expect(payload?.privacyNote).toBeNull();
    expect(payload?.contactItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Email',
          value: 'candidate@example.com',
        }),
        expect.objectContaining({ label: 'Điện thoại', value: '0911222333' }),
      ])
    );
    expect(payload?.expectations.join(' ')).toContain('Mức lương mong muốn');
  });
});

describe('buildCvFileName', () => {
  it('giữ dấu tiếng Việt và ghép tên với vị trí', () => {
    expect(buildCvFileName('Nguyễn Văn An', 'Frontend Developer')).toBe(
      'Nguyễn Văn An - Frontend Developer - joywork.vn.pdf'
    );
  });

  it('bỏ phần vị trí khi không có title', () => {
    expect(buildCvFileName('Nguyễn Văn An', null)).toBe(
      'Nguyễn Văn An - joywork.vn.pdf'
    );
  });

  it('loại ký tự cấm của filesystem nhưng giữ Unicode', () => {
    expect(buildCvFileName('Trần "Bé" <B>/C\\D', 'Dev:Ops*?|')).toBe(
      'Trần Bé B C D - Dev Ops - joywork.vn.pdf'
    );
  });

  it('giới hạn độ dài phần tên và không kết thúc bằng dấu gạch', () => {
    const longName = 'A'.repeat(150);
    const fileName = buildCvFileName(longName, 'Developer');
    expect(fileName.endsWith(' - joywork.vn.pdf')).toBe(true);
    expect(fileName.length).toBeLessThanOrEqual(
      100 + ' - joywork.vn.pdf'.length
    );
  });

  it('fallback khi tên rỗng sau khi sanitize', () => {
    expect(buildCvFileName('///', null)).toBe('Ứng viên - joywork.vn.pdf');
  });
});
