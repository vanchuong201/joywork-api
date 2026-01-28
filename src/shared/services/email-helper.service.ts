import { prisma } from '@/shared/database/prisma';

/**
 * Get verified email address for a user
 * - If user's email is verified, return it
 * - If not verified, try to get email from linked Google account
 * - Returns null if no verified email is available
 */
export async function getVerifiedEmailForUser(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true },
  });

  if (!user) {
    return null;
  }

  // If user's email is verified, return it
  if (user.emailVerified) {
    return user.email;
  }

  // If not verified, try to get email from linked Google account
  const googleAccount = await prisma.userSocialAccount.findFirst({
    where: {
      userId,
      provider: 'google',
      email: { not: null },
    },
    select: { email: true },
  });

  // Return Google email if available, otherwise return null (don't send to unverified email)
  return googleAccount?.email ?? null;
}

/**
 * Get verified email addresses for multiple users
 */
export async function getVerifiedEmailsForUsers(userIds: string[]): Promise<Map<string, string | null>> {
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, emailVerified: true },
  });

  const verifiedEmails = new Map<string, string | null>();

  // First, add verified emails
  const unverifiedUserIds: string[] = [];
  for (const user of users) {
    if (user.emailVerified) {
      verifiedEmails.set(user.id, user.email);
    } else {
      unverifiedUserIds.push(user.id);
    }
  }

  // For unverified users, try to get email from Google accounts
  if (unverifiedUserIds.length > 0) {
    const googleAccounts = await prisma.userSocialAccount.findMany({
      where: {
        userId: { in: unverifiedUserIds },
        provider: 'google',
        email: { not: null },
      },
      select: { userId: true, email: true },
    });

    for (const account of googleAccounts) {
      if (!verifiedEmails.has(account.userId)) {
        verifiedEmails.set(account.userId, account.email);
      }
    }

    // Set null for users without verified email
    for (const userId of unverifiedUserIds) {
      if (!verifiedEmails.has(userId)) {
        verifiedEmails.set(userId, null);
      }
    }
  }

  // Set null for users not found
  for (const userId of userIds) {
    if (!verifiedEmails.has(userId)) {
      verifiedEmails.set(userId, null);
    }
  }

  return verifiedEmails;
}
