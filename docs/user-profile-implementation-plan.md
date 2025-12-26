# 📋 Kế hoạch Implementation: User Profile/CV

> **Ngày**: 2025-12-19  
> **Mục tiêu**: Tạo trang public profile/CV với đầy đủ tính năng như demo

---

## 1️⃣ Route Structure - Đề xuất

### **Đề xuất: `/profile/:slug`**

**Lý do**:
- ✅ **Ngắn gọn, semantic**: `/profile/nguyen-van-a` dễ hiểu hơn `/users/nguyen-van-a`
- ✅ **SEO-friendly**: "profile" là keyword phổ biến
- ✅ **Consistent**: Tương tự `/companies/:slug` đã có
- ✅ **Clean URL**: Slug dễ đọc, dễ share

**Implementation**:
```typescript
// Route: /profile/[slug]/page.tsx
// URL: /profile/nguyen-van-a
```

**Cần bổ sung**:
- Thêm field `slug` vào `User` model (unique, indexed)
- Auto-generate slug từ `name` khi tạo user hoặc update name
- Validation: lowercase, alphanumeric + hyphens, unique

---

## 2️⃣ Edit Flow - Đánh giá UX

### **Đề xuất: Redirect về `/account` với tab mở sẵn**

**Lý do**:
- ✅ **Tách biệt concerns**: View (public) vs Edit (private)
- ✅ **Consistent**: `/account` đã có form sẵn, không duplicate code
- ✅ **Better UX**: User quen với pattern "View → Click Edit → Go to Settings"
- ✅ **Maintainable**: Chỉ maintain 1 form, không phải sync 2 nơi

**Flow**:
```
/profile/:slug (View)
  ↓ Click "Chỉnh sửa hồ sơ"
/account?tab=profile (Edit)
  ↓ Save
Redirect back to /profile/:slug
```

**Alternative (nếu muốn inline edit)**:
- Có thể thêm "Edit mode" toggle trên `/profile` (chỉ owner thấy)
- Nhưng phức tạp hơn, cần state management nhiều hơn

**Recommendation**: **Redirect approach** (đơn giản, maintainable)

---

## 3️⃣ Data Storage - Tư vấn

### **Phân tích: Separate Tables vs JSON**

#### **Option A: Separate Tables (RECOMMENDED ✅)**

**Ưu điểm**:
- ✅ **Queryable**: Dễ search, filter, sort (VD: tìm user có experience tại "TechCorp")
- ✅ **Scalable**: Khi data lớn, query performance tốt hơn
- ✅ **Type-safe**: Prisma generate types tự động
- ✅ **Relations**: Dễ join, aggregate (VD: count experiences per user)
- ✅ **Indexing**: Có thể index các field quan trọng
- ✅ **Validation**: Field-level validation dễ hơn

**Nhược điểm**:
- ❌ Nhiều tables hơn (nhưng không phải vấn đề lớn)
- ❌ Cần migration khi thêm field mới

#### **Option B: JSON Fields**

**Ưu điểm**:
- ✅ Đơn giản, ít tables
- ✅ Flexible, dễ thêm field mới

**Nhược điểm**:
- ❌ **Không queryable**: Không thể search/filter trong JSON dễ dàng
- ❌ **Performance**: PostgreSQL JSON query chậm hơn
- ❌ **Type safety**: Phải tự validate structure
- ❌ **Khó maintain**: Khi structure thay đổi, migration phức tạp

### **Kết luận: Dùng Separate Tables**

**Lý do chính**: 
- Experience và Education cần **searchable** (VD: tìm user có experience với React)
- Cần **sort** theo period, company
- Cần **filter** theo skills, location
- **Matching engine** sẽ cần query KSA data

---

## 4️⃣ Database Schema Design

### **4.1. Update User Model**

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  password      String
  name          String?
  slug          String?  @unique  // ← NEW: For profile URL
  phone         String?
  emailVerified Boolean  @default(false)
  role          UserRole @default(USER)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relations
  profile       UserProfile?
  experiences   UserExperience[]
  educations    UserEducation[]
  // ... existing relations

  @@index([slug])  // For fast lookup
  @@map("users")
}
```

### **4.2. Update UserProfile Model**

```prisma
model UserProfile {
  id        String   @id @default(cuid())
  userId    String   @unique
  
  // Existing fields
  avatar    String?
  headline  String?
  bio       String?
  skills    String[]
  cvUrl     String?
  location  String?
  website   String?
  linkedin  String?
  github    String?
  
  // NEW: Profile-specific fields
  title     String?  // "Full-stack Developer (React/Node.js)"
  status    String?  // "Open to Work" | "Not Available" | "Looking" | etc.
  
  // Privacy settings
  isPublic  Boolean  @default(true)  // Public by default
  
  // Section visibility (JSON for flexibility)
  visibility Json?   // { bio: true, experience: true, education: true, ksa: true, expectations: true }
  
  // KSA (Knowledge, Skills, Attitude)
  knowledge  String[]  // Array of knowledge items
  attitude   String[]  // Array of attitude items
  // Note: skills already exists above
  
  // Expectations
  expectedSalary  String?  // "$2000 - $2500"
  workMode        String?  // "Hybrid hoặc Remote"
  expectedCulture String?  // "Môi trường cởi mở..."
  
  // Career Goals
  careerGoals     String[]  // Array of goals
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_profiles")
}
```

### **4.3. New: UserExperience Model**

```prisma
model UserExperience {
  id        String   @id @default(cuid())
  userId    String
  
  // Experience details
  role      String   // "Senior Frontend Developer"
  company   String   // "Innovate Tech"
  startDate DateTime?  // For sorting/querying
  endDate   DateTime?  // null = "Hiện tại"
  period    String?  // Display string: "2019 - Hiện tại" (for backward compat)
  desc      String?  // Description of role/responsibilities
  
  // Achievements/KPIs
  achievements String[]  // Array of achievement strings
  
  // Ordering
  order     Int      @default(0)  // For manual sorting
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([company])  // For search: "users who worked at X"
  @@map("user_experiences")
}
```

### **4.4. New: UserEducation Model**

```prisma
model UserEducation {
  id        String   @id @default(cuid())
  userId    String
  
  // Education details
  school    String   // "Đại học Khoa học Tự nhiên"
  degree    String   // "Cử nhân Công nghệ thông tin"
  startDate DateTime?
  endDate   DateTime?
  period    String?  // Display string: "2015 - 2019"
  
  // Optional
  gpa       String?  // "3.8/4.0"
  honors    String?  // "Summa Cum Laude"
  
  // Ordering
  order     Int      @default(0)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([school])  // For search: "users from X university"
  @@map("user_educations")
}
```

---

## 5️⃣ Migration Strategy

### **Step 1: Add slug to User**
```sql
ALTER TABLE "users" ADD COLUMN "slug" TEXT;
CREATE UNIQUE INDEX "users_slug_key" ON "users"("slug");
CREATE INDEX "users_slug_idx" ON "users"("slug");
```

### **Step 2: Update UserProfile**
```sql
ALTER TABLE "user_profiles" 
  ADD COLUMN "title" TEXT,
  ADD COLUMN "status" TEXT,
  ADD COLUMN "is_public" BOOLEAN DEFAULT true,
  ADD COLUMN "visibility" JSONB,
  ADD COLUMN "knowledge" TEXT[],
  ADD COLUMN "attitude" TEXT[],
  ADD COLUMN "expected_salary" TEXT,
  ADD COLUMN "work_mode" TEXT,
  ADD COLUMN "expected_culture" TEXT,
  ADD COLUMN "career_goals" TEXT[];
```

### **Step 3: Create UserExperience table**
```sql
CREATE TABLE "user_experiences" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "company" TEXT NOT NULL,
  "start_date" TIMESTAMP(3),
  "end_date" TIMESTAMP(3),
  "period" TEXT,
  "desc" TEXT,
  "achievements" TEXT[],
  "order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  
  CONSTRAINT "user_experiences_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_experiences_user_id_idx" ON "user_experiences"("user_id");
CREATE INDEX "user_experiences_company_idx" ON "user_experiences"("company");
```

### **Step 4: Create UserEducation table**
```sql
CREATE TABLE "user_educations" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "school" TEXT NOT NULL,
  "degree" TEXT NOT NULL,
  "start_date" TIMESTAMP(3),
  "end_date" TIMESTAMP(3),
  "period" TEXT,
  "gpa" TEXT,
  "honors" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  
  CONSTRAINT "user_educations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_educations_user_id_idx" ON "user_educations"("user_id");
CREATE INDEX "user_educations_school_idx" ON "user_educations"("school");
```

---

## 6️⃣ API Endpoints Design

### **Public Endpoints** (không cần auth)

```typescript
// Get public profile by slug
GET /api/users/profile/:slug
Response: {
  user: {
    id, name, slug, email? (if public), phone? (if public)
  },
  profile: {
    avatar, title, headline, bio, location,
    website, linkedin, github,
    status, knowledge, skills, attitude,
    expectedSalary, workMode, expectedCulture,
    careerGoals
  },
  experiences: [...],
  educations: [...],
  visibility: { ... }  // Which sections are visible
}
```

### **Private Endpoints** (cần auth)

```typescript
// Get own full profile (including private data)
GET /api/users/me/profile

// Update profile
PATCH /api/users/me/profile

// Manage experiences
GET    /api/users/me/experiences
POST   /api/users/me/experiences
PATCH  /api/users/me/experiences/:id
DELETE /api/users/me/experiences/:id

// Manage educations
GET    /api/users/me/educations
POST   /api/users/me/educations
PATCH  /api/users/me/educations/:id
DELETE /api/users/me/educations/:id

// Update privacy settings
PATCH /api/users/me/profile/privacy
Body: {
  isPublic: boolean,
  visibility: { bio: boolean, experience: boolean, ... }
}
```

---

## 7️⃣ Frontend Components Structure

```
src/app/(app)/
├── profile/
│   └── [slug]/
│       └── page.tsx              # Public profile page
│
src/components/profile/
├── UserProfileHeader.tsx         # Avatar, name, contact, status
├── UserProfileKSA.tsx            # Knowledge, Skills, Attitude card
├── UserProfileExpectations.tsx   # Expectations card
├── UserProfileEducation.tsx     # Education list
├── UserProfileBio.tsx            # Bio + Career Goals
├── UserProfileExperience.tsx     # Experience Timeline
└── UserProfilePage.tsx           # Main page (orchestrator)

src/app/(app)/account/
└── page.tsx                      # Update với tab "Profile" section
    # Include forms for:
    # - Basic info (title, status, bio)
    # - KSA (knowledge, skills, attitude)
    # - Expectations
    # - Career Goals
    # - Privacy settings
    # - Experience CRUD
    # - Education CRUD
```

---

## 8️⃣ Implementation Checklist

### **Phase 1: Database & Backend**
- [ ] Add `slug` field to User model
- [ ] Update UserProfile model (add new fields)
- [ ] Create UserExperience model
- [ ] Create UserEducation model
- [ ] Generate Prisma migration
- [ ] Update User service (slug generation, profile CRUD)
- [ ] Create Experience service (CRUD)
- [ ] Create Education service (CRUD)
- [ ] Create API routes (public + private)
- [ ] Add validation schemas (Zod)

### **Phase 2: Frontend - Public Profile**
- [ ] Create route `/profile/[slug]/page.tsx`
- [ ] Component UserProfileHeader
- [ ] Component UserProfileKSA
- [ ] Component UserProfileExpectations
- [ ] Component UserProfileEducation
- [ ] Component UserProfileBio
- [ ] Component UserProfileExperience (timeline)
- [ ] Main page UserProfilePage
- [ ] Handle privacy (hide sections if private)
- [ ] Share functionality

### **Phase 3: Frontend - Edit in Account**
- [ ] Update `/account` page với Profile tab
- [ ] Form: Basic info (title, status, bio)
- [ ] Form: KSA (knowledge, skills, attitude)
- [ ] Form: Expectations
- [ ] Form: Career Goals
- [ ] Form: Privacy settings
- [ ] CRUD: Experience (list, add, edit, delete)
- [ ] CRUD: Education (list, add, edit, delete)
- [ ] Redirect từ profile → account với tab mở

### **Phase 4: Polish**
- [ ] Slug generation on user creation/update
- [ ] Slug uniqueness validation
- [ ] Loading states
- [ ] Error handling (404, private profile)
- [ ] SEO metadata
- [ ] Responsive design
- [ ] Print-friendly CSS (optional)

---

## 9️⃣ Questions & Decisions

### **Đã quyết định**:
✅ Route: `/profile/:slug`  
✅ Edit flow: Redirect to `/account`  
✅ Data storage: Separate tables  
✅ Privacy: Default public, có settings  
✅ Section visibility: Có settings

### **Đã quyết định**:
✅ **Slug format**: `nguyen-van-a` (với hyphens)  
✅ **Slug uniqueness**: Nếu trùng thì thêm số (`nguyen-van-a-2`)  
✅ **Email/Phone visibility**: Luôn ẩn trên public profile. Có cơ chế cho phép xem khi apply job (member của company có thể xem)  
✅ **Status enum**: Enum cố định (`OPEN_TO_WORK`, `NOT_AVAILABLE`, `LOOKING`)  
✅ **Period field**: Giữ cả `startDate/endDate` + `period` string (dates để sort, period để display)  
✅ **Sticky Header**: Không cần (đã có header chung của site), chỉ làm content trong `max-w-5xl mx-auto px-4 mt-8`

---

**Tạo bởi**: AI Assistant  
**Ngày**: 2025-12-19  
**Status**: Ready for implementation

