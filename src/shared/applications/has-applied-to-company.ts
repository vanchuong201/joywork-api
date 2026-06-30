import { prisma } from '@/shared/database/prisma';

/** UV đã có đơn ứng tuyển (mọi trạng thái) vào job thuộc công ty. */
export async function hasUserAppliedToCompany(params: {
  userId: string;
  companyId: string;
}): Promise<boolean> {
  const companyId = params.companyId.trim();
  if (!companyId) {
    return false;
  }

  const application = await prisma.application.findFirst({
    where: {
      userId: params.userId,
      job: { companyId },
    },
    select: { id: true },
  });

  return Boolean(application);
}
