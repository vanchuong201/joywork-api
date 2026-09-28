import { Prisma } from '@prisma/client';
import { buildCvReadyUserWhere, cvReadyRawSqlCondition } from './cv-readiness';

/**
 * Ứng viên DN tìm thấy được: tài khoản ACTIVE + đang bật tìm việc + CV mặc định đủ điều kiện.
 * `isPublic` chỉ là bản sao của `isSearchingJob`, không dùng làm điều kiện riêng.
 */
export const buildDiscoverableUserWhere = (): Prisma.UserWhereInput => ({
  AND: [
    { accountStatus: 'ACTIVE' },
    { profile: { is: { isSearchingJob: true } } },
    buildCvReadyUserWhere(),
  ],
});

/** JOIN chuẩn cho raw SQL: `u` = users, `p` = user_profiles, `c` = CV mặc định. */
export const discoverableJoinSql = Prisma.sql`
  JOIN user_profiles p ON p."userId" = u.id
  JOIN candidate_cvs c ON c.id = p."defaultCvId"
`;

/** Bản raw SQL của `buildDiscoverableUserWhere` (dùng cùng `discoverableJoinSql`). */
export const discoverableRawSqlCondition = Prisma.sql`
  u."accountStatus" = 'ACTIVE'
  AND p."isSearchingJob" = true
  AND ${cvReadyRawSqlCondition}
`;
