import { describe, expect, it } from 'vitest';
import {
  buildDriveDownloadUrl,
  buildGoogleDocExportPdfUrl,
  extractGoogleDocId,
  extractGoogleDriveFileId,
} from './cv-link-fetcher';

describe('cv-link-fetcher helpers', () => {
  it('extract Google Drive file id from view URL', () => {
    expect(
      extractGoogleDriveFileId('https://drive.google.com/file/d/1wfsDXzSgwF1sf7IXXQ_VKIrvkm-WqC7K/view?usp=sharing'),
    ).toBe('1wfsDXzSgwF1sf7IXXQ_VKIrvkm-WqC7K');
  });

  it('extract Google Doc id', () => {
    expect(
      extractGoogleDocId('https://docs.google.com/document/d/1x5BHuNwAy1DANcADZsPUNCr2gIIA3buAKIrp806Sq8I/edit?tab=t.0'),
    ).toBe('1x5BHuNwAy1DANcADZsPUNCr2gIIA3buAKIrp806Sq8I');
  });

  it('build download/export URLs', () => {
    expect(buildDriveDownloadUrl('abc123')).toBe('https://drive.google.com/uc?export=download&id=abc123');
    expect(buildGoogleDocExportPdfUrl('doc99')).toBe(
      'https://docs.google.com/document/d/doc99/export?format=pdf',
    );
  });
});
