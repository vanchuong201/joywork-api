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
    const fromName = config.FROM_NAME || 'JOYWORK';
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
    const subject = 'Chào mừng bạn đến với JOYWORK! Xác nhận email của bạn ngay';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Xác nhận email - JOYWORK</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fff; padding: 30px; border-radius: 8px;">
    <h1 style="color: #295892; margin-bottom: 20px;">Chào mừng đến với JOYWORK!</h1>
    
    <p>Chào ${userName},</p>
    
    <p>Chúng tôi rất vui mừng chào đón bạn đến với JOYWORK – nơi bạn có thể giúp Doanh nghiệp của mình xây dựng hồ sơ xuất sắc hoặc khám phá và kết nối với các nhà tuyển dụng phù hợp.</p>
    
    <p style="margin: 30px 0;">
      Hãy <strong><u><a href="${verificationUrl}" style="color: #295892; text-decoration: underline;">Xác nhận Email</a></u></strong> của bạn để kích hoạt tài khoản.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${verificationUrl}" style="display: inline-block; background-color: #295892; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Xác nhận Email</a>
    </div>
    
    <p>Sau khi xác nhận, bạn có thể bắt đầu sử dụng JOYWORK ngay lập tức và trải nghiệm các tính năng cơ bản của chúng tôi.</p>
    
    <p>Để giúp bạn làm quen nhanh với nền tảng, chúng tôi đã chuẩn bị một <u><a href="https://momtech-docs.gitbook.io/joywork/" style="color: #295892;">Tài liệu</a></u> <strong>Hướng dẫn sử dụng JOYWORK</strong>.</p>
    
    <p>Chúng tôi rất mong bạn sẽ có những trải nghiệm tuyệt vời trên nền tảng!</p>
    
    <p style="margin-top: 30px;">
      Trân trọng,<br>
      <strong>Đội ngũ JOYWORK</strong>
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
Chào mừng đến với JOYWORK!

Chào ${userName},

Chúng tôi rất vui mừng chào đón bạn đến với JOYWORK – nơi bạn có thể giúp Doanh nghiệp của mình xây dựng hồ sơ xuất sắc hoặc khám phá và kết nối với các nhà tuyển dụng phù hợp.

Hãy Xác nhận Email của bạn để kích hoạt tài khoản: ${verificationUrl}

Sau khi xác nhận, bạn có thể bắt đầu sử dụng JOYWORK ngay lập tức và trải nghiệm các tính năng cơ bản của chúng tôi.

Để giúp bạn làm quen nhanh với nền tảng, chúng tôi đã chuẩn bị một Tài liệu Hướng dẫn sử dụng JOYWORK.

Chúng tôi rất mong bạn sẽ có những trải nghiệm tuyệt vời trên nền tảng!

Trân trọng,
Đội ngũ JOYWORK
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
    const subject = 'Đặt lại mật khẩu JOYWORK';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Đặt lại mật khẩu - JOYWORK</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fff; padding: 30px; border-radius: 8px;">
    <h1 style="color: #295892; margin-bottom: 20px;">Đặt lại mật khẩu</h1>
    
    <p>Chào ${userName},</p>
    
    <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản JOYWORK của bạn.</p>
    
    <p style="margin: 30px 0;">
      Nhấn vào nút bên dưới để đặt lại mật khẩu của bạn:
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="display: inline-block; background-color: #295892; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Đặt lại mật khẩu</a>
    </div>
    
    <p>Hoặc sao chép và dán link sau vào trình duyệt:</p>
    <p style="word-break: break-all; color: #666; font-size: 12px;">${resetUrl}</p>
    
    <p style="margin-top: 30px; color: #999; font-size: 14px;">
      <strong>Lưu ý:</strong> Link này sẽ hết hạn sau 1 giờ. Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
    </p>
    
    <p style="margin-top: 30px;">
      Trân trọng,<br>
      <strong>Đội ngũ JOYWORK</strong>
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
Đặt lại mật khẩu JOYWORK

Chào ${userName},

Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản JOYWORK của bạn.

Nhấn vào link sau để đặt lại mật khẩu: ${resetUrl}

Lưu ý: Link này sẽ hết hạn sau 1 giờ. Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.

Trân trọng,
Đội ngũ JOYWORK
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
    const subject = `[JOYWORK] Ticket mới từ ứng viên: ${payload.title}`;
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
  <blockquote style="border-left: 4px solid #295892; margin: 16px 0; padding-left: 12px;">
    ${payload.content.replace(/\n/g, '<br />')}
  </blockquote>
  <p>Bấm vào đường dẫn sau để trả lời ticket:</p>
  <p><a href="${payload.ticketUrl}" style="color: #295892;">${payload.ticketUrl}</a></p>
  <p>Trân trọng,<br/>Đội ngũ JOYWORK</p>
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
    const subject = `[JOYWORK] ${payload.companyName} đã phản hồi ticket của bạn`;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="font-family: Arial, sans-serif; color: #1f2933;">
  <p>Chào bạn,</p>
  <p>Doanh nghiệp <strong>${payload.companyName}</strong> vừa phản hồi ticket <em>${payload.title}</em>.</p>
  <p><strong>Nội dung:</strong></p>
  <blockquote style="border-left: 4px solid #295892; margin: 16px 0; padding-left: 12px;">
    ${payload.content.replace(/\n/g, '<br />')}
  </blockquote>
  <p>Bạn có thể xem và trả lời tại: <a href="${payload.ticketUrl}" style="color: #295892;">${payload.ticketUrl}</a></p>
  <p>Trân trọng,<br/>Đội ngũ JOYWORK</p>
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
    const subject = `Lời mời tham gia ${companyName} trên JOYWORK`;
    
    const roleText = role === 'ADMIN' ? 'Quản trị viên' : 'Thành viên';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lời mời tham gia Doanh nghiệp - JOYWORK</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fff; padding: 30px; border-radius: 8px; border: 1px solid #eee;">
    <h2 style="color: #295892; margin-bottom: 20px;">Lời mời tham gia ${companyName}</h2>
    
    <p>Chào bạn,</p>
    
    <p><strong>${inviterName}</strong> đã mời bạn tham gia vào đội ngũ của <strong>${companyName}</strong> trên JOYWORK với vai trò <strong>${roleText}</strong>.</p>
    
    <p>Nếu bạn chấp nhận lời mời này, hãy nhấn vào nút bên dưới để tham gia ngay:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${acceptUrl}" style="display: inline-block; background-color: #295892; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Chấp nhận lời mời</a>
    </div>

    <p style="font-size: 14px; color: #666;">
        Nếu nút trên không hoạt động, bạn có thể sao chép đường dẫn này vào trình duyệt:<br/>
        <a href="${acceptUrl}" style="color: #295892;">${acceptUrl}</a>
    </p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="font-size: 13px; color: #999;">
      <strong>Lưu ý:</strong><br/>
      - Nếu bạn chưa có tài khoản JOYWORK với email <strong>${to}</strong>, bạn sẽ được yêu cầu đăng ký tài khoản mới.<br/>
      - Nếu bạn không muốn tham gia hoặc cho rằng đây là nhầm lẫn, vui lòng bỏ qua email này.
    </p>

    <p style="margin-top: 20px;">
      Trân trọng,<br>
      <strong>Đội ngũ JOYWORK</strong>
    </p>
  </div>
</body>
</html>
    `;

    const text = `
Lời mời tham gia ${companyName} trên JOYWORK

Chào bạn,

${inviterName} đã mời bạn tham gia vào đội ngũ của ${companyName} trên JOYWORK với vai trò ${roleText}.

Để chấp nhận lời mời, vui lòng truy cập đường dẫn sau:
${acceptUrl}

Lưu ý:
- Nếu bạn chưa có tài khoản JOYWORK với email ${to}, bạn sẽ được yêu cầu đăng ký tài khoản mới.
- Nếu bạn không muốn tham gia, vui lòng bỏ qua email này.

Trân trọng,
Đội ngũ JOYWORK
    `;

    await this.sendEmail({
      to,
      subject,
      html,
      text,
    });
  }

  async sendCompanyStatementsVerificationEmail(
    to: string,
    payload: {
      companyName: string;
      contactName?: string | null;
      verifyUrl: string;
      statements: { title: string; description?: string; expiresAt?: Date | string | null }[];
    },
  ): Promise<void> {
    const displayName = payload.contactName || 'bạn';
    const subject = `[JOYWORK] Xác thực các cam kết từ ${payload.companyName}`;

    const statementsHtml = payload.statements
      .map((s) => {
        const expires =
          s.expiresAt instanceof Date
            ? s.expiresAt.toLocaleString('vi-VN')
            : s.expiresAt || '';
        return `
          <li style="margin-bottom: 12px;">
            <div style="font-weight: 600; color: #111827;">${s.title}</div>
            ${
              s.description
                ? `<div style="color:#4b5563; font-size: 14px; margin-top: 4px;">${s.description}</div>`
                : ''
            }
            ${
              expires
                ? `<div style="color:#9ca3af; font-size: 12px; margin-top: 4px;">Thời hạn xác thực đến: ${expires}</div>`
                : ''
            }
          </li>
        `;
      })
      .join('');

    const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Xác thực cam kết doanh nghiệp - JOYWORK</title>
  </head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827; max-width: 600px; margin: 0 auto; padding: 20px; background-color:#f9fafb;">
    <div style="background-color: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #e5e7eb;">
      <h2 style="color:#111827; margin-bottom: 16px;">Xác thực cam kết từ ${payload.companyName}</h2>
      <p>Chào ${displayName},</p>
      <p>
        Doanh nghiệp <strong>${payload.companyName}</strong> vừa cập nhật một số cam kết liên quan đến
        chính sách và môi trường làm việc. Chúng tôi mong muốn anh/chị xác thực tính chính xác của
        các thông tin sau:
      </p>
      <ul style="padding-left: 20px; margin: 16px 0;">
        ${statementsHtml}
      </ul>
      <p>Để xác thực, vui lòng bấm vào nút bên dưới và lựa chọn <strong>Đúng / Không đúng</strong> cho từng cam kết.</p>
      <div style="text-align:center; margin: 24px 0;">
        <a href="${payload.verifyUrl}" style="display:inline-block; padding: 10px 24px; background-color:#295892; color:#ffffff; border-radius:999px; text-decoration:none; font-weight:600;">
          Xác thực các cam kết
        </a>
      </div>
      <p style="font-size:13px; color:#6b7280;">
        Nếu nút trên không hoạt động, hãy sao chép đường dẫn sau và dán vào trình duyệt của bạn:<br/>
        <a href="${payload.verifyUrl}" style="color:#295892;">${payload.verifyUrl}</a>
      </p>
      <p style="font-size:12px; color:#9ca3af; margin-top:24px;">
        Lưu ý: Thời gian xác thực tối đa là 3 ngày kể từ khi nhận được email này. Sau thời gian trên, liên kết có thể hết hiệu lực.
      </p>
      <p style="margin-top:24px;">
        Trân trọng,<br/>
        <strong>Đội ngũ JOYWORK</strong>
      </p>
    </div>
  </body>
</html>
    `;

    const text = `
Xác thực cam kết từ ${payload.companyName}

Chào ${displayName},

Doanh nghiệp ${payload.companyName} vừa cập nhật một số cam kết liên quan đến chính sách và môi trường làm việc.
Vui lòng truy cập liên kết sau để xác thực các cam kết (Đúng / Không đúng):

${payload.verifyUrl}

Lưu ý: Thời gian xác thực tối đa là 3 ngày kể từ khi nhận được email này.

Trân trọng,
Đội ngũ JOYWORK
    `;

    await this.sendEmail({
      to,
      subject,
      html,
      text,
    });
  }

  async sendCompanyVerificationSubmittedEmail(
    to: string,
    payload: {
      companyName: string;
      ownerName?: string | null;
      manageUrl: string;
    },
  ): Promise<void> {
    const ownerLabel = payload.ownerName || 'bạn';
    const subject = `[JOYWORK] Đã nhận hồ sơ xác thực DKKD của ${payload.companyName}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Xác thực DKKD - JOYWORK</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fff; padding: 30px; border-radius: 8px; border: 1px solid #eee;">
    <h2 style="color: #295892; margin-bottom: 20px;">Đã nhận hồ sơ xác thực DKKD</h2>
    
    <p>Chào ${ownerLabel},</p>
    
    <p>Chúng tôi đã nhận được hồ sơ xác thực Giấy đăng ký kinh doanh (DKKD) của doanh nghiệp <strong>${payload.companyName}</strong>.</p>
    
    <p>Đội ngũ vận hành JOYWORK sẽ xem xét và phê duyệt hồ sơ của bạn trong thời gian sớm nhất. Kết quả xác thực sẽ được gửi về email này.</p>
    
    <p style="margin: 30px 0;">
      Bạn có thể theo dõi trạng thái xác thực tại trang quản lý doanh nghiệp:
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${payload.manageUrl}" style="display: inline-block; background-color: #295892; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Xem trạng thái xác thực</a>
    </div>

    <p style="font-size: 14px; color: #666;">
        Nếu nút trên không hoạt động, bạn có thể sao chép đường dẫn này vào trình duyệt:<br/>
        <a href="${payload.manageUrl}" style="color: #295892;">${payload.manageUrl}</a>
    </p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="font-size: 13px; color: #999;">
      <strong>Lưu ý:</strong><br/>
      - Thời gian xử lý thông thường là 1-3 ngày làm việc.<br/>
      - Nếu cần hỗ trợ, vui lòng liên hệ đội ngũ JOYWORK.
    </p>

    <p style="margin-top: 20px;">
      Trân trọng,<br>
      <strong>Đội ngũ JOYWORK</strong>
    </p>
  </div>
</body>
</html>
    `;

    const text = `
Đã nhận hồ sơ xác thực DKKD

Chào ${ownerLabel},

Chúng tôi đã nhận được hồ sơ xác thực Giấy đăng ký kinh doanh (DKKD) của doanh nghiệp ${payload.companyName}.

Đội ngũ vận hành JOYWORK sẽ xem xét và phê duyệt hồ sơ của bạn trong thời gian sớm nhất. Kết quả xác thực sẽ được gửi về email này.

Theo dõi trạng thái xác thực tại: ${payload.manageUrl}

Lưu ý: Thời gian xử lý thông thường là 1-3 ngày làm việc.

Trân trọng,
Đội ngũ JOYWORK
    `;

    await this.sendEmail({
      to,
      subject,
      html,
      text,
    });
  }

  async sendCompanyVerificationApprovedEmail(
    to: string,
    payload: {
      companyName: string;
      ownerName?: string | null;
      manageUrl: string;
    },
  ): Promise<void> {
    const ownerLabel = payload.ownerName || 'bạn';
    const subject = `[JOYWORK] Xác thực DKKD thành công - ${payload.companyName}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Xác thực thành công - JOYWORK</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fff; padding: 30px; border-radius: 8px; border: 1px solid #eee;">
    <h2 style="color: #10b981; margin-bottom: 20px;">✓ Xác thực DKKD thành công</h2>
    
    <p>Chào ${ownerLabel},</p>
    
    <p>Chúng tôi vui mừng thông báo rằng hồ sơ xác thực Giấy đăng ký kinh doanh (DKKD) của doanh nghiệp <strong>${payload.companyName}</strong> đã được phê duyệt thành công.</p>
    
    <p style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0;">
      <strong>Doanh nghiệp của bạn đã được xác thực!</strong><br/>
      Trạng thái xác thực này sẽ được hiển thị trên trang công khai của doanh nghiệp, giúp tăng độ tin cậy với ứng viên và đối tác.
    </p>
    
    <p style="margin: 30px 0;">
      Bạn có thể quản lý thông tin doanh nghiệp tại:
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${payload.manageUrl}" style="display: inline-block; background-color: #295892; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Quản lý doanh nghiệp</a>
    </div>

    <p style="font-size: 14px; color: #666;">
        Nếu nút trên không hoạt động, bạn có thể sao chép đường dẫn này vào trình duyệt:<br/>
        <a href="${payload.manageUrl}" style="color: #295892;">${payload.manageUrl}</a>
    </p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="font-size: 13px; color: #999;">
      <strong>Lưu ý:</strong><br/>
      - Nếu bạn thay đổi tên pháp lý đầy đủ của doanh nghiệp, bạn sẽ cần xác thực lại.<br/>
      - Mọi thay đổi về thông tin xác thực sẽ được thông báo qua email này.
    </p>

    <p style="margin-top: 20px;">
      Trân trọng,<br>
      <strong>Đội ngũ JOYWORK</strong>
    </p>
  </div>
</body>
</html>
    `;

    const text = `
Xác thực DKKD thành công

Chào ${ownerLabel},

Chúng tôi vui mừng thông báo rằng hồ sơ xác thực Giấy đăng ký kinh doanh (DKKD) của doanh nghiệp ${payload.companyName} đã được phê duyệt thành công.

Doanh nghiệp của bạn đã được xác thực! Trạng thái xác thực này sẽ được hiển thị trên trang công khai của doanh nghiệp.

Quản lý doanh nghiệp tại: ${payload.manageUrl}

Lưu ý: Nếu bạn thay đổi tên pháp lý đầy đủ của doanh nghiệp, bạn sẽ cần xác thực lại.

Trân trọng,
Đội ngũ JOYWORK
    `;

    await this.sendEmail({
      to,
      subject,
      html,
      text,
    });
  }

  async sendCompanyVerificationRejectedEmail(
    to: string,
    payload: {
      companyName: string;
      ownerName?: string | null;
      rejectReason?: string | null;
      manageUrl: string;
    },
  ): Promise<void> {
    const ownerLabel = payload.ownerName || 'bạn';
    const subject = `[JOYWORK] Yêu cầu bổ sung hồ sơ xác thực DKKD - ${payload.companyName}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Yêu cầu bổ sung hồ sơ - JOYWORK</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fff; padding: 30px; border-radius: 8px; border: 1px solid #eee;">
    <h2 style="color: #ef4444; margin-bottom: 20px;">Yêu cầu bổ sung hồ sơ xác thực</h2>
    
    <p>Chào ${ownerLabel},</p>
    
    <p>Chúng tôi đã xem xét hồ sơ xác thực Giấy đăng ký kinh doanh (DKKD) của doanh nghiệp <strong>${payload.companyName}</strong>.</p>
    
    <p style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0;">
      <strong>Hồ sơ cần được bổ sung hoặc chỉnh sửa.</strong>
    </p>
    
    ${payload.rejectReason ? `
    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0 0 8px 0; font-weight: 600; color: #111827;">Lý do:</p>
      <p style="margin: 0; color: #374151;">${payload.rejectReason}</p>
    </div>
    ` : `
    <p style="color: #6b7280;">Vui lòng kiểm tra lại hồ sơ và đảm bảo:</p>
    <ul style="color: #6b7280; padding-left: 20px;">
      <li>File DKKD rõ ràng, đầy đủ thông tin</li>
      <li>Tên pháp lý đầy đủ khớp với thông tin trên DKKD</li>
      <li>File không bị mờ, thiếu trang hoặc không đọc được</li>
    </ul>
    `}
    
    <p style="margin: 30px 0;">
      Bạn có thể tải lại hồ sơ xác thực tại trang quản lý doanh nghiệp:
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${payload.manageUrl}" style="display: inline-block; background-color: #295892; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Tải lại hồ sơ xác thực</a>
    </div>

    <p style="font-size: 14px; color: #666;">
        Nếu nút trên không hoạt động, bạn có thể sao chép đường dẫn này vào trình duyệt:<br/>
        <a href="${payload.manageUrl}" style="color: #295892;">${payload.manageUrl}</a>
    </p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="font-size: 13px; color: #999;">
      <strong>Lưu ý:</strong><br/>
      - Sau khi tải lại hồ sơ, đội ngũ vận hành sẽ xem xét lại trong 1-3 ngày làm việc.<br/>
      - Nếu cần hỗ trợ, vui lòng liên hệ đội ngũ JOYWORK.
    </p>

    <p style="margin-top: 20px;">
      Trân trọng,<br>
      <strong>Đội ngũ JOYWORK</strong>
    </p>
  </div>
</body>
</html>
    `;

    const text = `
Yêu cầu bổ sung hồ sơ xác thực DKKD

Chào ${ownerLabel},

Chúng tôi đã xem xét hồ sơ xác thực Giấy đăng ký kinh doanh (DKKD) của doanh nghiệp ${payload.companyName}.

Hồ sơ cần được bổ sung hoặc chỉnh sửa.

${payload.rejectReason ? `Lý do: ${payload.rejectReason}` : 'Vui lòng kiểm tra lại hồ sơ và đảm bảo file DKKD rõ ràng, đầy đủ thông tin và tên pháp lý đầy đủ khớp với thông tin trên DKKD.'}

Tải lại hồ sơ xác thực tại: ${payload.manageUrl}

Lưu ý: Sau khi tải lại hồ sơ, đội ngũ vận hành sẽ xem xét lại trong 1-3 ngày làm việc.

Trân trọng,
Đội ngũ JOYWORK
    `;

    await this.sendEmail({
      to,
      subject,
      html,
      text,
    });
  }

  async sendCompanyReVerificationRequestedEmail(
    to: string,
    payload: {
      companyName: string;
      ownerName?: string | null;
      newLegalName: string;
      manageUrl: string;
    },
  ): Promise<void> {
    const ownerLabel = payload.ownerName || 'bạn';
    const subject = `[JOYWORK] Yêu cầu xác thực lại DKKD - ${payload.companyName}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Yêu cầu xác thực lại - JOYWORK</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fff; padding: 30px; border-radius: 8px; border: 1px solid #eee;">
    <h2 style="color: #f59e0b; margin-bottom: 20px;">Yêu cầu xác thực lại DKKD</h2>
    
    <p>Chào ${ownerLabel},</p>
    
    <p>Chúng tôi nhận thấy bạn đã thay đổi <strong>Tên pháp lý đầy đủ</strong> của doanh nghiệp <strong>${payload.companyName}</strong>.</p>
    
    <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0; font-weight: 600;">Tên pháp lý mới:</p>
      <p style="margin: 0; color: #92400e;">${payload.newLegalName}</p>
    </div>
    
    <p>Vì tên pháp lý đã thay đổi, doanh nghiệp của bạn cần xác thực lại bằng cách tải lên hồ sơ DKKD mới phù hợp với tên pháp lý hiện tại.</p>
    
    <p style="margin: 30px 0;">
      Vui lòng tải lên hồ sơ DKKD mới tại trang quản lý doanh nghiệp:
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${payload.manageUrl}" style="display: inline-block; background-color: #295892; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Tải hồ sơ DKKD mới</a>
    </div>

    <p style="font-size: 14px; color: #666;">
        Nếu nút trên không hoạt động, bạn có thể sao chép đường dẫn này vào trình duyệt:<br/>
        <a href="${payload.manageUrl}" style="color: #295892;">${payload.manageUrl}</a>
    </p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="font-size: 13px; color: #999;">
      <strong>Lưu ý:</strong><br/>
      - Trạng thái xác thực hiện tại đã được đặt về "Chờ xác thực".<br/>
      - Đội ngũ vận hành sẽ xem xét hồ sơ mới trong 1-3 ngày làm việc sau khi bạn tải lên.<br/>
      - Kết quả xác thực sẽ được gửi về email này.
    </p>

    <p style="margin-top: 20px;">
      Trân trọng,<br>
      <strong>Đội ngũ JOYWORK</strong>
    </p>
  </div>
</body>
</html>
    `;

    const text = `
Yêu cầu xác thực lại DKKD

Chào ${ownerLabel},

Chúng tôi nhận thấy bạn đã thay đổi Tên pháp lý đầy đủ của doanh nghiệp ${payload.companyName}.

Tên pháp lý mới: ${payload.newLegalName}

Vì tên pháp lý đã thay đổi, doanh nghiệp của bạn cần xác thực lại bằng cách tải lên hồ sơ DKKD mới phù hợp với tên pháp lý hiện tại.

Tải hồ sơ DKKD mới tại: ${payload.manageUrl}

Lưu ý:
- Trạng thái xác thực hiện tại đã được đặt về "Chờ xác thực".
- Đội ngũ vận hành sẽ xem xét hồ sơ mới trong 1-3 ngày làm việc sau khi bạn tải lên.
- Kết quả xác thực sẽ được gửi về email này.

Trân trọng,
Đội ngũ JOYWORK
    `;

    await this.sendEmail({
      to,
      subject,
      html,
      text,
    });
  }

  async sendNewApplicationEmail(
    to: string,
    payload: {
      recipientName?: string | null;
      applicantName: string;
      jobTitle: string;
      companyName: string;
      appliedAt: string;
      applicationUrl: string;
    },
  ): Promise<void> {
    const recipientLabel = payload.recipientName || 'bạn';
    const subject = `[JOYWORK] Ứng viên mới ứng tuyển: ${payload.jobTitle}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ứng viên mới ứng tuyển - JOYWORK</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fff; padding: 30px; border-radius: 8px; border: 1px solid #eee;">
    <h2 style="color: #295892; margin-bottom: 20px;">Có ứng viên mới ứng tuyển</h2>
    <p>Chào ${recipientLabel},</p>
    <p>
      Ứng viên <strong>${payload.applicantName}</strong> vừa nộp hồ sơ cho vị trí
      <strong>${payload.jobTitle}</strong> tại <strong>${payload.companyName}</strong>.
    </p>
    <p><strong>Thời gian ứng tuyển:</strong> ${payload.appliedAt}</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${payload.applicationUrl}" style="display: inline-block; background-color: #295892; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Xem hồ sơ ứng viên</a>
    </div>

    <p style="font-size: 14px; color: #666;">
      Nếu nút trên không hoạt động, bạn có thể sao chép đường dẫn này vào trình duyệt:<br/>
      <a href="${payload.applicationUrl}" style="color: #295892;">${payload.applicationUrl}</a>
    </p>

    <p style="margin-top: 20px;">
      Trân trọng,<br>
      <strong>Đội ngũ JOYWORK</strong>
    </p>
  </div>
</body>
</html>
    `;

    const text = `
Chào ${recipientLabel},

Ứng viên ${payload.applicantName} vừa nộp hồ sơ cho vị trí ${payload.jobTitle} tại ${payload.companyName}.
Thời gian ứng tuyển: ${payload.appliedAt}

Xem hồ sơ ứng viên tại: ${payload.applicationUrl}

Trân trọng,
Đội ngũ JOYWORK
    `;

    await this.sendEmail({
      to,
      subject,
      html,
      text,
    });
  }

  async sendApplicationStatusUpdateEmail(
    to: string,
    payload: {
      applicantName?: string | null;
      jobTitle: string;
      companyName: string;
      newStatus: string;
      applicationUrl: string;
    },
  ): Promise<void> {
    const recipientLabel = payload.applicantName || 'bạn';
    const subject = `[JOYWORK] Cập nhật trạng thái ứng tuyển: ${payload.jobTitle}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cập nhật trạng thái ứng tuyển - JOYWORK</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fff; padding: 30px; border-radius: 8px; border: 1px solid #eee;">
    <h2 style="color: #295892; margin-bottom: 20px;">Trạng thái ứng tuyển của bạn đã được cập nhật</h2>
    <p>Chào ${recipientLabel},</p>
    <p>
      Doanh nghiệp <strong>${payload.companyName}</strong> vừa cập nhật trạng thái ứng tuyển của bạn
      cho vị trí <strong>${payload.jobTitle}</strong>.
    </p>
    <p><strong>Trạng thái mới:</strong> ${payload.newStatus}</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${payload.applicationUrl}" style="display: inline-block; background-color: #295892; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Xem chi tiết ứng tuyển</a>
    </div>

    <p style="font-size: 14px; color: #666;">
      Nếu nút trên không hoạt động, bạn có thể sao chép đường dẫn này vào trình duyệt:<br/>
      <a href="${payload.applicationUrl}" style="color: #295892;">${payload.applicationUrl}</a>
    </p>

    <p style="margin-top: 20px;">
      Trân trọng,<br>
      <strong>Đội ngũ JOYWORK</strong>
    </p>
  </div>
</body>
</html>
    `;

    const text = `
Chào ${recipientLabel},

Doanh nghiệp ${payload.companyName} vừa cập nhật trạng thái ứng tuyển của bạn cho vị trí ${payload.jobTitle}.
Trạng thái mới: ${payload.newStatus}

Xem chi tiết tại: ${payload.applicationUrl}

Trân trọng,
Đội ngũ JOYWORK
    `;

    await this.sendEmail({
      to,
      subject,
      html,
      text,
    });
  }

  async sendJobExpiringReminderEmail(
    to: string,
    payload: {
      recipientName?: string | null;
      jobTitle: string;
      companyName: string;
      manageUrl: string;
      daysLeft: number;
    },
  ): Promise<void> {
    const recipientLabel = payload.recipientName || 'bạn';
    const subject = `[JOYWORK] Nhắc nhở cập nhật tin tuyển dụng: ${payload.jobTitle}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nhắc nhở cập nhật tin tuyển dụng - JOYWORK</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fff; padding: 30px; border-radius: 8px; border: 1px solid #eee;">
    <h2 style="color: #295892; margin-bottom: 20px;">Tin tuyển dụng sắp tự động đóng</h2>
    <p>Chào ${recipientLabel},</p>
    <p>
      Tin tuyển dụng <strong>${payload.jobTitle}</strong> tại <strong>${payload.companyName}</strong>
      sẽ tự động đóng sau <strong>${payload.daysLeft} ngày</strong> nếu không có thao tác cập nhật.
    </p>
    <p>
      Bạn có thể vào trang quản lý để chỉnh sửa nội dung hoặc bấm nút <strong>"Làm mới"</strong>
      để giữ tin hiển thị.
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${payload.manageUrl}" style="display: inline-block; background-color: #295892; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Cập nhật tin tuyển dụng</a>
    </div>

    <p style="font-size: 14px; color: #666;">
      Nếu nút trên không hoạt động, bạn có thể sao chép đường dẫn này vào trình duyệt:<br/>
      <a href="${payload.manageUrl}" style="color: #295892;">${payload.manageUrl}</a>
    </p>

    <p style="margin-top: 20px;">
      Trân trọng,<br>
      <strong>Đội ngũ JOYWORK</strong>
    </p>
  </div>
</body>
</html>
    `;

    const text = `
Chào ${recipientLabel},

Tin tuyển dụng ${payload.jobTitle} tại ${payload.companyName} sẽ tự động đóng sau ${payload.daysLeft} ngày nếu không có thao tác cập nhật.

Bạn có thể chỉnh sửa nội dung hoặc bấm nút "Làm mới" tại trang quản lý:
${payload.manageUrl}

Trân trọng,
Đội ngũ JOYWORK
    `;

    await this.sendEmail({
      to,
      subject,
      html,
      text,
    });
  }

  async sendCompanyPostDeletedByJoyworkEmail(
    to: string,
    payload: {
      recipientName?: string | null;
      companyName: string;
      postTitle: string;
      reason: string;
      manageUrl: string;
    }
  ): Promise<void> {
    const recipientLabel = payload.recipientName || 'bạn';
    const subject = `[JOYWORK] Bài viết bị gỡ khỏi hiển thị: ${payload.postTitle}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bài viết bị gỡ hiển thị - JOYWORK</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fff; padding: 30px; border-radius: 8px; border: 1px solid #eee;">
    <h2 style="color: #b45309; margin-bottom: 20px;">Bài viết đã bị JOYWORK gỡ khỏi hiển thị</h2>
    <p>Chào ${recipientLabel},</p>
    <p>
      Bài viết <strong>${payload.postTitle}</strong> của doanh nghiệp <strong>${payload.companyName}</strong>
      đã bị đội ngũ JOYWORK ẩn khỏi các kênh hiển thị người dùng.
    </p>

    <div style="background-color: #fffbeb; border: 1px solid #fcd34d; padding: 14px; border-radius: 6px; margin: 18px 0;">
      <p style="margin: 0 0 6px 0; font-weight: 700;">Lý do:</p>
      <p style="margin: 0;">${payload.reason}</p>
    </div>

    <p>Bạn có thể vào trang quản lý hoạt động để rà soát nội dung và liên hệ JOYWORK nếu cần hỗ trợ thêm.</p>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${payload.manageUrl}" style="display: inline-block; background-color: #295892; color: #fff; padding: 12px 28px; text-decoration: none; border-radius: 5px; font-weight: bold;">Mở trang quản lý bài viết</a>
    </div>

    <p style="font-size: 14px; color: #666;">
      Nếu nút trên không hoạt động, bạn có thể sao chép đường dẫn sau vào trình duyệt:<br/>
      <a href="${payload.manageUrl}" style="color: #295892;">${payload.manageUrl}</a>
    </p>

    <p style="margin-top: 20px;">
      Trân trọng,<br>
      <strong>Đội ngũ JOYWORK</strong>
    </p>
  </div>
</body>
</html>
    `;

    const text = `
Chào ${recipientLabel},

Bài viết "${payload.postTitle}" của doanh nghiệp ${payload.companyName} đã bị đội ngũ JOYWORK ẩn khỏi các kênh hiển thị người dùng.

Lý do:
${payload.reason}

Bạn có thể kiểm tra tại trang quản lý hoạt động:
${payload.manageUrl}

Trân trọng,
Đội ngũ JOYWORK
    `;

    await this.sendEmail({
      to,
      subject,
      html,
      text,
    });
  }

  // ── Talent Pool emails (bilingual Vi–En) ──

  private talentPoolWrapper(title: string, bodyVi: string, bodyEn: string, ctaUrl?: string, ctaLabel?: string): string {
    const cta = ctaUrl ? `
      <div style="text-align: center; margin: 24px 0;">
        <a href="${ctaUrl}" style="display: inline-block; background-color: #295892; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">${ctaLabel || 'Xem chi tiết / View Details'}</a>
      </div>` : '';

    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fff; padding: 30px; border-radius: 8px;">
    <h2 style="color: #295892; margin-bottom: 20px;">${title}</h2>
    ${bodyVi}
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <div style="color: #666; font-size: 14px;">
      ${bodyEn}
    </div>
    ${cta}
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
    <p style="font-size: 12px; color: #999; text-align: center;">JOYWORK – Nền tảng tuyển dụng minh bạch</p>
  </div>
</body></html>`;
  }

  async sendTalentPoolApprovedEmail(
    to: string,
    payload: { name: string | null; profileUrl: string },
  ): Promise<void> {
    const name = payload.name || 'bạn';
    const html = this.talentPoolWrapper(
      'Thông báo kết quả xét duyệt Talent Pool',
      `<p>Chào ${name},</p>
      <p>JOYWORK thông báo: yêu cầu tham gia <strong>Talent Pool</strong> của bạn đã được <strong>phê duyệt</strong>.</p>
      <p>Hồ sơ của bạn hiện đã nằm trong danh sách ứng viên nổi bật được tuyển chọn và có thể được tiếp cận bởi các doanh nghiệp phù hợp trên nền tảng.</p>
      <p>Vui lòng tiếp tục cập nhật hồ sơ để gia tăng cơ hội nghề nghiệp.</p>`,
      `<p>Hi ${name},</p>
      <p>Your request to join the <strong>Talent Pool</strong> has been <strong>approved</strong>.</p>
      <p>Your profile is now part of JOYWORK's curated talent list and can be viewed by relevant employers on the platform.</p>
      <p>Please keep your profile up to date to maximize your opportunities.</p>`,
      payload.profileUrl,
      'Xem hồ sơ / View Profile',
    );

    await this.sendEmail({ to, subject: '[JOYWORK] Talent Pool - Yêu cầu tham gia đã được phê duyệt / Request Approved', html });
  }

  async sendTalentPoolRequestSubmittedEmail(
    to: string,
    payload: { name: string | null; profileUrl: string },
  ): Promise<void> {
    const name = payload.name || 'bạn';
    const html = this.talentPoolWrapper(
      'Xác nhận đã tiếp nhận yêu cầu tham gia Talent Pool',
      `<p>Chào ${name},</p>
      <p>JOYWORK đã <strong>tiếp nhận thành công</strong> yêu cầu tham gia <strong>Talent Pool</strong> của bạn.</p>
      <p>Yêu cầu đang ở trạng thái <strong>chờ xét duyệt</strong>. Kết quả xử lý sẽ được JOYWORK gửi lại qua email này ngay khi có cập nhật.</p>
      <p>Bạn có thể tiếp tục hoàn thiện hồ sơ để tăng khả năng được duyệt.</p>`,
      `<p>Hi ${name},</p>
      <p>JOYWORK has <strong>successfully received</strong> your request to join the <strong>Talent Pool</strong>.</p>
      <p>Your request is now <strong>under review</strong>. We will notify you at this email address once there is an update.</p>
      <p>You may continue improving your profile to increase your approval chances.</p>`,
      payload.profileUrl,
      'Xem hồ sơ / View Profile',
    );

    await this.sendEmail({ to, subject: '[JOYWORK] Talent Pool - Đã tiếp nhận yêu cầu tham gia / Request Received', html });
  }

  async sendTalentPoolRejectedEmail(
    to: string,
    payload: { name: string | null; reason: string; profileUrl: string },
  ): Promise<void> {
    const name = payload.name || 'bạn';
    const html = this.talentPoolWrapper(
      'Thông báo kết quả xét duyệt Talent Pool',
      `<p>Chào ${name},</p>
      <p>JOYWORK thông báo: yêu cầu tham gia <strong>Talent Pool</strong> của bạn hiện <strong>chưa được phê duyệt</strong>.</p>
      <p><strong>Lý do:</strong> ${payload.reason}</p>
      <p>Bạn có thể cập nhật hồ sơ và gửi lại yêu cầu bất kỳ lúc nào.</p>
      <p>JOYWORK sẽ tiếp tục thông báo kết quả các lần xét duyệt tiếp theo qua email.</p>`,
      `<p>Hi ${name},</p>
      <p>Your request to join the <strong>Talent Pool</strong> was not approved this time.</p>
      <p><strong>Reason:</strong> ${payload.reason}</p>
      <p>You can update your profile and resubmit at any time.</p>
      <p>JOYWORK will continue to send future review updates to your email.</p>`,
      payload.profileUrl,
      'Cập nhật hồ sơ / Update Profile',
    );

    await this.sendEmail({ to, subject: '[JOYWORK] Talent Pool - Kết quả yêu cầu tham gia / Request Result', html });
  }

  async sendTalentPoolRemovedEmail(
    to: string,
    payload: { name: string | null; reason: string; profileUrl: string },
  ): Promise<void> {
    const name = payload.name || 'bạn';
    const html = this.talentPoolWrapper(
      'Cập nhật Talent Pool',
      `<p>Chào ${name},</p>
      <p>Hồ sơ của bạn đã được <strong>gỡ khỏi Talent Pool</strong>.</p>
      <p><strong>Lý do:</strong> ${payload.reason}</p>
      <p>Bạn có thể gửi yêu cầu tham gia lại sau khi cập nhật hồ sơ.</p>`,
      `<p>Hi ${name},</p>
      <p>Your profile has been <strong>removed from the Talent Pool</strong>.</p>
      <p><strong>Reason:</strong> ${payload.reason}</p>
      <p>You may resubmit a request after updating your profile.</p>`,
      payload.profileUrl,
      'Cập nhật hồ sơ / Update Profile',
    );

    await this.sendEmail({ to, subject: '[JOYWORK] Talent Pool – Cập nhật trạng thái / Status Update', html });
  }

  async sendTalentPoolAdminAddedEmail(
    to: string,
    payload: { name: string | null; profileUrl: string },
  ): Promise<void> {
    const name = payload.name || 'bạn';
    const html = this.talentPoolWrapper(
      'Bạn đã được thêm vào Talent Pool',
      `<p>Chào ${name},</p>
      <p>Đội ngũ JOYWORK đã chọn và thêm bạn vào <strong>Talent Pool</strong> - danh sách ứng viên nổi bật được tuyển chọn.</p>
      <p>Hồ sơ của bạn giờ đây sẽ được các doanh nghiệp hàng đầu tiếp cận. Hãy đảm bảo hồ sơ của bạn luôn cập nhật!</p>`,
      `<p>Hi ${name},</p>
      <p>The JOYWORK team has selected and added you to the <strong>Talent Pool</strong> - a curated list of standout candidates.</p>
      <p>Your profile will now be accessible to leading companies. Make sure your profile is up to date!</p>`,
      payload.profileUrl,
      'Xem hồ sơ / View Profile',
    );

    await this.sendEmail({ to, subject: '[JOYWORK] Talent Pool – Bạn đã được chọn / You\'ve Been Selected', html });
  }
}

export const emailService = new EmailService();

