import type { ParsedCv } from '../cv-imports.schema';

export interface CvParserInput {
  text: string;
  localeHint?: 'vi' | 'en' | 'auto';
}

export interface CvParserResult {
  parsed: ParsedCv;
  modelId: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/**
 * Interface để JW tách quyền chọn model/provider parse CV ra khỏi business flow.
 * Hiện tại có OpenAI provider; sau này có thể thêm Anthropic, AI Gateway, hoặc parser CV chuyên biệt.
 */
export interface CvParserProvider {
  readonly name: string;
  parse(input: CvParserInput): Promise<CvParserResult>;
}
