import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

export type CvPdfContactItem = {
  label: string;
  value: string;
  masked?: boolean;
};

export type CvPdfExperienceItem = {
  role: string;
  company: string;
  period: string | null;
  description: string | null;
  achievements: string[];
};

export type CvPdfEducationItem = {
  school: string;
  degree: string;
  period: string | null;
  gpa: string | null;
  honors: string | null;
};

export type CvPdfDocument = {
  generatedAt: Date;
  displayName: string;
  title: string | null;
  headline: string | null;
  masked: boolean;
  privacyNote: string | null;
  contactItems: CvPdfContactItem[];
  summary: string | null;
  knowledge: string[];
  skills: string[];
  attitude: string[];
  expectations: string[];
  careerGoals: string[];
  experiences: CvPdfExperienceItem[];
  educations: CvPdfEducationItem[];
};

type ResolvedFonts = {
  regular: string;
  medium: string;
  semibold: string;
  bold: string;
};

const MARGIN = 52;
// Vùng dưới cùng dành riêng cho footer nguồn + số trang
const BOTTOM_MARGIN = 64;
const FOOTER_BASELINE_OFFSET = 40;

const COLORS = {
  heading: '#0f172a',
  text: '#1e293b',
  secondary: '#475569',
  accent: '#1347cd', // --brand của joywork-web
  rule: '#e2e8f0',
  maskedText: '#92400e',
  maskedBg: '#fff7ed',
  maskedNote: '#9a3412',
};

// Fonts bundled trong repo (assets/fonts) để render tiếng Việt ổn định,
// không phụ thuộc font hệ thống của server.
const FONT_DIR_CANDIDATES = [
  // src/modules/cv-exports và dist/modules/cv-exports đều cách root 3 cấp
  path.resolve(__dirname, '../../../assets/fonts'),
  path.resolve(process.cwd(), 'assets/fonts'),
];

const FONT_FILES = [
  'BeVietnamPro-Regular.ttf',
  'BeVietnamPro-Medium.ttf',
  'BeVietnamPro-SemiBold.ttf',
  'BeVietnamPro-Bold.ttf',
];

function resolveFontDir(): string {
  // Đủ cả 4 weight mới hợp lệ — deploy thiếu file phải fail sớm với message
  // rõ ràng thay vì lỗi pdfkit khó hiểu lúc render.
  for (const dir of FONT_DIR_CANDIDATES) {
    if (FONT_FILES.every(file => fs.existsSync(path.join(dir, file)))) {
      return dir;
    }
  }
  throw new Error(
    `Không tìm thấy đủ bộ font Be Vietnam Pro (${FONT_FILES.join(', ')}) trong: ${FONT_DIR_CANDIDATES.join(', ')}`
  );
}

function resolveFonts(): ResolvedFonts {
  const dir = resolveFontDir();
  return {
    regular: path.join(dir, 'BeVietnamPro-Regular.ttf'),
    medium: path.join(dir, 'BeVietnamPro-Medium.ttf'),
    semibold: path.join(dir, 'BeVietnamPro-SemiBold.ttf'),
    bold: path.join(dir, 'BeVietnamPro-Bold.ttf'),
  };
}

function formatExportDate(value: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export async function renderCvPdf(document: CvPdfDocument): Promise<Buffer> {
  const fonts = resolveFonts();
  const doc = new PDFDocument({
    size: 'A4',
    bufferPages: true,
    margins: {
      top: MARGIN,
      left: MARGIN,
      right: MARGIN,
      bottom: BOTTOM_MARGIN,
    },
    info: {
      Title: `CV ${document.displayName} - joywork.vn`,
      Author: 'JoyWork',
      Subject: 'CV Export',
      CreationDate: document.generatedAt,
    },
  });

  doc.registerFont('Regular', fonts.regular);
  doc.registerFont('Medium', fonts.medium);
  doc.registerFont('SemiBold', fonts.semibold);
  doc.registerFont('Bold', fonts.bold);

  const left = doc.page.margins.left;
  const availableWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const contentBottom = () => doc.page.height - doc.page.margins.bottom;
  const ensureSpace = (height: number) => {
    if (doc.y + height > contentBottom()) {
      doc.addPage();
    }
  };

  const drawSectionTitle = (title: string) => {
    // Tiêu đề section không được mồ côi cuối trang
    ensureSpace(48);
    doc.moveDown(0.7);
    doc
      .font('SemiBold')
      .fontSize(10.5)
      .fillColor(COLORS.accent)
      .text(title.toUpperCase(), left, doc.y, {
        width: availableWidth,
        characterSpacing: 1.1,
      });
    const ruleY = doc.y + 3;
    doc
      .strokeColor(COLORS.rule)
      .lineWidth(1)
      .moveTo(left, ruleY)
      .lineTo(left + availableWidth, ruleY)
      .stroke();
    doc.y = ruleY + 10;
  };

  const drawParagraph = (
    text: string,
    opts?: { color?: string; fontSize?: number; font?: string }
  ) => {
    const normalized = normalizeText(text);
    if (!normalized) {
      return;
    }
    ensureSpace((opts?.fontSize ?? 10.5) * 2);
    doc
      .font(opts?.font ?? 'Regular')
      .fontSize(opts?.fontSize ?? 10.5)
      .fillColor(opts?.color ?? COLORS.text)
      .text(normalized, left, doc.y, {
        width: availableWidth,
        align: 'left',
        lineGap: 3,
      });
    doc.moveDown(0.35);
  };

  const drawBulletItems = (items: string[]) => {
    for (const rawItem of items) {
      const item = normalizeText(rawItem);
      if (!item) {
        continue;
      }
      ensureSpace(24);
      doc
        .font('Regular')
        .fontSize(10.5)
        .fillColor(COLORS.text)
        .text(`•  ${item}`, left + 4, doc.y, {
          width: availableWidth - 4,
          lineGap: 2,
        });
      doc.moveDown(0.2);
    }
  };

  // ---------- Header: tên + vị trí + liên hệ ----------
  doc
    .font('SemiBold')
    .fontSize(24)
    .fillColor(COLORS.heading)
    .text(document.displayName, left, doc.y, { width: availableWidth });

  const headingParts = [document.title, document.headline].filter(
    (value): value is string => Boolean(value)
  );
  if (headingParts.length > 0) {
    doc.moveDown(0.15);
    doc
      .font('Medium')
      .fontSize(13)
      .fillColor(COLORS.accent)
      .text(headingParts.join(' • '), left, doc.y, { width: availableWidth });
  }

  if (document.contactItems.length > 0) {
    doc.moveDown(0.45);
    for (const item of document.contactItems) {
      const line = `${item.label}: ${normalizeText(item.value)}`;
      if (!line.trim()) {
        continue;
      }
      ensureSpace(16);
      doc
        .font('Regular')
        .fontSize(9.5)
        .fillColor(item.masked ? COLORS.maskedText : COLORS.secondary)
        .text(line, left, doc.y, {
          width: availableWidth,
          lineGap: 2,
        });
      doc.moveDown(0.12);
    }
  }

  doc.moveDown(0.6);
  const headerRuleY = doc.y;
  doc
    .strokeColor(COLORS.accent)
    .lineWidth(1.5)
    .moveTo(left, headerRuleY)
    .lineTo(left + availableWidth, headerRuleY)
    .stroke();
  doc.y = headerRuleY + 14;

  // ---------- Ghi chú quyền riêng tư (masked) ----------
  if (document.privacyNote) {
    const note = normalizeText(document.privacyNote);
    doc.font('Regular').fontSize(9.5);
    const noteHeight = doc.heightOfString(note, {
      width: availableWidth - 20,
      lineGap: 2,
    });
    const boxHeight = noteHeight + 14;
    ensureSpace(boxHeight + 10);
    const boxY = doc.y;
    doc.save();
    doc.roundedRect(left, boxY, availableWidth, boxHeight, 6);
    doc.fillColor(COLORS.maskedBg).fill();
    doc.restore();
    doc.fillColor(COLORS.maskedNote).text(note, left + 10, boxY + 7, {
      width: availableWidth - 20,
      lineGap: 2,
    });
    doc.y = boxY + boxHeight + 12;
  }

  // ---------- Các section nội dung ----------
  if (document.summary) {
    drawSectionTitle('Giới thiệu');
    drawParagraph(document.summary);
  }

  if (document.experiences.length > 0) {
    drawSectionTitle('Kinh nghiệm làm việc');
    for (const experience of document.experiences) {
      // Giữ tiêu đề entry + dòng meta dính liền, không cắt ngang cuối trang
      ensureSpace(52);
      doc
        .font('SemiBold')
        .fontSize(11.5)
        .fillColor(COLORS.heading)
        .text(experience.role, left, doc.y, { width: availableWidth });
      const meta = [experience.company, experience.period]
        .filter((value): value is string => Boolean(value))
        .join('  ·  ');
      if (meta) {
        doc.moveDown(0.1);
        doc
          .font('Regular')
          .fontSize(9.5)
          .fillColor(COLORS.secondary)
          .text(meta, left, doc.y, { width: availableWidth });
      }
      doc.moveDown(0.3);
      if (experience.description) {
        drawParagraph(experience.description);
      }
      if (experience.achievements.length > 0) {
        drawBulletItems(experience.achievements);
      }
      doc.moveDown(0.4);
    }
  }

  const hasKsa =
    document.knowledge.length > 0 ||
    document.skills.length > 0 ||
    document.attitude.length > 0;
  if (hasKsa) {
    drawSectionTitle('Kiến thức - Kỹ năng - Thái độ');
    const ksaGroups: Array<[string, string[]]> = [
      ['Kiến thức', document.knowledge],
      ['Kỹ năng', document.skills],
      ['Thái độ', document.attitude],
    ];
    for (const [label, items] of ksaGroups) {
      if (items.length === 0) {
        continue;
      }
      drawParagraph(label, {
        color: COLORS.heading,
        fontSize: 10.5,
        font: 'SemiBold',
      });
      drawBulletItems(items);
      doc.moveDown(0.2);
    }
  }

  if (document.careerGoals.length > 0) {
    drawSectionTitle('Mục tiêu nghề nghiệp');
    drawBulletItems(document.careerGoals);
  }

  if (document.expectations.length > 0) {
    drawSectionTitle('Kỳ vọng công việc');
    drawBulletItems(document.expectations);
  }

  if (document.educations.length > 0) {
    drawSectionTitle('Học vấn');
    for (const education of document.educations) {
      ensureSpace(44);
      doc
        .font('SemiBold')
        .fontSize(11.5)
        .fillColor(COLORS.heading)
        .text(education.school, left, doc.y, { width: availableWidth });
      const details = [
        education.degree,
        education.period,
        education.gpa ? `GPA: ${education.gpa}` : null,
        education.honors,
      ].filter((value): value is string => Boolean(value));
      if (details.length > 0) {
        doc.moveDown(0.1);
        doc
          .font('Regular')
          .fontSize(9.5)
          .fillColor(COLORS.secondary)
          .text(details.join('  ·  '), left, doc.y, { width: availableWidth });
      }
      doc.moveDown(0.5);
    }
  }

  if (document.masked) {
    ensureSpace(40);
    doc.moveDown(0.4);
    doc
      .font('Regular')
      .fontSize(9)
      .fillColor(COLORS.maskedText)
      .text(
        'Bản PDF này được xuất theo quyền truy cập hiện tại của doanh nghiệp. Một số thông tin đã được ẩn để bảo vệ quyền riêng tư ứng viên.',
        left,
        doc.y,
        { width: availableWidth, align: 'left', lineGap: 2 }
      );
  }

  // ---------- Footer nguồn + số trang trên mọi trang ----------
  const pageRange = doc.bufferedPageRange();
  const totalPages = pageRange.start + pageRange.count;
  for (let i = pageRange.start; i < totalPages; i++) {
    doc.switchToPage(i);
    // Vẽ trong vùng bottom margin — tạm gỡ margin để pdfkit không tự sang trang
    const savedBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const footerY = doc.page.height - FOOTER_BASELINE_OFFSET;
    doc
      .strokeColor(COLORS.rule)
      .lineWidth(0.5)
      .moveTo(left, footerY - 7)
      .lineTo(left + availableWidth, footerY - 7)
      .stroke();
    doc
      .font('Regular')
      .fontSize(8.5)
      .fillColor(COLORS.secondary)
      .text(
        `Nguồn: joywork.vn  ·  Xuất ngày ${formatExportDate(document.generatedAt)}`,
        left,
        footerY,
        {
          width: availableWidth / 2,
          align: 'left',
          lineBreak: false,
          link: 'https://joywork.vn',
        }
      );
    doc.text(
      `Trang ${i + 1}/${totalPages}`,
      left + availableWidth / 2,
      footerY,
      {
        width: availableWidth / 2,
        align: 'right',
        lineBreak: false,
      }
    );

    doc.page.margins.bottom = savedBottomMargin;
  }

  const chunks: Buffer[] = [];
  const completion = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', chunk => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    doc.on('error', reject);
  });

  doc.end();
  return completion;
}
