/**
 * Verify a few contacts have CV_ACTIVATE set in Brevo.
 * Usage: npx tsx scripts/verify-brevo-cv-activate.ts
 */
import { config as loadEnv } from 'dotenv';
loadEnv();

import { BrevoClient } from '@getbrevo/brevo';
import { prisma } from '../src/shared/database/prisma';
import { config } from '../src/config/env';
import { BREVO_USER_SELECT, brevoUserFromRow, mapUserToBrevoContact } from '../src/shared/services/brevo-contact.mapper';

async function main() {
  if (!config.BREVO_API_KEY) {
    console.error('BREVO_API_KEY missing');
    process.exit(1);
  }

  const users = await prisma.user.findMany({
    take: 400,
    orderBy: { id: 'asc' },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      profile: BREVO_USER_SELECT.profile,
      companies: BREVO_USER_SELECT.companies,
    },
  });

  const mapped = users
    .map((u) => mapUserToBrevoContact(brevoUserFromRow(u)))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const trueSample = mapped.find((c) => c.attributes.CV_ACTIVATE);
  const falseSample = mapped.find((c) => !c.attributes.CV_ACTIVATE);

  if (!trueSample || !falseSample) {
    console.error('Could not find true/false samples in first page');
    process.exit(1);
  }

  const client = new BrevoClient({
    apiKey: config.BREVO_API_KEY,
    maxRetries: 1,
    timeoutInSeconds: 30,
  });

  for (const sample of [trueSample, falseSample]) {
    const contact = await client.contacts.getContactInfo({
      identifier: sample.email,
    });
    const attrs = (contact.attributes || {}) as Record<string, unknown>;
    const actual = attrs.CV_ACTIVATE;
    const expected = sample.attributes.CV_ACTIVATE;
    const ok = actual === expected || actual === String(expected);
    console.log(
      JSON.stringify({
        email: sample.email,
        expected,
        actual,
        ok,
      }),
    );
    if (!ok) process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
