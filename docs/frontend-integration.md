# Frontend Integration Guide (MVP)

- Base URL: http://localhost:4000
- Swagger: http://localhost:4000/docs
- Auth header: `Authorization: Bearer <accessToken>`
- Refresh token: HttpOnly cookie (set by backend on /api/auth/login, /api/auth/refresh)
- Error envelope: `{ "error": { "code": string, "message": string, "details"?: any } }`

## Auth endpoints
- POST /api/auth/register
- POST /api/auth/login → returns `{ user, accessToken }` + sets refresh cookie
- POST /api/auth/refresh → returns `{ accessToken }`
- POST /api/auth/logout
- GET /api/auth/me

## Users
- GET /api/users/me, PATCH /api/users/me
- GET /api/users/:id
- GET /api/users?q=

## Companies
- POST /api/companies
- GET /api/companies/:slug, GET /api/companies?q=, GET /api/companies/me
- PATCH /api/companies/:companyId
- Members: POST/PATCH/DELETE /api/companies/:companyId/members[/:userId]

## Posts
- GET /api/posts (feed), GET /api/companies/:companyId/posts, GET /api/posts/:postId
- POST /api/companies/:companyId/posts, PATCH /api/posts/:postId, DELETE /api/posts/:postId
- Like: POST /api/posts/:postId/like, DELETE /api/posts/:postId/like
- Publish: POST /api/posts/:postId/publish, /api/posts/:postId/unpublish

## Jobs
- GET /api/jobs, GET /api/jobs/:jobId
- POST /api/companies/:companyId/jobs, PATCH /api/jobs/:jobId, DELETE /api/jobs/:jobId
- Applications: POST /api/jobs/apply, GET /api/jobs/applications, PATCH /api/jobs/applications/:applicationId/status, GET /api/jobs/me/applications

## Inbox
- GET /api/inbox/conversations
- GET /api/inbox/messages?applicationId=...
- POST /api/inbox/messages
- PATCH /api/inbox/messages/:messageId/read
- PATCH /api/inbox/conversations/:applicationId/read
- GET /api/inbox/unread-count

## Axios client with refresh interceptor (suggested)
```ts
import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000',
  withCredentials: true,
});

let isRefreshing = false;
let queue: Array<() => void> = [];

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error?.response?.status === 401 && !original._retried) {
      original._retried = true;
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const { data } = await api.post('/api/auth/refresh');
          localStorage.setItem('accessToken', data.accessToken);
          queue.forEach((fn) => fn());
          queue = [];
        } finally {
          isRefreshing = false;
        }
      }
      return new Promise((resolve) => {
        queue.push(async () => {
          original.headers.Authorization = `Bearer ${localStorage.getItem('accessToken')}`;
          resolve(api(original));
        });
      });
    }
    return Promise.reject(error);
  }
);
```

## Frontend routes (suggested)
- /login, /register
- / (feed)
- /companies/[slug], /companies/new, /companies/[id]/settings
- /jobs, /jobs/[id]
- /applications
- /inbox, /inbox/[applicationId]

## Env (frontend)
- NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
