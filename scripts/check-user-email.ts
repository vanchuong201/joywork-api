import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const userId = 'cmkxi5nb1000e6jbkvittliod';

async function checkUserEmail() {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      emailVerified: true,
    },
  });

  console.log('User info:', user);

  const googleAccounts = await prisma.userSocialAccount.findMany({
    where: {
      userId,
      provider: 'google',
    },
    select: {
      id: true,
      provider: true,
      providerId: true,
      email: true,
      createdAt: true,
    },
  });

  console.log('\nLinked Google accounts:', JSON.stringify(googleAccounts, null, 2));

  if (user && googleAccounts.length > 0) {
    const matchingAccount = googleAccounts.find(
      (acc) => acc.email && acc.email.toLowerCase() === user.email.toLowerCase()
    );

    if (matchingAccount && !user.emailVerified) {
      console.log('\n✓ Found matching Google account, verifying email...');
      await prisma.user.update({
        where: { id: userId },
        data: { emailVerified: true },
      });
      console.log('✓ Email verified!');
    } else if (matchingAccount && user.emailVerified) {
      console.log('\n✓ Email already verified');
    } else {
      console.log('\n✗ No matching Google account found or email mismatch');
      console.log(`  User email: ${user.email}`);
      console.log(`  Google emails: ${googleAccounts.map((a) => a.email).join(', ')}`);
    }
  }
}

checkUserEmail()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
