import * as Sentry from '@sentry/node';

/**
 * Gửi email ở chế độ nền (fire-and-forget) — KHÔNG chặn request path.
 *
 * Các luồng nóng (đăng ký, ứng tuyển) trước đây `await` lệnh gửi email qua SES,
 * khiến latency/rate-limit của SES nằm thẳng trên đường phản hồi. Helper này tách
 * việc gửi ra khỏi request: trả về ngay, gửi nền với vài lần retry, và log lỗi
 * (console + Sentry) nếu thất bại vĩnh viễn.
 *
 * Lưu ý: đây là giải pháp tạm cho tới khi có job queue bền (BullMQ) — chấp nhận
 * khả năng mất email nếu process chết giữa chừng. Không dùng cho email bắt buộc
 * phải xác nhận gửi thành công đồng bộ (ví dụ resend do người dùng chủ động bấm).
 *
 * @param task   Hàm thực hiện gửi (gọi emailService.* trả về Promise).
 * @param context  Mô tả ngắn để log (ví dụ "verification email userId=...").
 * @param maxAttempts  Tổng số lần thử (mặc định 3).
 */
export function sendEmailInBackground(
  task: () => Promise<unknown>,
  context: string,
  maxAttempts = 3,
): void {
  void (async () => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await task();
        return;
      } catch (error) {
        const isLastAttempt = attempt === maxAttempts;
        if (isLastAttempt) {
          console.error(`[email] gửi thất bại sau ${maxAttempts} lần (${context}):`, error);
          Sentry.captureException(error, { tags: { area: 'email-async' }, extra: { context, maxAttempts } });
          return;
        }
        // Exponential backoff: 500ms, 1000ms, ...
        const delayMs = 500 * 2 ** (attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  })();
}
