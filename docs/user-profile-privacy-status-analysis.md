# Phân tích tính năng "Công khai hồ sơ" và "Chọn trạng thái"

## 📋 Tổng quan

Hai tính năng này cho phép người dùng kiểm soát quyền riêng tư và trạng thái của hồ sơ ứng tuyển trên JoyWork.

---

## 🔒 1. Công khai hồ sơ (isPublic)

### 1.1. Định nghĩa và Schema

**Database Schema:**
```prisma
model UserProfile {
  isPublic   Boolean     @default(true)  // Mặc định là công khai
  // ...
}
```

**TypeScript Types:**
```typescript
// Frontend
isPublic?: boolean;

// Backend
isPublic: z.boolean().optional();
```

### 1.2. Logic hoạt động

#### Backend Logic (`user-profile.service.ts`)

```typescript
// Kiểm tra khi lấy public profile
async getPublicProfileBySlug(slug: string): Promise<any | null> {
  const user = await prisma.user.findUnique({
    where: { slug },
    include: { profile: true, experiences: true, educations: true },
  });

  // ⚠️ QUAN TRỌNG: Nếu profile không public, trả về null (404)
  if (user.profile && !user.profile.isPublic) {
    return null; // Profile is private
  }
  
  // Chỉ trả về data nếu isPublic = true
  return result;
}
```

**Hành vi:**
- ✅ `isPublic = true`: Profile có thể truy cập công khai qua `/profile/[slug]`
- ❌ `isPublic = false`: Profile trả về `null` → Frontend hiển thị 404
- 🔄 Default: `true` (công khai mặc định)

#### Frontend Logic

**1. Edit Form (`ProfileBasicInfo.tsx`):**
```typescript
// Switch component để toggle
<Switch
  id="isPublic"
  checked={isPublic}
  onCheckedChange={(checked) => setValue("isPublic", checked, { shouldDirty: true })}
/>
<Label htmlFor="isPublic">Công khai hồ sơ</Label>
```

**2. Public Profile Page (`/profile/[slug]/page.tsx`):**
```typescript
// Nếu API trả về 404 → notFound()
try {
  const res = await api.get(`/api/users/profile/${slug}`);
  profile = res.data.data.profile;
} catch (error: any) {
  if (error.response?.status === 404) {
    notFound(); // Hiển thị trang 404
  }
}
```

### 1.3. Use Cases

| Trường hợp | isPublic | Kết quả |
|------------|----------|---------|
| User muốn profile công khai | `true` | ✅ Có thể truy cập `/profile/[slug]` |
| User muốn ẩn profile | `false` | ❌ Truy cập `/profile/[slug]` → 404 |
| User mới tạo profile | `true` (default) | ✅ Tự động công khai |

### 1.4. Vấn đề và Cải thiện

#### ✅ Điểm mạnh:
- Logic đơn giản, dễ hiểu
- Default là công khai (phù hợp với mục đích tìm việc)
- UI/UX rõ ràng với Switch component

#### ⚠️ Vấn đề tiềm ẩn:
1. **Không có thông báo khi ẩn profile:**
   - User có thể không biết profile đã bị ẩn
   - Nên thêm toast/warning khi toggle OFF

2. **Không có cơ chế "chỉ công ty đã apply":**
   - Hiện tại chỉ có 2 trạng thái: public hoặc private
   - Theo plan ban đầu: "Nếu ứng viên apply vào job thuộc công ty A, thì member của công ty A có thể xem được"
   - ⚠️ **CHƯA IMPLEMENT** tính năng này

3. **Email/Phone luôn ẩn trên public profile:**
   - Đúng theo thiết kế, nhưng có thể cần cơ chế cho phép hiển thị cho công ty đã apply

#### 💡 Đề xuất cải thiện:
```typescript
// Option 1: Thêm enum cho visibility level
enum ProfileVisibility {
  PUBLIC = 'PUBLIC',           // Công khai hoàn toàn
  PRIVATE = 'PRIVATE',          // Chỉ mình tôi
  COMPANIES_ONLY = 'COMPANIES_ONLY', // Chỉ công ty đã apply
}

// Option 2: Giữ isPublic, nhưng thêm logic check company access
async getPublicProfileBySlug(slug: string, companyId?: string): Promise<any | null> {
  if (!user.profile.isPublic) {
    // Nếu có companyId, check xem user đã apply vào job của company này chưa
    if (companyId) {
      const hasApplication = await checkUserApplication(user.id, companyId);
      if (!hasApplication) return null;
    } else {
      return null; // Không có companyId và không public → 404
    }
  }
  return result;
}
```

---

## 🏷️ 2. Chọn trạng thái (status)

### 2.1. Định nghĩa và Schema

**Database Schema:**
```prisma
enum UserStatus {
  OPEN_TO_WORK      // Đang tìm việc
  NOT_AVAILABLE     // Không có sẵn
  LOOKING           // Đang tìm kiếm
}

model UserProfile {
  status     UserStatus?  // Optional, nullable
  // ...
}
```

**TypeScript Types:**
```typescript
// Frontend
export type UserStatus = 'OPEN_TO_WORK' | 'NOT_AVAILABLE' | 'LOOKING';

status?: UserStatus | null;

// Backend
export const userStatusEnum = z.enum(['OPEN_TO_WORK', 'NOT_AVAILABLE', 'LOOKING']);
status: userStatusEnum.optional().nullable();
```

### 2.2. Logic hoạt động

#### Backend Logic

**Validation:**
- ✅ Chỉ chấp nhận 3 giá trị: `OPEN_TO_WORK`, `NOT_AVAILABLE`, `LOOKING`
- ✅ Optional: Có thể để trống (null)
- ✅ Nullable: Có thể xóa status

**Storage:**
```typescript
// Update profile
const profileData: any = {
  status: data.status ?? null, // Nếu undefined → null
  // ...
};
```

#### Frontend Logic

**1. Edit Form (`ProfileBasicInfo.tsx`):**
```typescript
// Select dropdown
<select
  id="status"
  value={watch("status") || ""}
  onChange={(e) => setValue("status", (e.target.value || null) as UserStatus | null)}
>
  <option value="">Chọn trạng thái</option>
  <option value="OPEN_TO_WORK">Đang tìm việc</option>
  <option value="LOOKING">Đang tìm kiếm</option>
  <option value="NOT_AVAILABLE">Không có sẵn</option>
</select>
```

**2. Public Profile Display (`UserProfileHeader.tsx`):**
```typescript
const statusLabels: Record<string, string> = {
  OPEN_TO_WORK: 'Open to Work',
  NOT_AVAILABLE: 'Not Available',
  LOOKING: 'Looking',
};

const status = profile.profile?.status;
const statusLabel = status ? statusLabels[status] || status : null;

// Hiển thị badge nếu có status
{statusLabel && (
  <span className="px-4 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-full">
    <CheckCircle size={14} /> {statusLabel}
  </span>
)}
```

### 2.3. Use Cases

| Trạng thái | Ý nghĩa | Hiển thị trên Profile |
|------------|---------|----------------------|
| `OPEN_TO_WORK` | Đang tìm việc | ✅ Badge "Open to Work" (màu xanh) |
| `LOOKING` | Đang tìm kiếm | ✅ Badge "Looking" (màu xanh) |
| `NOT_AVAILABLE` | Không có sẵn | ✅ Badge "Not Available" (màu xanh) |
| `null` | Chưa chọn | ❌ Không hiển thị badge |

### 2.4. Vấn đề và Cải thiện

#### ✅ Điểm mạnh:
- Enum rõ ràng, dễ maintain
- Optional: User không bắt buộc phải chọn
- UI hiển thị đẹp với badge

#### ⚠️ Vấn đề tiềm ẩn:

1. **Labels không nhất quán:**
   - Frontend: "Đang tìm việc", "Đang tìm kiếm", "Không có sẵn"
   - Public display: "Open to Work", "Looking", "Not Available"
   - ⚠️ Nên thống nhất ngôn ngữ (tiếng Việt hoặc tiếng Anh)

2. **Thiếu phân biệt màu sắc:**
   - Tất cả status đều hiển thị màu xanh (`bg-green-50`, `text-green-700`)
   - Nên có màu khác nhau:
     - `OPEN_TO_WORK` / `LOOKING`: Xanh (tích cực)
     - `NOT_AVAILABLE`: Xám hoặc vàng (trung tính)

3. **Thiếu logic filter/search:**
   - Chưa có tính năng filter ứng viên theo status
   - Có thể thêm vào trang tìm kiếm ứng viên

4. **Thiếu mô tả chi tiết:**
   - User có thể không hiểu rõ sự khác biệt giữa `OPEN_TO_WORK` và `LOOKING`
   - Nên thêm tooltip hoặc description

#### 💡 Đề xuất cải thiện:

```typescript
// 1. Thống nhất labels
const statusConfig: Record<UserStatus, {
  label: string;
  description: string;
  color: 'green' | 'yellow' | 'gray';
}> = {
  OPEN_TO_WORK: {
    label: 'Đang tìm việc',
    description: 'Tôi đang tích cực tìm kiếm cơ hội việc làm mới',
    color: 'green',
  },
  LOOKING: {
    label: 'Đang tìm kiếm',
    description: 'Tôi đang xem xét các cơ hội phù hợp',
    color: 'green',
  },
  NOT_AVAILABLE: {
    label: 'Không có sẵn',
    description: 'Tôi hiện không tìm kiếm cơ hội mới',
    color: 'gray',
  },
};

// 2. Thêm tooltip trong form
<select>
  <option value="">Chọn trạng thái</option>
  {Object.entries(statusConfig).map(([value, config]) => (
    <option key={value} value={value} title={config.description}>
      {config.label}
    </option>
  ))}
</select>

// 3. Badge với màu khác nhau
const colorClasses = {
  green: 'bg-green-50 text-green-700 border-green-200',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  gray: 'bg-gray-50 text-gray-700 border-gray-200',
};
```

---

## 🔗 Mối quan hệ giữa isPublic và status

### Logic hiện tại:
- `isPublic = false` → Profile không hiển thị (404) → Status không quan trọng
- `isPublic = true` → Profile hiển thị → Status hiển thị nếu có

### Use Case kết hợp:

| isPublic | status | Kết quả |
|----------|--------|---------|
| `true` | `OPEN_TO_WORK` | ✅ Profile công khai + Badge "Open to Work" |
| `true` | `null` | ✅ Profile công khai, không có badge |
| `false` | `OPEN_TO_WORK` | ❌ Profile ẩn (404), status không hiển thị |
| `false` | `null` | ❌ Profile ẩn (404) |

### Đề xuất:
- Nếu `isPublic = false`, có thể hiển thị thông báo: "Hồ sơ của bạn đang ở chế độ riêng tư. Bật 'Công khai hồ sơ' để nhà tuyển dụng có thể tìm thấy bạn."

---

## 📊 Tổng kết

### ✅ Đã implement đúng:
1. ✅ `isPublic` với default `true`
2. ✅ `status` enum với 3 giá trị
3. ✅ Logic ẩn/hiện profile dựa trên `isPublic`
4. ✅ UI/UX rõ ràng với Switch và Select

### ⚠️ Cần cải thiện:
1. ⚠️ Thêm cơ chế "chỉ công ty đã apply" cho `isPublic`
2. ⚠️ Thống nhất labels giữa form và public display
3. ⚠️ Thêm màu sắc khác nhau cho các status
4. ⚠️ Thêm tooltip/description cho status
5. ⚠️ Thêm thông báo khi toggle `isPublic` OFF

### 🚀 Tính năng mở rộng:
1. 🔍 Filter ứng viên theo status trong trang tìm kiếm
2. 📧 Thông báo cho user khi profile bị ẩn
3. 📊 Analytics: Thống kê số lượt xem profile theo status
4. 🔔 Reminder: Nhắc user cập nhật status nếu lâu không thay đổi

