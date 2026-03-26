-- Khi rollback DB (Navicat) nhưng enum UserAccountStatus vẫn còn → migrate deploy lỗi "type already exists".
-- Thêm cột nếu thiếu, rồi: npx prisma migrate resolve --applied 20260323120000_add_user_account_status
-- Chạy: npx prisma db execute --schema prisma/schema.prisma --file prisma/scripts/fix-user-account-status-after-partial-rollback.sql

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserAccountStatus') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'accountStatus'
    ) THEN
      ALTER TABLE "users" ADD COLUMN "accountStatus" "UserAccountStatus" NOT NULL DEFAULT 'ACTIVE';
    END IF;
  END IF;
END $$;
