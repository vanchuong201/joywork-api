/*
 * k6 baseline load test — campaign 10k user/phút (~167 user/s).
 *
 * MỤC ĐÍCH: đo điểm gãy của API theo mô hình tải campaign hỗn hợp, để so sánh
 * trước/sau các tối ưu (Phase 2...) và quyết go/no-go.
 *
 * TIỀN ĐỀ (QUAN TRỌNG):
 *   - Code Phase 2 (bcrypt native + async email) PHẢI đã deploy lên môi trường đo.
 *     Prod chạy từ main/tag; thay đổi đang ở `develop` → deploy lên STAGING trước.
 *   - KHÔNG chạy trên prod đang phục vụ thật. Dùng staging.
 *   - Chạy k6 từ máy NGOÀI server target (đừng cùng box) để latency thực tế.
 *
 * CÁCH CHẠY:
 *   BASE_URL=https://api-staging.joywork.vn k6 run loadtest/k6-baseline.js
 *   # ramp thử nhanh: K6_STAGE=smoke
 *   # nhắm 1 mốc cố định: TARGET_RPS=167 DURATION=3m k6 run ...
 *
 * ĐỌC KẾT QUẢ: tìm rps mà p95 vượt ngưỡng / error bắt đầu tăng. Ghi vào
 *   plans/260621-0345-scale-campaign-10k-users/reports/baseline-metrics.md
 *
 * MÔ HÌNH TẢI (điều chỉnh % theo xác nhận của product):
 *   - 100% user: browse jobs (no-auth GET, dùng ES)  -> cohort 'browse'
 *   -  25% user: đăng ký mật khẩu (bcrypt)            -> cohort 'register'  (nghẽn chính)
 *   -  15% user: Google OAuth (social)                -> KHÔNG k6 được (redirect) — bỏ, đo riêng nếu cần
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const REGISTER_RATIO = Number(__ENV.REGISTER_RATIO || 0.25); // % user đăng ký mật khẩu

// Header bí mật để bỏ qua rate-limit per-IP khi test từ 1 nguồn (server phải set RATE_LIMIT_BYPASS_KEY).
const LOADTEST_KEY = __ENV.LOADTEST_KEY || '';
const COMMON_HEADERS = LOADTEST_KEY ? { 'x-loadtest-key': LOADTEST_KEY } : {};

// Arrival-rate target (user/giây). 167 = 10k/phút.
const TARGET_RPS = Number(__ENV.TARGET_RPS || 167);

// Per-cohort metrics
const errorRate = new Rate('campaign_errors');
const registerDuration = new Trend('register_duration', true);
const browseDuration = new Trend('browse_duration', true);

// Bậc ramp mặc định: 0 -> 50 -> 100 -> 167 user/s, mỗi bậc giữ 2 phút để thấy điểm gãy.
const RAMP_STAGES = [
  { target: 50, duration: '1m' },
  { target: 50, duration: '2m' },
  { target: 100, duration: '1m' },
  { target: 100, duration: '2m' },
  { target: TARGET_RPS, duration: '1m' },
  { target: TARGET_RPS, duration: '2m' },
  { target: 0, duration: '30s' },
];
const SMOKE_STAGES = [
  { target: 10, duration: '30s' },
  { target: 0, duration: '10s' },
];

export const options = {
  scenarios: {
    campaign_user: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: 200,
      maxVUs: 2000,
      stages: __ENV.K6_STAGE === 'smoke' ? SMOKE_STAGES : RAMP_STAGES,
    },
  },
  thresholds: {
    campaign_errors: ['rate<0.005'],           // < 0.5% lỗi
    register_duration: ['p(95)<500'],          // SLA đăng ký
    browse_duration: ['p(95)<300'],            // SLA browse
    http_req_failed: ['rate<0.01'],
  },
};

const SEARCH_TERMS = ['developer', 'kế toán', 'marketing', 'nhân viên', 'sales', 'thiết kế', ''];

function browse() {
  const q = SEARCH_TERMS[Math.floor(Math.random() * SEARCH_TERMS.length)];
  const res = http.get(`${BASE_URL}/api/jobs/?q=${encodeURIComponent(q)}&page=1&limit=20`, {
    headers: COMMON_HEADERS,
    tags: { name: 'browse_list' },
  });
  browseDuration.add(res.timings.duration);
  const ok = check(res, { 'browse 200': (r) => r.status === 200 });
  errorRate.add(!ok);

  // Mở chi tiết 1 job nếu lấy được id (cố gắng vài path response phổ biến).
  let jobId;
  try {
    const body = res.json();
    jobId =
      body?.data?.jobs?.[0]?.id ||
      body?.data?.items?.[0]?.id ||
      body?.data?.[0]?.id;
  } catch (_) {
    /* ignore parse */
  }
  if (jobId) {
    const detail = http.get(`${BASE_URL}/api/jobs/${jobId}`, { headers: COMMON_HEADERS, tags: { name: 'browse_detail' } });
    browseDuration.add(detail.timings.duration);
    errorRate.add(!check(detail, { 'detail 200': (r) => r.status === 200 }));
  }
}

function register() {
  // AWS SES mailbox simulator — gửi thành công, KHÔNG bounce, KHÔNG ảnh hưởng reputation
  // (an toàn với SES production). Label sau dấu '+' giữ email unique để thực sự chạy bcrypt.
  const email = `success+lt_${__VU}_${__ITER}_${randomString(6)}@simulator.amazonses.com`;
  const payload = JSON.stringify({ email, password: 'LoadTest123!', name: `LT ${randomString(4)}` });
  const res = http.post(`${BASE_URL}/api/auth/register`, payload, {
    headers: { 'Content-Type': 'application/json', ...COMMON_HEADERS },
    tags: { name: 'register' },
  });
  registerDuration.add(res.timings.duration);
  // 201 tạo mới; 409 email trùng cũng coi là "API phản hồi đúng" (không tính lỗi tải).
  const ok = check(res, { 'register 201/409': (r) => r.status === 201 || r.status === 409 });
  errorRate.add(!ok);
}

export default function () {
  // Mỗi iteration = 1 user tới. Luôn browse; một phần đăng ký.
  browse();
  if (Math.random() < REGISTER_RATIO) {
    register();
  }
  sleep(Math.random() * 1); // think-time nhẹ
}
