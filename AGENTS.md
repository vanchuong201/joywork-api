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
