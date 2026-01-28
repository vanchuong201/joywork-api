import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script to verify emails for users who have linked Google accounts
 * with the same email as their user email but haven't been verified yet
 */
async function verifyEmailsFromGoogle() {
  console.log('Starting email verification from Google accounts...');

  // Find all users with unverified emails who have linked Google accounts
  const users = await prisma.user.findMany({
    where: {
      emailVerified: false,
    },
    select: {
      id: true,
      email: true,
      emailVerified: true,
    },
  });

  console.log(`Found ${users.length} users with unverified emails`);

  let verifiedCount = 0;

  for (const user of users) {
    // Find Google account linked to this user
    const googleAccount = await prisma.userSocialAccount.findFirst({
      where: {
        userId: user.id,
        provider: 'google',
        email: { not: null },
      },
      select: {
        email: true,
      },
    });

    if (googleAccount?.email) {
      // Check if Google email matches user email (case-insensitive)
      if (googleAccount.email.toLowerCase() === user.email.toLowerCase()) {
        // Verify the email
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: true },
        });
        verifiedCount++;
        console.log(`✓ Verified email for user ${user.id} (${user.email})`);
      }
    }
  }

  console.log(`\nCompleted! Verified ${verifiedCount} emails.`);
}

verifyEmailsFromGoogle()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
