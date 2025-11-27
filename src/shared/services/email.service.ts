import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { config } from '@/config/env';

// Use SES API (same as test script which works)
const hasValidAwsCredentials = 
  config.AWS_ACCESS_KEY_ID && 
  config.AWS_ACCESS_KEY_ID !== 'your_aws_access_key_id_here' &&
  config.AWS_SECRET_ACCESS_KEY &&
  config.AWS_SECRET_ACCESS_KEY !== 'your_aws_secret_access_key_here';

const sesClient = hasValidAwsCredentials
  ? new SESClient({
      region: config.AWS_REGION,
      credentials: {
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
      },
    })
  : null;

class EmailService {
  private getFromAddress(): string {
    const fromEmail = config.EMAIL_SENDER || config.EMAIL_FROM || 'noreply@joywork.vn';
    const fromName = config.FROM_NAME || 'JoyWork';
    return `${fromName} <${fromEmail}>`;
  }

  private async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    const fromEmail = config.EMAIL_SENDER || config.EMAIL_FROM;
    if (!fromEmail) {
      console.warn('Email service not configured. EMAIL_SENDER or EMAIL_FROM is missing. Skipping email send.');
      console.log('Email would be sent:', {
        to: options.to,
        subject: options.subject,
        from: this.getFromAddress(),
      });
      return;
    }

    if (!hasValidAwsCredentials) {
      console.warn('AWS credentials not configured. Skipping email send.');
      console.log('Please update AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env file.');
      console.log('Email would be sent:', {
        to: options.to,
        subject: options.subject,
        from: this.getFromAddress(),
      });
      return;
    }

    if (!sesClient) {
      console.error('SES client not initialized. Cannot send email.');
      return;
    }

    try {
      const fromAddress = this.getFromAddress();
      console.log('Sending email via AWS SES API:', {
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        region: config.AWS_REGION,
      });

      const command = new SendEmailCommand({
        Source: fromAddress,
        Destination: {
          ToAddresses: [options.to],
        },
        Message: {
          Subject: {
            Data: options.subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: options.html,
              Charset: 'UTF-8',
            },
            ...(options.text
              ? {
                  Text: {
                    Data: options.text,
                    Charset: 'UTF-8',
                  },
                }
              : {}),
          },
        },
      });

      const result = await sesClient.send(command);
      console.log('Email sent successfully via AWS SES API:', {
        messageId: result.MessageId,
        to: options.to,
      });
    } catch (error: any) {
      console.error('Failed to send email via AWS SES API:', {
        error: error.message,
        code: error.Code,
        statusCode: error.$metadata?.httpStatusCode,
        requestId: error.$metadata?.requestId,
        to: options.to,
        from: this.getFromAddress(),
        stack: error.stack,
      });
      throw new Error(`Không thể gửi email: ${error.message || 'Unknown error'}`);
    }
  }

  async sendVerificationEmail(
    to: string,
    name: string | null,
    verificationUrl: string,
  ): Promise<void> {
    const userName = name || 'bạn';
    const subject = 'Chào mừng bạn đến với JOYWork! Xác nhận email của bạn ngay';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Xác nhận email - JOYWork</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fff; padding: 30px; border-radius: 8px;">
    <h1 style="color: #ff6b00; margin-bottom: 20px;">Chào mừng đến với JOYWork!</h1>
    
    <p>Chào ${userName},</p>
    
    <p>Chúng tôi rất vui mừng chào đón bạn đến với JOYWork – nơi bạn có thể giúp Doanh nghiệp của mình xây dựng hồ sơ xuất sắc hoặc khám phá và kết nối với các nhà tuyển dụng phù hợp.</p>
    
    <p style="margin: 30px 0;">
      Hãy <strong><u><a href="${verificationUrl}" style="color: #ff6b00; text-decoration: underline;">Xác nhận Email</a></u></strong> của bạn để kích hoạt tài khoản.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${verificationUrl}" style="display: inline-block; background-color: #ff6b00; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Xác nhận Email</a>
    </div>
    
    <p>Sau khi xác nhận, bạn có thể bắt đầu sử dụng JOYWork ngay lập tức và trải nghiệm các tính năng cơ bản của chúng tôi.</p>
    
    <p>Để giúp bạn làm quen nhanh với nền tảng, chúng tôi đã chuẩn bị một <u><a href="https://momtech-docs.gitbook.io/joywork/" style="color: #ff6b00;">Tài liệu</a></u> <strong>Hướng dẫn sử dụng JOYWork</strong>.</p>
    
    <p>Chúng tôi rất mong bạn sẽ có những trải nghiệm tuyệt vời trên nền tảng!</p>
    
    <p style="margin-top: 30px;">
      Trân trọng,<br>
      <strong>Đội ngũ JOYWork</strong>
    </p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="font-size: 12px; color: #999; text-align: center;">
      Nếu bạn không tạo tài khoản này, vui lòng bỏ qua email này.
    </p>
  </div>
</body>
</html>
    `;

    const text = `
Chào mừng đến với JOYWork!

Chào ${userName},

Chúng tôi rất vui mừng chào đón bạn đến với JOYWork – nơi bạn có thể giúp Doanh nghiệp của mình xây dựng hồ sơ xuất sắc hoặc khám phá và kết nối với các nhà tuyển dụng phù hợp.

Hãy Xác nhận Email của bạn để kích hoạt tài khoản: ${verificationUrl}

Sau khi xác nhận, bạn có thể bắt đầu sử dụng JOYWork ngay lập tức và trải nghiệm các tính năng cơ bản của chúng tôi.

Để giúp bạn làm quen nhanh với nền tảng, chúng tôi đã chuẩn bị một Tài liệu Hướng dẫn sử dụng JOYWork.

Chúng tôi rất mong bạn sẽ có những trải nghiệm tuyệt vời trên nền tảng!

Trân trọng,
Đội ngũ JOYWork
    `;

    await this.sendEmail({
      to,
      subject,
      html,
      text,
    });
  }

  async sendPasswordResetEmail(
    to: string,
    name: string | null,
    resetUrl: string,
  ): Promise<void> {
    const userName = name || 'bạn';
    const subject = 'Đặt lại mật khẩu JOYWork';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Đặt lại mật khẩu - JOYWork</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fff; padding: 30px; border-radius: 8px;">
    <h1 style="color: #ff6b00; margin-bottom: 20px;">Đặt lại mật khẩu</h1>
    
    <p>Chào ${userName},</p>
    
    <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản JOYWork của bạn.</p>
    
    <p style="margin: 30px 0;">
      Nhấn vào nút bên dưới để đặt lại mật khẩu của bạn:
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="display: inline-block; background-color: #ff6b00; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Đặt lại mật khẩu</a>
    </div>
    
    <p>Hoặc sao chép và dán link sau vào trình duyệt:</p>
    <p style="word-break: break-all; color: #666; font-size: 12px;">${resetUrl}</p>
    
    <p style="margin-top: 30px; color: #999; font-size: 14px;">
      <strong>Lưu ý:</strong> Link này sẽ hết hạn sau 1 giờ. Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
    </p>
    
    <p style="margin-top: 30px;">
      Trân trọng,<br>
      <strong>Đội ngũ JOYWork</strong>
    </p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="font-size: 12px; color: #999; text-align: center;">
      Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này. Mật khẩu của bạn sẽ không thay đổi.
    </p>
  </div>
</body>
</html>
    `;

    const text = `
Đặt lại mật khẩu JOYWork

Chào ${userName},

Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản JOYWork của bạn.

Nhấn vào link sau để đặt lại mật khẩu: ${resetUrl}

Lưu ý: Link này sẽ hết hạn sau 1 giờ. Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.

Trân trọng,
Đội ngũ JOYWork
    `;

    await this.sendEmail({
      to,
      subject,
      html,
      text,
    });
  }

  async sendCompanyTicketOwnerEmail(
    to: string,
    payload: {
      ownerName?: string | null;
      applicantName?: string | null;
      applicantEmail: string;
      title: string;
      content: string;
      ticketUrl: string;
    },
  ): Promise<void> {
    const subject = `[JOYWork] Ticket mới từ ứng viên: ${payload.title}`;
    const ownerLabel = payload.ownerName ?? 'bạn';
    const applicantLabel = payload.applicantName ?? payload.applicantEmail;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family: Arial, sans-serif; color: #1f2933;">
  <p>Chào ${ownerLabel},</p>
  <p>Bạn vừa nhận được một ticket mới từ <strong>${applicantLabel}</strong>.</p>
  <p><strong>Tiêu đề:</strong> ${payload.title}</p>
  <p><strong>Nội dung:</strong></p>
  <blockquote style="border-left: 4px solid #ff6b00; margin: 16px 0; padding-left: 12px;">
    ${payload.content.replace(/\n/g, '<br />')}
  </blockquote>
  <p>Bấm vào đường dẫn sau để trả lời ticket:</p>
  <p><a href="${payload.ticketUrl}" style="color: #ff6b00;">${payload.ticketUrl}</a></p>
  <p>Trân trọng,<br/>Đội ngũ JOYWork</p>
</body>
</html>
`;

    const text = `
Chào ${ownerLabel},

Bạn vừa nhận được một ticket mới từ ${applicantLabel}.

Tiêu đề: ${payload.title}
Nội dung:
${payload.content}

Trả lời ticket tại: ${payload.ticketUrl}
`;

    await this.sendEmail({
      to,
      subject,
      html,
      text,
    });
  }

  async sendCompanyTicketApplicantEmail(
    to: string,
    payload: {
      companyName: string;
      title: string;
      content: string;
      ticketUrl: string;
    },
  ): Promise<void> {
    const subject = `[JOYWork] ${payload.companyName} đã phản hồi ticket của bạn`;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family: Arial, sans-serif; color: #1f2933;">
  <p>Chào bạn,</p>
  <p>Doanh nghiệp <strong>${payload.companyName}</strong> vừa phản hồi ticket <em>${payload.title}</em>.</p>
  <p><strong>Nội dung:</strong></p>
  <blockquote style="border-left: 4px solid #ff6b00; margin: 16px 0; padding-left: 12px;">
    ${payload.content.replace(/\n/g, '<br />')}
  </blockquote>
  <p>Bạn có thể xem và trả lời tại: <a href="${payload.ticketUrl}" style="color: #ff6b00;">${payload.ticketUrl}</a></p>
  <p>Trân trọng,<br/>Đội ngũ JOYWork</p>
</body>
</html>
`;

    const text = `
Chào bạn,

${payload.companyName} vừa phản hồi ticket "${payload.title}" của bạn.

Nội dung:
${payload.content}

Xem chi tiết tại: ${payload.ticketUrl}
`;

    await this.sendEmail({
      to,
      subject,
      html,
      text,
    });
  }

  async sendCompanyInvitationEmail(
    to: string,
    companyName: string,
    inviterName: string,
    role: string,
    acceptUrl: string
  ): Promise<void> {
    const subject = `Lời mời tham gia ${companyName} trên JOYWork`;
    
    const roleText = role === 'ADMIN' ? 'Quản trị viên' : 'Thành viên';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lời mời tham gia Doanh nghiệp - JOYWork</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fff; padding: 30px; border-radius: 8px; border: 1px solid #eee;">
    <h2 style="color: #ff6b00; margin-bottom: 20px;">Lời mời tham gia ${companyName}</h2>
    
    <p>Chào bạn,</p>
    
    <p><strong>${inviterName}</strong> đã mời bạn tham gia vào đội ngũ của <strong>${companyName}</strong> trên JOYWork với vai trò <strong>${roleText}</strong>.</p>
    
    <p>Nếu bạn chấp nhận lời mời này, hãy nhấn vào nút bên dưới để tham gia ngay:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${acceptUrl}" style="display: inline-block; background-color: #ff6b00; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Chấp nhận lời mời</a>
    </div>

    <p style="font-size: 14px; color: #666;">
        Nếu nút trên không hoạt động, bạn có thể sao chép đường dẫn này vào trình duyệt:<br/>
        <a href="${acceptUrl}" style="color: #ff6b00;">${acceptUrl}</a>
    </p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="font-size: 13px; color: #999;">
      <strong>Lưu ý:</strong><br/>
      - Nếu bạn chưa có tài khoản JOYWork với email <strong>${to}</strong>, bạn sẽ được yêu cầu đăng ký tài khoản mới.<br/>
      - Nếu bạn không muốn tham gia hoặc cho rằng đây là nhầm lẫn, vui lòng bỏ qua email này.
    </p>

    <p style="margin-top: 20px;">
      Trân trọng,<br>
      <strong>Đội ngũ JOYWork</strong>
    </p>
  </div>
</body>
</html>
    `;

    const text = `
Lời mời tham gia ${companyName} trên JOYWork

Chào bạn,

${inviterName} đã mời bạn tham gia vào đội ngũ của ${companyName} trên JOYWork với vai trò ${roleText}.

Để chấp nhận lời mời, vui lòng truy cập đường dẫn sau:
${acceptUrl}

Lưu ý:
- Nếu bạn chưa có tài khoản JOYWork với email ${to}, bạn sẽ được yêu cầu đăng ký tài khoản mới.
- Nếu bạn không muốn tham gia, vui lòng bỏ qua email này.

Trân trọng,
Đội ngũ JOYWork
    `;

    await this.sendEmail({
      to,
      subject,
      html,
      text,
    });
  }
}

export const emailService = new EmailService();

