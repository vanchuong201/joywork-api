import { SESClient, VerifyEmailIdentityCommand, GetIdentityVerificationAttributesCommand } from '@aws-sdk/client-ses';
import { config } from '../src/config/env';

async function verifyEmail() {
  const emailToVerify = process.argv[2];

  if (!emailToVerify || !emailToVerify.includes('@')) {
    console.error('❌ Please provide a valid email address');
    console.log('Usage: npm run verify:email -- your-email@example.com');
    process.exit(1);
  }

  console.log(`=== Verifying Email: ${emailToVerify} ===\n`);

  const sesClient = new SESClient({
    region: config.AWS_REGION,
    credentials: {
      accessKeyId: config.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    },
  });

  try {
    // Check if already verified
    console.log('Checking verification status...');
    const verificationAttrs = await sesClient.send(
      new GetIdentityVerificationAttributesCommand({
        Identities: [emailToVerify],
      })
    );

    const attrs = verificationAttrs.VerificationAttributes?.[emailToVerify];
    if (attrs?.VerificationStatus === 'Success') {
      console.log('✅ Email is already verified!');
      return;
    }

    // Request verification
    console.log('Requesting verification...');
    await sesClient.send(
      new VerifyEmailIdentityCommand({
        EmailAddress: emailToVerify,
      })
    );

    console.log('✅ Verification email sent!');
    console.log(`\nPlease check your inbox (${emailToVerify}) for a verification email from AWS SES.`);
    console.log('Click the verification link in the email to complete the process.');
    console.log('\nNote: This may take a few minutes to arrive.');

  } catch (error: any) {
    console.error('\n❌ Error verifying email:');
    console.error('Error:', error.message);
    console.error('Code:', error.Code || error.name);
    
    if (error.Code === 'AlreadyExists') {
      console.log('\n⚠️  Email verification is already pending. Check your inbox.');
    }
    
    process.exit(1);
  }
}

verifyEmail().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});

