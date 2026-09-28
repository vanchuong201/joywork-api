import { Prisma, type ApplicationStatus } from '@prisma/client';
import { prisma } from '@/shared/database/prisma';
import { AppError } from '@/shared/errors/errorHandler';
import {
  buildCvSnapshot,
  CV_SNAPSHOT_VERSION,
  parseCvSnapshot,
  type CvSnapshotV1,
} from '@/modules/candidate-cvs/cv-snapshot';
import { CV_SECTION_ORDER_BY } from '@/modules/candidate-cvs/candidate-cvs.service';

export type ApplicationHistoryItem = {
  id: string;
  appliedAt: Date;
  status: ApplicationStatus;
  sourceCvId: string | null;
  sourceCvName: string | null;
};

const historyKey = (userId: string, jobId: string) => `${userId}:${jobId}`;

/**
 * Snapshot của đơn; đơn cũ chưa có snapshot → dựng từ CV mặc định hiện tại, lưu lại (`source: 'backfill'`).
 * Trả null khi ứng viên không còn CV nào để dựng.
 */
export async function ensureApplicationSnapshot(application: {
  id: string;
  userId: string;
  sourceCvId: string | null;
  cvSnapshot: Prisma.JsonValue | null;
}): Promise<CvSnapshotV1 | null> {
  const existing = parseCvSnapshot(application.cvSnapshot);
  if (existing) return existing;

  const user = await prisma.user.findUnique({
    where: { id: application.userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      slug: true,
      profile: {
        select: {
          defaultCv: {
            include: {
              experiences: { orderBy: CV_SECTION_ORDER_BY },
              educations: { orderBy: CV_SECTION_ORDER_BY },
            },
          },
        },
      },
    },
  });
  const cv = user?.profile?.defaultCv;
  if (!user || !cv) return null;

  const snapshot = buildCvSnapshot({
    cv,
    account: { id: user.id, name: user.name, email: user.email, phone: user.phone, slug: user.slug },
    source: 'backfill',
  });

  await prisma.application.updateMany({
    where: { id: application.id, cvSnapshot: { equals: Prisma.DbNull } },
    data: {
      cvSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      cvSnapshotVersion: CV_SNAPSHOT_VERSION,
      ...(application.sourceCvId ? {} : { sourceCvId: cv.id }),
    },
  });

  const saved = await prisma.application.findUnique({
    where: { id: application.id },
    select: { cvSnapshot: true },
  });
  return parseCvSnapshot(saved?.cvSnapshot ?? null) ?? snapshot;
}

const APPLICATION_REVIEWER_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const;

/** Thành viên công ty có quyền xem đơn ứng tuyển của công ty. */
export async function canReviewCompanyApplications(userId: string, companyId: string): Promise<boolean> {
  const membership = await prisma.companyMember.findFirst({
    where: { userId, companyId, role: { in: [...APPLICATION_REVIEWER_ROLES] } },
    select: { id: true },
  });
  return Boolean(membership);
}

/**
 * Đơn mà người xem có quyền xem (thành viên công ty sở hữu job).
 * Không tồn tại hoặc không có quyền → cùng một lỗi 404.
 */
export async function findReviewableApplication(applicationId: string, userId: string) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      job: {
        select: {
          id: true,
          slug: true,
          title: true,
          companyId: true,
          company: { select: { id: true, name: true, slug: true, logoUrl: true } },
        },
      },
    },
  });
  if (!application || !(await canReviewCompanyApplications(userId, application.job.companyId))) {
    throw new AppError('Không tìm thấy đơn ứng tuyển', 404, 'APPLICATION_NOT_FOUND');
  }
  return application;
}

/** Ẩn các mục ứng viên đã tắt trong `visibility` của CV tại thời điểm ứng tuyển. */
export function applySnapshotVisibility(snapshot: CvSnapshotV1): CvSnapshotV1 {
  const visibility = snapshot.content.visibility ?? {};
  const shown = (key: string) => visibility[key] !== false;
  const content = { ...snapshot.content };

  if (!shown('bio')) content.bio = null;
  if (!shown('ksa')) {
    content.skills = [];
    content.knowledge = [];
    content.attitude = [];
  }
  if (!shown('expectations')) {
    content.expectedSalaryMin = null;
    content.expectedSalaryMax = null;
    content.workMode = null;
    content.expectedCulture = null;
    content.educationLevel = null;
  }
  if (!shown('expectations') && !shown('bio')) content.careerGoals = [];

  return {
    ...snapshot,
    content,
    experiences: shown('experience') ? snapshot.experiences : [],
    educations: shown('education') ? snapshot.educations : [],
  };
}

/** Field hiển thị gọn trong danh sách đơn. */
export function summarizeSnapshot(snapshot: CvSnapshotV1 | null) {
  if (!snapshot) return null;
  return {
    cvId: snapshot.cvId,
    cvName: snapshot.cvName,
    capturedAt: snapshot.capturedAt,
    source: snapshot.source,
    name: snapshot.content.fullName || snapshot.account.name,
    avatar: snapshot.content.avatar,
    title: snapshot.content.title,
    headline: snapshot.content.headline,
    cvUrl: snapshot.content.cvUrl,
  };
}

/** Toàn bộ đơn của các cặp (userId, jobId), sắp theo `appliedAt` tăng dần — 1 query. */
export async function loadApplicationHistory(
  pairs: Array<{ userId: string; jobId: string }>
): Promise<Map<string, ApplicationHistoryItem[]>> {
  const unique = new Map(pairs.map((pair) => [historyKey(pair.userId, pair.jobId), pair]));
  const history = new Map<string, ApplicationHistoryItem[]>();
  if (unique.size === 0) return history;

  const rows = await prisma.application.findMany({
    where: { OR: [...unique.values()].map((pair) => ({ userId: pair.userId, jobId: pair.jobId })) },
    orderBy: [{ appliedAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      userId: true,
      jobId: true,
      appliedAt: true,
      status: true,
      sourceCvId: true,
      cvSnapshot: true,
      sourceCv: { select: { name: true } },
    },
  });

  for (const row of rows) {
    const key = historyKey(row.userId, row.jobId);
    const list = history.get(key) ?? [];
    list.push({
      id: row.id,
      appliedAt: row.appliedAt,
      status: row.status,
      sourceCvId: row.sourceCvId,
      sourceCvName: parseCvSnapshot(row.cvSnapshot)?.cvName ?? row.sourceCv?.name ?? null,
    });
    history.set(key, list);
  }
  return history;
}

/** "Lần n" (1-based) và các đơn trước đơn hiện tại của cùng (userId, jobId). */
export function resolveReapplyInfo(
  history: Map<string, ApplicationHistoryItem[]>,
  application: { id: string; userId: string; jobId: string }
): { reapplyIndex: number; previousApplications: ApplicationHistoryItem[] } {
  const list = history.get(historyKey(application.userId, application.jobId)) ?? [];
  const index = list.findIndex((item) => item.id === application.id);
  if (index < 0) return { reapplyIndex: 1, previousApplications: [] };
  return { reapplyIndex: index + 1, previousApplications: list.slice(0, index) };
}
