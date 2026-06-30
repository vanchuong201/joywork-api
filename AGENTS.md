# JoyWork API Agent Guide

This repo is a Fastify + Prisma backend organized by feature modules.

Follow `.cursor/rules/*.mdc` first. Use this file as the short default guide:

- Match existing backend formatting: `single quotes`, semicolons, and `@/` alias imports inside `src`.
- Keep module structure consistent with `controller`, `service`, `routes`, and `schema` files under `src/modules/*`.
- Keep backend filenames aligned with the current style such as `jobs.routes.ts`, `auth.controller.ts`, or `user-profile.service.ts`.
- Return success responses in the current envelope shape `{ data: ... }` and error responses through `AppError` plus the shared error handler.
- Validate external input before use, keep Zod parsing and Swagger route schemas accurate, and enforce auth with the existing middleware pattern.
- Prefer named exports for new backend files, especially routes; do not add test or demo routes to production modules.
- Do not leave `console.*`, localhost instrumentation, or temporary debug hooks in `src/**`; use Fastify logging patterns when logging is necessary.
- Reuse shared helpers in `src/shared` and `src/config` instead of duplicating Prisma, auth, storage, or email clients.
- Make database changes through Prisma schema plus migrations, never by manual production schema edits.
- Before finishing meaningful backend work, run the most relevant checks available, typically `npm run lint`, `npm run type-check`, and targeted tests when they exist.

## Git & release

Tuân thủ `deploy/GIT_WORKFLOW.md` (repo deploy) và `.cursor/rules/git-workflow.mdc`:

- Làm việc trên `develop`; push → auto deploy staging.
- Release prod: promote `main` bằng **`git merge --ff-only develop`** hoặc **`gh pr merge --rebase`** (không `--merge` thường xuyên).
- Deploy prod từ repo `deploy` (`Deploy Production` workflow).

## Admin / vận hành (`/api/system`)

- Toàn bộ endpoint vận hành nền tảng (overview, users, companies, reports, xác minh công ty, khóa tài khoản) nằm trong module **`src/modules/system`**, prefix **`/api/system`**, bảo vệ bằng `verifyToken` + `requireAdmin`.
- `User.accountStatus`: `ACTIVE` | `SUSPENDED` — đăng nhập và mọi request sau JWT gọi `assertUserActive` (trừ khi chỉ verify token mà không cần; optionalAuth cũng bỏ qua user nếu assert lỗi).
- **joywork-admin** (repo riêng) dùng JWT ADMIN qua BFF; CORS tới admin origin đã có `ADMIN_CP_ORIGIN` / tương đương khi cần.

## Cursor Cloud specific instructions

Repo này chỉ là **JoyWork API** (Fastify + Prisma). Không có frontend hay `docker-compose` trong repo.

### Khởi động nhanh

1. `cp .env.example .env` — chỉnh `DATABASE_URL`, `JWT_SECRET` / `REFRESH_SECRET` (≥32 ký tự), và `AWS_*` nếu cần upload thật.
2. `npm run db:deploy` — áp migration lên PostgreSQL (bắt buộc trước khi chạy API).
3. `npm run dev` — API lắng nghe mặc định **port 4000** (`tsx watch src/server.ts`).

`.env.example` trỏ tới PostgreSQL dev dùng chung (`123.30.48.38`). **Không chạy `npm run db:seed`** trên DB dùng chung (seed xóa toàn bộ dữ liệu). Để test auth, đăng ký user mới qua `POST /api/auth/register` hoặc dùng DB local + seed.

### Kiểm tra / demo API

| Endpoint | Mục đích |
|---|---|
| `GET /health` | Health check |
| `GET /docs` | Swagger UI |
| `POST /api/auth/register` | Tạo user test |
| `POST /api/auth/login` | Lấy JWT |
| `GET /api/jobs` | Danh sách việc làm (có/không JWT tùy route) |

### Lint / test / build

- `npm run type-check` — TypeScript (`tsc --noEmit`)
- `npm test -- --run` — Vitest (mock, không cần DB)
- `npm run build` — biên dịch `dist/`
- `npm run lint` — **hiện lỗi cấu hình ESLint** (`@typescript-eslint/recommended` trong `.eslintrc.json` cần prefix `plugin:`); dùng `type-check` + test thay thế cho đến khi sửa config.

### Dịch vụ ngoài repo (tùy chọn)

- **JoyWork web** (repo riêng, port 3000) — E2E UI; set `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`.
- **AWS S3 / SES** — bắt buộc có giá trị trong `.env` để server boot; upload/email thật cần credential hợp lệ.
- **joywork-admin** — repo riêng; cần `ADMIN_CP_ORIGIN` cho CORS.
