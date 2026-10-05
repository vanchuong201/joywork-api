-- Mốc doanh nghiệp đã đổi trạng thái, và mốc đã gửi mail nhắc phản hồi.
ALTER TABLE "applications" ADD COLUMN "companyRespondedAt" TIMESTAMP(3);
ALTER TABLE "applications" ADD COLUMN "responseReminderSentAt" TIMESTAMP(3);

CREATE INDEX "applications_status_appliedAt_idx" ON "applications"("status", "appliedAt");
