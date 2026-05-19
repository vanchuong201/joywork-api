import { AppError } from '@/shared/errors/errorHandler';
import { config } from '@/config/env';
import { parsedCvSchema, type ParsedCv } from '../cv-imports.schema';
import type { CvParserInput, CvParserProvider, CvParserResult } from './cv-parser.provider';

const SYSTEM_PROMPT = `Bạn là trợ lý trích xuất dữ liệu từ CV ứng viên.
Mục tiêu: chuyển nội dung CV thành JSON theo schema JoyWork để hệ thống tự gợi ý hồ sơ.

Quy tắc tuyệt đối:
- CHỈ trả về JSON hợp lệ, không thêm markdown, không thêm bình luận.
- Không bịa thông tin. Nếu CV không có dữ liệu cho trường nào, để null hoặc bỏ trống mảng.
- Giữ nguyên ngôn ngữ trong CV (tiếng Việt hoặc tiếng Anh) cho các trường mô tả.
- Không tự suy luận giới tính, năm sinh hay mức lương nếu CV không nêu rõ.
- Email/số điện thoại/website chỉ lấy khi xuất hiện trực tiếp trong CV.

Schema cần trả về (chỉ kèm field có trong CV):
{
  "basicInfo": { "fullName": string|null, "title": string|null, "headline": string|null, "bio": string|null, "gender": "MALE"|"FEMALE"|"OTHER"|null, "yearOfBirth": number|null },
  "contact": { "contactEmail": string|null, "contactPhone": string|null, "website": string|null, "linkedin": string|null, "github": string|null },
  "skills": string[],
  "knowledge": string[],
  "attitude": string[],
  "careerGoals": string[],
  "expectations": { "expectedSalaryMin": number|null, "expectedSalaryMax": number|null, "salaryCurrency": "VND"|"USD"|null, "workMode": string|null },
  "experiences": [ { "role": string|null, "company": string|null, "startDate": string|null, "endDate": string|null, "period": string|null, "desc": string|null, "achievements": string[] } ],
  "educations": [ { "school": string|null, "degree": string|null, "startDate": string|null, "endDate": string|null, "period": string|null, "gpa": string|null, "honors": string|null } ],
  "warnings": string[],
  "confidence": number
}

Hướng dẫn bổ sung:
- "title": vị trí ứng tuyển mong muốn nếu CV nêu, nếu không thì để null.
- "headline": câu giới thiệu ngắn ở đầu CV.
- "bio": phần giới thiệu/tóm tắt cá nhân (objective/summary), tối đa 1500 ký tự.
- "startDate"/"endDate": dạng YYYY hoặc YYYY-MM nếu có, nếu chỉ có chuỗi mô tả thì để null và đặt giá trị vào "period".
- "warnings": liệt kê các điểm bạn không chắc chắn (ngày tháng, tên công ty mơ hồ, OCR kém...).
- "confidence": từ 0 đến 1, ước lượng độ chắc chắn tổng thể.
`;

interface OpenAiChoice {
  message?: {
    content?: string | Array<{ type: string; text?: string }>;
  };
}

interface OpenAiUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface OpenAiResponse {
  choices?: OpenAiChoice[];
  usage?: OpenAiUsage;
  error?: { message?: string };
}

function extractAssistantText(payload: OpenAiResponse): string {
  const choice = payload.choices?.[0];
  if (!choice?.message?.content) {
    return '';
  }
  const content = choice.message.content;
  if (typeof content === 'string') return content;
  return content
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('');
}

function tryParseJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    // Đôi khi model wrap trong code fence dù đã yêu cầu - cố gắng nhặt block JSON đầu tiên.
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export class OpenAiCvParserProvider implements CvParserProvider {
  readonly name = 'openai';

  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor() {
    if (!config.OPENAI_API_KEY) {
      throw new AppError('Chưa cấu hình OPENAI_API_KEY cho CV Import', 503, 'CV_IMPORT_PROVIDER_DISABLED');
    }
    this.apiKey = config.OPENAI_API_KEY;
    this.model = config.CV_IMPORT_MODEL;
    this.baseUrl = (config.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  }

  async parse(input: CvParserInput): Promise<CvParserResult> {
    const userPrompt = this.buildUserPrompt(input);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const raw = await response.text();
      let providerMessage = `OpenAI parse failed (${response.status})`;
      try {
        const parsed = JSON.parse(raw) as OpenAiResponse;
        if (parsed?.error?.message) {
          providerMessage = parsed.error.message;
        }
      } catch {
        // Bỏ qua, dùng message mặc định.
      }
      throw new AppError('Không thể đọc CV bằng AI. Vui lòng thử lại sau.', 502, 'CV_IMPORT_PROVIDER_ERROR', {
        provider: this.name,
        status: response.status,
        message: providerMessage,
      });
    }

    const payload = (await response.json()) as OpenAiResponse;
    const text = extractAssistantText(payload);
    const json = tryParseJson(text);

    if (!json || typeof json !== 'object') {
      throw new AppError('CV không thể đọc được, vui lòng thử CV khác', 422, 'CV_IMPORT_PARSE_INVALID_JSON');
    }

    const result = parsedCvSchema.safeParse(json);
    if (!result.success) {
      throw new AppError('Dữ liệu trích xuất không hợp lệ', 422, 'CV_IMPORT_PARSE_INVALID_SHAPE', result.error.flatten());
    }

    const parsed: ParsedCv = result.data;

    const usage: NonNullable<CvParserResult['usage']> = {};
    if (typeof payload.usage?.prompt_tokens === 'number') usage.promptTokens = payload.usage.prompt_tokens;
    if (typeof payload.usage?.completion_tokens === 'number') usage.completionTokens = payload.usage.completion_tokens;
    if (typeof payload.usage?.total_tokens === 'number') usage.totalTokens = payload.usage.total_tokens;

    return {
      parsed,
      modelId: this.model,
      usage,
    };
  }

  private buildUserPrompt(input: CvParserInput): string {
    const localeHint = input.localeHint ?? 'auto';
    const trimmed = input.text.slice(0, config.CV_IMPORT_MAX_TEXT_CHARS);
    return [
      `Ngôn ngữ ưu tiên: ${localeHint}.`,
      'Dưới đây là toàn bộ nội dung CV. Hãy trả về JSON đúng schema.',
      '----- CV TEXT START -----',
      trimmed,
      '----- CV TEXT END -----',
    ].join('\n');
  }
}
