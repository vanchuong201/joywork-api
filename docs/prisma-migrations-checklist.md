# 📋 Checklist: Quy trình làm việc với Prisma Schema & Migrations

> **Nguyên tắc vàng**: Mọi thay đổi database đều phải đi qua `schema.prisma` → `migrate dev` → commit migrations.  
> **Không bao giờ** sửa trực tiếp database bằng SQL hoặc dùng `db push` trên DB đã có migration history.

---

## 🎯 Tình huống 1: Thêm field mới vào model có sẵn

### Checklist:
- [ ] **Bước 1**: Mở `prisma/schema.prisma`, tìm model cần sửa
- [ ] **Bước 2**: Thêm field mới (ví dụ: `facebook String?`)
- [ ] **Bước 3**: Format và validate schema:
  ```bash
  cd joywork-api
  npx prisma format
  npx prisma validate
  ```
- [ ] **Bước 4**: Tạo migration với tên rõ ràng:
  ```bash
  npx prisma migrate dev --name add_facebook_to_company
  ```
- [ ] **Bước 5**: Kiểm tra migration SQL được sinh ra trong `prisma/migrations/xxxxx_add_facebook_to_company/migration.sql`
- [ ] **Bước 6**: Cập nhật backend code (service, routes, schema validation) nếu cần
- [ ] **Bước 7**: Cập nhật frontend types nếu cần
- [ ] **Bước 8**: Test API với field mới
- [ ] **Bước 9**: Commit cả `schema.prisma` và folder migration mới

### Ví dụ:
```prisma
// Trước
model Company {
  id        String  @id @default(cuid())
  name      String
  website   String?
}

// Sau
model Company {
  id        String  @id @default(cuid())
  name      String
  website   String?
  facebook  String?  // ← Field mới
}
```

---

## 🎯 Tình huống 2: Thêm model/bảng mới

### Checklist:
- [ ] **Bước 1**: Mở `prisma/schema.prisma`, thêm model mới
- [ ] **Bước 2**: Định nghĩa đầy đủ:
  - [ ] Primary key (`@id`)
  - [ ] Foreign keys và relations (nếu có)
  - [ ] Indexes (nếu cần)
  - [ ] `@@map("table_name")` để đặt tên bảng
- [ ] **Bước 3**: Format và validate:
  ```bash
  npx prisma format
  npx prisma validate
  ```
- [ ] **Bước 4**: Tạo migration:
  ```bash
  npx prisma migrate dev --name add_company_social_links
  ```
- [ ] **Bước 5**: Kiểm tra migration SQL (đảm bảo tạo đúng bảng, indexes, foreign keys)
- [ ] **Bước 6**: Tạo backend code:
  - [ ] Service layer (`src/modules/xxx/xxx.service.ts`)
  - [ ] Controller (`src/modules/xxx/xxx.controller.ts`)
  - [ ] Routes (`src/modules/xxx/xxx.routes.ts`)
  - [ ] Zod schemas (`src/modules/xxx/xxx.schema.ts`)
- [ ] **Bước 7**: Tạo frontend types (`joywork-web/src/types/xxx.ts`)
- [ ] **Bước 8**: Test CRUD operations
- [ ] **Bước 9**: Commit tất cả

### Ví dụ:
```prisma
model CompanySocialLink {
  id        String   @id @default(cuid())
  companyId String
  platform  String   // "facebook", "linkedin", etc.
  url       String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@unique([companyId, platform])
  @@index([companyId])
  @@map("company_social_links")
}
```

---

## 🎯 Tình huống 3: Sửa field (đổi type, đổi constraint)

### Checklist:
- [ ] **Bước 1**: Xem xét impact: field này đã có data chưa? Có breaking change không?
- [ ] **Bước 2**: Nếu có data, cần migration strategy:
  - [ ] Option A: Tạo field mới → migrate data → xóa field cũ (an toàn hơn)
  - [ ] Option B: Đổi trực tiếp nếu chắc chắn không mất data
- [ ] **Bước 3**: Sửa `schema.prisma`
- [ ] **Bước 4**: Format và validate
- [ ] **Bước 5**: Tạo migration:
  ```bash
  npx prisma migrate dev --name change_company_name_to_required
  ```
- [ ] **Bước 6**: Kiểm tra migration SQL (đặc biệt nếu có data transformation)
- [ ] **Bước 7**: Cập nhật backend validation (Zod schemas)
- [ ] **Bước 8**: Cập nhật frontend types và validation
- [ ] **Bước 9**: Test với data cũ và mới
- [ ] **Bước 10**: Commit

### Ví dụ: Đổi từ optional sang required
```prisma
// Trước
model Company {
  name String?  // Optional
}

// Sau
model Company {
  name String   // Required - CẢNH BÁO: Cần đảm bảo tất cả records đã có name
}
```

**Migration SQL sẽ cần:**
```sql
-- Đảm bảo không có NULL trước khi ALTER
UPDATE "companies" SET "name" = 'Unnamed' WHERE "name" IS NULL;
ALTER TABLE "companies" ALTER COLUMN "name" SET NOT NULL;
```

---

## 🎯 Tình huống 4: Thêm/sửa/xóa relation giữa 2 models

### Checklist:
- [ ] **Bước 1**: Xác định relation type:
  - [ ] One-to-One (`User` ↔ `UserProfile`)
  - [ ] One-to-Many (`Company` → `Post[]`)
  - [ ] Many-to-Many (`Post` ↔ `Hashtag` qua `PostHashtag`)
- [ ] **Bước 2**: Sửa cả 2 models trong `schema.prisma`:
  - [ ] Thêm foreign key field (ví dụ: `companyId String`)
  - [ ] Thêm relation decorator (ví dụ: `company Company @relation(...)`)
  - [ ] Thêm relation array ở model kia (ví dụ: `posts Post[]`)
- [ ] **Bước 3**: Format và validate
- [ ] **Bước 4**: Tạo migration:
  ```bash
  npx prisma migrate dev --name add_post_company_relation
  ```
- [ ] **Bước 5**: Kiểm tra migration SQL (foreign key constraint được tạo đúng)
- [ ] **Bước 6**: Cập nhật backend code để sử dụng relation
- [ ] **Bước 7**: Test queries với `include` hoặc `select`
- [ ] **Bước 8**: Commit

### Ví dụ: Thêm relation
```prisma
// Model Post
model Post {
  id        String  @id @default(cuid())
  companyId String  // ← Foreign key mới
  title     String

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
}

// Model Company
model Company {
  id    String @id @default(cuid())
  name  String
  posts Post[] // ← Relation array mới
}
```

---

## 🎯 Tình huống 5: Thêm/sửa index

### Checklist:
- [ ] **Bước 1**: Xác định cần index cho field nào (thường là foreign keys, fields dùng để search/filter)
- [ ] **Bước 2**: Thêm `@@index([fieldName])` hoặc `@@unique([field1, field2])` vào model
- [ ] **Bước 3**: Format và validate
- [ ] **Bước 4**: Tạo migration:
  ```bash
  npx prisma migrate dev --name add_index_to_company_slug
  ```
- [ ] **Bước 5**: Kiểm tra migration SQL (CREATE INDEX được tạo)
- [ ] **Bước 6**: Test query performance (nếu cần)
- [ ] **Bước 7**: Commit

### Ví dụ:
```prisma
model Company {
  id        String  @id @default(cuid())
  slug      String  @unique
  email     String?

  @@index([email])  // ← Index mới
}
```

---

## 🎯 Tình huống 6: Xóa field/model (DANGEROUS ⚠️)

### Checklist:
- [ ] **Bước 1**: ⚠️ **CẢNH BÁO**: Xóa field/model sẽ mất data vĩnh viễn!
- [ ] **Bước 2**: Backup database trước khi xóa (nếu có data quan trọng)
- [ ] **Bước 3**: Kiểm tra xem field/model có đang được dùng ở đâu:
  - [ ] Backend services
  - [ ] API routes
  - [ ] Frontend components
  - [ ] Tests
- [ ] **Bước 4**: Xóa/comment code liên quan trước
- [ ] **Bước 5**: Xóa field/model trong `schema.prisma`
- [ ] **Bước 6**: Format và validate
- [ ] **Bước 7**: Tạo migration:
  ```bash
  npx prisma migrate dev --name remove_old_field_from_company
  ```
- [ ] **Bước 8**: ⚠️ Kiểm tra migration SQL - đảm bảo chỉ xóa đúng field/bảng cần xóa
- [ ] **Bước 9**: Test toàn bộ app để đảm bảo không có lỗi
- [ ] **Bước 10**: Commit

### Ví dụ:
```prisma
// Trước
model Company {
  id        String  @id @default(cuid())
  oldField  String? // ← Sẽ xóa
}

// Sau
model Company {
  id        String  @id @default(cuid())
  // oldField đã bị xóa
}
```

---

## 🎯 Tình huống 7: Deploy migrations lên staging/production

### Checklist:
- [ ] **Bước 1**: ⚠️ **KHÔNG BAO GIỜ** dùng `prisma migrate dev` trên production!
- [ ] **Bước 2**: Đảm bảo code đã được pull, có đầy đủ:
  - [ ] `prisma/schema.prisma`
  - [ ] Tất cả folders trong `prisma/migrations/`
- [ ] **Bước 3**: Backup database production (nếu có thể)
- [ ] **Bước 4**: Chạy migration deploy:
  ```bash
  cd joywork-api
  npx prisma migrate deploy
  ```
- [ ] **Bước 5**: Kiểm tra logs - đảm bảo migrations chạy thành công
- [ ] **Bước 6**: Verify: Kiểm tra schema trong DB khớp với `schema.prisma`
- [ ] **Bước 7**: Test app hoạt động bình thường

### Lưu ý:
- `migrate deploy` chỉ áp dụng các migration chưa chạy, không thay đổi schema file
- Nếu có lỗi, rollback thủ công hoặc fix migration và chạy lại

---

## 🎯 Tình huống 8: Gặp "drift detected" (schema không khớp với DB)

### Checklist:
- [ ] **Bước 1**: Xác định nguyên nhân:
  - [ ] Có ai dùng `prisma db push` không?
  - [ ] Có ai chạy SQL trực tiếp không?
  - [ ] Migration history bị lệch?
- [ ] **Bước 2**: Nếu là **local dev** (DB không quan trọng):
  ```bash
  npx prisma migrate reset  # ⚠️ Xóa hết data!
  ```
- [ ] **Bước 3**: Nếu là **staging/prod** (có data quan trọng):
  - [ ] **KHÔNG reset!**
  - [ ] Dùng `prisma migrate diff` để tạo migration "bù":
    ```bash
    # Tạo schema tạm phản ánh trạng thái hiện tại của DB
    npx prisma db pull --schema prisma/schema_current.prisma
    
    # Tạo migration từ schema hiện tại → schema mong muốn
    npx prisma migrate diff \
      --from-schema-datamodel prisma/schema_current.prisma \
      --to-schema-datamodel prisma/schema.prisma \
      --script > prisma/migrations/xxxxx_fix_drift/migration.sql
    ```
  - [ ] Review migration SQL cẩn thận
  - [ ] Chạy migration
- [ ] **Bước 4**: Từ sau: **Kỷ luật** - chỉ dùng `migrate dev`, không dùng `db push`

---

## 🎯 Tình huống 9: Rollback migration (undo)

### Checklist:
- [ ] **Bước 1**: ⚠️ **CẢNH BÁO**: Rollback có thể mất data!
- [ ] **Bước 2**: Xem migration history:
  ```bash
  npx prisma migrate status
  ```
- [ ] **Bước 3**: Option A - Nếu chưa deploy lên production:
  - [ ] Xóa migration folder trong `prisma/migrations/`
  - [ ] Sửa lại `schema.prisma` về trạng thái cũ
  - [ ] Tạo migration mới nếu cần
- [ ] **Bước 4**: Option B - Nếu đã deploy:
  - [ ] **KHÔNG xóa migration cũ** (sẽ làm lệch history)
  - [ ] Tạo **migration mới** để "undo" thay đổi:
    ```bash
    npx prisma migrate dev --name revert_add_field_x
    ```
  - [ ] Trong migration SQL, viết logic rollback (DROP COLUMN, DROP TABLE, etc.)
- [ ] **Bước 5**: Test kỹ trước khi commit

---

## ✅ Best Practices - Luôn nhớ

### ✅ Nên làm:
- [ ] **Luôn** format schema trước khi commit: `npx prisma format`
- [ ] **Luôn** validate schema: `npx prisma validate`
- [ ] **Luôn** đặt tên migration rõ ràng, mô tả đúng thay đổi
- [ ] **Luôn** review migration SQL trước khi commit
- [ ] **Luôn** test migration trên local trước khi deploy
- [ ] **Luôn** commit cả `schema.prisma` và folder migration cùng lúc
- [ ] **Luôn** backup DB trước khi chạy migration trên production

### ❌ Không nên làm:
- [ ] **Không** dùng `prisma db push` trên DB đã có migration history
- [ ] **Không** sửa/xóa migration cũ đã được deploy
- [ ] **Không** chạy SQL trực tiếp mà không tạo migration
- [ ] **Không** commit schema mà không commit migration
- [ ] **Không** dùng `migrate dev` trên production
- [ ] **Không** bỏ qua bước validate và format

---

## 🔍 Debugging & Troubleshooting

### Kiểm tra migration status:
```bash
npx prisma migrate status
```

### Xem migration history trong DB:
```sql
SELECT * FROM "_prisma_migrations" ORDER BY finished_at DESC;
```

### Reset migration history (chỉ local dev):
```bash
npx prisma migrate reset
```

### Generate Prisma Client sau khi sửa schema:
```bash
npx prisma generate
```

### Xem diff giữa schema và DB:
```bash
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma
```

---

## 📚 Tài liệu tham khảo

- [Prisma Migrate Guide](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Migration Workflows](https://www.prisma.io/docs/guides/migrate/production-troubleshooting)

---

**Cập nhật lần cuối**: 2025-12-19  
**Người tạo**: AI Assistant  
**Dự án**: JoyWork Platform

