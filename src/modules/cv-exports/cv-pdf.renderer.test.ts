import { describe, expect, it } from 'vitest';
import { CvPdfDocument, renderCvPdf } from './cv-pdf.renderer';

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const parsed = await parser.getText({
      pageJoiner: '\n',
      lineEnforce: true,
    });
    return parsed.text ?? '';
  } finally {
    try {
      await parser.destroy();
    } catch {
      // no-op
    }
  }
}

function buildBaseDocument(): CvPdfDocument {
  return {
    generatedAt: new Date('2026-07-15T09:00:00.000Z'),
    displayName: 'Test Candidate',
    title: 'Software Engineer',
    headline: 'Backend Focus',
    masked: false,
    privacyNote: null,
    contactItems: [],
    summary: 'Build and maintain hiring systems.',
    knowledge: ['Architecture'],
    skills: ['Node.js'],
    attitude: ['Ownership'],
    expectations: ['Mức lương mong muốn: 30,000,000 VND'],
    careerGoals: ['Lead engineering team'],
    experiences: [
      {
        role: 'Engineer',
        company: 'JoyWork',
        period: '2023 - nay',
        description: 'Phát triển API tuyển dụng.',
        achievements: ['Giảm 40% thời gian phản hồi API'],
      },
    ],
    educations: [
      {
        school: 'HCMUT',
        degree: 'Computer Science',
        period: '2015 - 2019',
        gpa: null,
        honors: null,
      },
    ],
  };
}

describe('renderCvPdf', () => {
  it('render PDF có dữ liệu liên hệ khi full access', async () => {
    const doc = buildBaseDocument();
    doc.contactItems = [
      { label: 'Email', value: 'candidate@example.com' },
      { label: 'Điện thoại', value: '0911222333' },
    ];

    const buffer = await renderCvPdf(doc);
    expect(buffer.byteLength).toBeGreaterThan(500);

    const extractedText = await extractTextFromPdf(buffer);
    expect(extractedText).toContain('candidate@example.com');
    expect(extractedText).toContain('Test Candidate');
  });

  it('render PDF masked không làm lộ email thật', async () => {
    const doc = buildBaseDocument();
    doc.masked = true;
    doc.privacyNote = 'Thông tin liên hệ bị ẩn theo quyền truy cập.';
    doc.contactItems = [
      { label: 'Email', value: 'Đã ẩn', masked: true },
      { label: 'Điện thoại', value: 'Đã ẩn', masked: true },
    ];

    const buffer = await renderCvPdf(doc);
    expect(buffer.byteLength).toBeGreaterThan(500);

    const extractedText = await extractTextFromPdf(buffer);
    expect(extractedText).toContain('Đã ẩn');
    expect(extractedText).not.toContain('candidate@example.com');
  });

  it('render đúng ký tự tiếng Việt có dấu', async () => {
    const doc = buildBaseDocument();
    doc.displayName = 'Nguyễn Văn Chương';
    doc.summary = 'Kỹ sư phần mềm với định hướng sản phẩm rõ ràng.';

    const buffer = await renderCvPdf(doc);
    const extractedText = await extractTextFromPdf(buffer);
    expect(extractedText).toContain('Nguyễn Văn Chương');
    expect(extractedText).toContain('định hướng sản phẩm');
  });

  it('có footer nguồn joywork.vn và số trang trên mọi trang', async () => {
    const doc = buildBaseDocument();
    // Nhiều kinh nghiệm để tràn sang trang 2
    doc.experiences = Array.from({ length: 15 }, (_, index) => ({
      role: `Vai trò ${index + 1}`,
      company: 'JoyWork',
      period: '2020 - 2023',
      description:
        'Phụ trách xây dựng và vận hành hệ thống tuyển dụng cho doanh nghiệp vừa và nhỏ tại Việt Nam.',
      achievements: ['Cải thiện quy trình tuyển dụng', 'Đào tạo đội ngũ mới'],
    }));

    const buffer = await renderCvPdf(doc);
    const extractedText = await extractTextFromPdf(buffer);

    const sourceMatches = extractedText.match(/Nguồn: joywork\.vn/g) ?? [];
    expect(sourceMatches.length).toBeGreaterThanOrEqual(2);
    expect(extractedText).toMatch(/Trang 1\/\d+/);
    expect(extractedText).toMatch(/Trang 2\/\d+/);
  });

  it('render được document tối thiểu không có section nào', async () => {
    const doc: CvPdfDocument = {
      generatedAt: new Date('2026-07-15T09:00:00.000Z'),
      displayName: 'Ứng viên',
      title: null,
      headline: null,
      masked: false,
      privacyNote: null,
      contactItems: [],
      summary: null,
      knowledge: [],
      skills: [],
      attitude: [],
      expectations: [],
      careerGoals: [],
      experiences: [],
      educations: [],
    };

    const buffer = await renderCvPdf(doc);
    expect(buffer.byteLength).toBeGreaterThan(500);
    const extractedText = await extractTextFromPdf(buffer);
    expect(extractedText).toContain('Ứng viên');
    expect(extractedText).toContain('Nguồn: joywork.vn');
  });
});
