import { SESClient, GetAccountSendingEnabledCommand, GetSendQuotaCommand, ListVerifiedEmailAddressesCommand } from '@aws-sdk/client-ses';
import { config } from '../src/config/env';

async function checkSESStatus() {
  console.log('=== Checking AWS SES Status ===\n');

  const sesClient = new SESClient({
    region: config.AWS_REGION,
    credentials: {
      accessKeyId: config.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    },
  });

  try {
    // Check account sending enabled
    console.log('1. Checking account sending status...');
    const sendingEnabled = await sesClient.send(new GetAccountSendingEnabledCommand({}));
    console.log('   Account Sending Enabled:', sendingEnabled.Enabled ? '✅ YES' : '❌ NO');
    console.log('');

    // Check send quota
    console.log('2. Checking send quota...');
    const quota = await sesClient.send(new GetSendQuotaCommand({}));
    console.log('   Max 24 Hour Send:', quota.Max24HourSend);
    console.log('   Max Send Rate:', quota.MaxSendRate, 'emails/second');
    console.log('   Sent Last 24 Hours:', quota.SentLast24Hours);
    console.log('');

    // Check verified email addresses
    console.log('3. Checking verified email addresses...');
    const verifiedEmails = await sesClient.send(new ListVerifiedEmailAddressesCommand({}));
    console.log('   Verified Email Addresses:', verifiedEmails.VerifiedEmailAddresses?.length || 0);
    if (verifiedEmails.VerifiedEmailAddresses && verifiedEmails.VerifiedEmailAddresses.length > 0) {
      verifiedEmails.VerifiedEmailAddresses.forEach((email, index) => {
        console.log(`   ${index + 1}. ${email}`);
      });
    } else {
      console.log('   ⚠️  No verified email addresses found.');
      console.log('   If SES is in sandbox mode, you can only send to verified addresses.');
    }
    console.log('');

    // Check if EMAIL_FROM is verified
    if (config.EMAIL_FROM) {
      const isFromVerified = verifiedEmails.VerifiedEmailAddresses?.includes(config.EMAIL_FROM);
      console.log(`4. EMAIL_FROM (${config.EMAIL_FROM}) verification status:`);
      console.log('   Verified:', isFromVerified ? '✅ YES' : '❌ NO');
      if (!isFromVerified) {
        console.log('   ⚠️  You need to verify this email address in AWS SES Console!');
      }
      console.log('');
    }

    // Summary
    console.log('=== Summary ===');
    if (!sendingEnabled.Enabled) {
      console.log('❌ Account sending is DISABLED. Please enable it in AWS SES Console.');
    } else if (verifiedEmails.VerifiedEmailAddresses && verifiedEmails.VerifiedEmailAddresses.length === 0) {
      console.log('⚠️  No verified email addresses. SES might be in sandbox mode.');
      console.log('   In sandbox mode, you can only send to verified email addresses.');
      console.log('   To move out of sandbox, request production access in AWS SES Console.');
    } else {
      console.log('✅ SES appears to be configured correctly.');
      console.log('   If emails are not received, check:');
      console.log('   - Spam/Junk folder');
      console.log('   - Email provider filters');
      console.log('   - Recipient email is verified (if in sandbox mode)');
    }

  } catch (error: any) {
    console.error('\n❌ Error checking SES status:');
    console.error('Error:', error.message);
    console.error('Code:', error.Code || error.name);
    console.error('Status Code:', error.$metadata?.httpStatusCode);
    
    if (error.name === 'InvalidClientTokenId' || error.name === 'SignatureDoesNotMatch') {
      console.error('\n⚠️  AWS credentials are invalid!');
    }
    
    process.exit(1);
  }
}

checkSESStatus().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});

