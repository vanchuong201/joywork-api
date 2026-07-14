import { describe, expect, it } from 'vitest';
import { collapseSpacedLetters } from '../cv-file-extractor';

describe('collapseSpacedLetters', () => {
  it('ghép heading Canva bị letter-spacing', () => {
    expect(collapseSpacedLetters('H Ọ C V Ấ N')).toBe('HỌCVẤN');
    expect(collapseSpacedLetters('T A L E N T A C Q U I S I T I O N')).toBe('TALENTACQUISITION');
    expect(collapseSpacedLetters('K I N H N G H I Ệ M L À M V I Ệ C')).toBe('KINHNGHIỆMLÀMVIỆC');
    expect(collapseSpacedLetters('T h a m c h i ế u')).toBe('Thamchiếu');
  });

  it('giữ nguyên câu thường và SĐT có khoảng cách', () => {
    expect(collapseSpacedLetters('Kỹ năng giao tiếp khéo léo')).toBe('Kỹ năng giao tiếp khéo léo');
    expect(collapseSpacedLetters('0966 805 348')).toBe('0966 805 348');
    expect(collapseSpacedLetters('VŨ MINH')).toBe('VŨ MINH');
  });

  it('không gộp các dòng heading liền nhau', () => {
    const input = [
      'T A L E N T A C Q U I S I T I O N',
      'K I N H N G H I Ệ M L À M V I Ệ C',
      'D A N H H I Ệ U',
    ].join('\n');
    expect(collapseSpacedLetters(input)).toBe(
      ['TALENTACQUISITION', 'KINHNGHIỆMLÀMVIỆC', 'DANHHIỆU'].join('\n')
    );
  });

  it('chỉ collapse token đủ dài và không đụng sang chữ kế cận', () => {
    const input = 'MỤC TIÊU\nH Ọ C V Ấ N\nNgắn hạn: Talent Acquisition';
    expect(collapseSpacedLetters(input)).toBe('MỤC TIÊU\nHỌCVẤN\nNgắn hạn: Talent Acquisition');
  });
});
