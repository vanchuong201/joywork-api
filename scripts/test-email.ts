import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { config } from '../src/config/env';

async function testEmail() {
  console.log('=== Testing AWS SES Email Service ===\n');

  // Check configuration
  console.log('Configuration:');
  console.log('- EMAIL_FROM:', config.EMAIL_FROM || 'NOT SET');
  console.log('- FROM_NAME:', config.FROM_NAME || 'NOT SET');
  console.log('- AWS_REGION:', config.AWS_REGION);
  console.log('- AWS_ACCESS_KEY_ID:', config.AWS_ACCESS_KEY_ID ? `${config.AWS_ACCESS_KEY_ID.substring(0, 10)}...` : 'NOT SET');
  console.log('- AWS_SECRET_ACCESS_KEY:', config.AWS_SECRET_ACCESS_KEY ? 'SET (hidden)' : 'NOT SET');
  console.log('');

  if (!config.EMAIL_FROM) {
    console.error('❌ EMAIL_FROM is not configured!');
    process.exit(1);
  }

  // Validate AWS credentials
  const hasValidAwsCredentials = 
    config.AWS_ACCESS_KEY_ID && 
    config.AWS_ACCESS_KEY_ID !== 'your_aws_access_key_id_here' &&
    config.AWS_SECRET_ACCESS_KEY &&
    config.AWS_SECRET_ACCESS_KEY !== 'your_aws_secret_access_key_here';

  if (!hasValidAwsCredentials) {
    console.error('❌ AWS credentials are not configured properly!');
    console.error('Please update AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env file.');
    process.exit(1);
  }

  // Get test email from command line argument
  // npm run test:email -- vanchuong201@gmail.com
  // process.argv sẽ là: ['node', 'script.ts', '--', 'vanchuong201@gmail.com']
  // hoặc: ['tsx', 'script.ts', 'vanchuong201@gmail.com']
  let testEmail = 'test@example.com';
  
  // Tìm email trong arguments (sau -- hoặc trực tiếp)
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (arg.includes('@') && arg.includes('.')) {
      testEmail = arg;
      break;
    }
  }
  
  console.log(`Sending test email to: ${testEmail}\n`);

  // Create SES client
  const sesClient = new SESClient({
    region: config.AWS_REGION,
    credentials: {
      accessKeyId: config.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    },
  });

  const fromAddress = `${config.FROM_NAME || 'JoyWork'} <${config.EMAIL_FROM}>`;

  // Test email content
  const testSubject = 'Test Email từ JOYWork';
  const testHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Test Email</title>
</head>
<body style="font-family: Arial, sans-serif; padding: 20px;">
  <h1 style="color: #ff6b00;">Đây là email test từ JOYWork</h1>
  <p>Nếu bạn nhận được email này, nghĩa là AWS SES đã được cấu hình đúng!</p>
  <p>Thời gian gửi: ${new Date().toLocaleString('vi-VN')}</p>
</body>
</html>
  `;

  const testText = `
Đây là email test từ JOYWork

Nếu bạn nhận được email này, nghĩa là AWS SES đã được cấu hình đúng!

Thời gian gửi: ${new Date().toLocaleString('vi-VN')}
  `;

  try {
    console.log('Sending email...');
    const command = new SendEmailCommand({
      Source: fromAddress,
      Destination: {
        ToAddresses: [testEmail],
      },
      Message: {
        Subject: {
          Data: testSubject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: testHtml,
            Charset: 'UTF-8',
          },
          Text: {
            Data: testText,
            Charset: 'UTF-8',
          },
        },
      },
    });

    const result = await sesClient.send(command);
    
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', result.MessageId);
    console.log('\nPlease check your inbox (and spam folder) for the test email.');
  } catch (error: any) {
    console.error('\n❌ Failed to send email:');
    console.error('Error:', error.message);
    console.error('Code:', error.Code || error.name);
    console.error('Status Code:', error.$metadata?.httpStatusCode);
    console.error('Request ID:', error.$metadata?.requestId);
    
    if (error.Code === 'MessageRejected') {
      console.error('\n⚠️  Possible reasons:');
      console.error('- Email address not verified in AWS SES (if in sandbox mode)');
      console.error('- Domain not verified in AWS SES');
      console.error('- SES account is in sandbox mode and recipient is not verified');
    }
    
    if (error.Code === 'InvalidParameterValue') {
      console.error('\n⚠️  Possible reasons:');
      console.error('- EMAIL_FROM address is not verified in AWS SES');
      console.error('- Invalid email format');
    }

    if (error.name === 'InvalidClientTokenId' || error.name === 'SignatureDoesNotMatch') {
      console.error('\n⚠️  AWS credentials are invalid!');
      console.error('Please check your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.');
    }

    console.error('\nFull error:', error);
    process.exit(1);
  }
}

testEmail().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});

