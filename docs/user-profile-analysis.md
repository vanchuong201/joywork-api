# 📊 Phân tích: Trang Profile/CV Cá Nhân (User Profile)

> **Nguồn**: Template CV từ Google AI Studio  
> **Mục đích**: Tạo trang public profile/CV cho user, các member của company có thể xem

---

## 🎯 Tổng quan

Trang **User Profile** là một trang **public CV** hiển thị thông tin cá nhân, kinh nghiệm, kỹ năng của ứng viên. Trang này được thiết kế để:
- **Public**: Có thể share, xem bởi các member của company
- **Matching-focused**: Có cấu trúc KSA (Knowledge, Skills, Attitude) để match với Job Description
- **Professional**: Layout 2 cột, timeline cho experience, highlight achievements

---

## 📋 Cấu trúc dữ liệu (Data Model)

### 1. **Thông tin cơ bản (Basic Info)**
```typescript
{
  name: string;              // "Nguyễn Văn A"
  title: string;             // "Full-stack Developer (React/Node.js)"
  avatar: string;           // URL ảnh đại diện
  location: string;         // "Hồ Chí Minh, Việt Nam"
  email: string;            // "nguyenvana@email.com"
  phone: string;            // "0909 123 456"
  status: string;           // "Open to Work" | "Not Available" | etc.
  bio: string;              // Mô tả giới thiệu bản thân (paragraph)
}
```

### 2. **Kinh nghiệm làm việc (Experience)**
```typescript
experience: Array<{
  role: string;             // "Senior Frontend Developer"
  company: string;          // "Innovate Tech"
  period: string;           // "2019 - Hiện tại"
  desc: string;             // Mô tả tổng quan công việc
  achievements: string[];    // ["Tối ưu hóa Core Web Vitals...", ...]
}>
```

**Đặc điểm**:
- Hiển thị dạng **timeline** (vertical line với dots)
- Mỗi experience có section **Achievements/KPIs** riêng
- Có icon Building2 cho company name

### 3. **Học vấn (Education)**
```typescript
education: Array<{
  school: string;           // "Đại học Khoa học Tự nhiên"
  degree: string;           // "Cử nhân Công nghệ thông tin"
  period: string;           // "2015 - 2019"
}>
```

### 4. **KSA - Năng lực (Knowledge, Skills, Attitude)**
```typescript
ksa: {
  knowledge: string[];      // ["Kiến thức sâu về JavaScript...", ...]
  skills: string[];         // ["React, Next.js, Tailwind CSS", ...]
  attitude: string[];       // ["Cầu tiến, ham học hỏi...", ...]
}
```

**Mục đích**: Cấu trúc này **match trực tiếp** với Job Description requirements (KSA structure trong JD).

### 5. **Mong muốn (Expectations)**
```typescript
expectations: {
  salary: string;           // "$2000 - $2500"
  workMode: string;         // "Hybrid hoặc Remote"
  culture: string;          // "Môi trường cởi mở, minh bạch..."
}
```

### 6. **Mục tiêu nghề nghiệp (Career Goals)**
```typescript
careerGoals: string[];      // ["Trở thành Technical Lead trong 2 năm tới", ...]
```

---

## 🎨 Giao diện (UI/UX Structure)

### **Layout tổng thể**
```
┌─────────────────────────────────────────┐
│  Sticky Header (Back | Title | Share)    │
├─────────────────────────────────────────┤
│  Profile Header Card                     │
│  ┌──────────┐                            │
│  │ Avatar   │ Name, Title, Location      │
│  │ (Online) │ Email, Phone               │
│  │          │ Status Badge | Edit Btn    │
│  └──────────┘                            │
├─────────────────────────────────────────┤
│  ┌──────────────┬──────────────────────┐ │
│  │ LEFT (1/3)   │ RIGHT (2/3)          │ │
│  │              │                       │ │
│  │ • KSA        │ • Bio/Mission         │ │
│  │ • Expectations│ • Experience Timeline │ │
│  │ • Education  │   (với Achievements) │ │
│  └──────────────┴──────────────────────┘ │
└─────────────────────────────────────────┘
```

### **1. Sticky Header**
- **Vị trí**: `sticky top-0 z-50`
- **Nội dung**:
  - Nút "Quay lại JOYWork" (bên trái)
  - Title "Hồ Sơ Cá Nhân" (giữa)
  - Nút "Chia sẻ" (bên phải)
- **Style**: `bg-white border-b shadow-sm`

### **2. Profile Header Card**
- **Layout**: Flex row (responsive: column trên mobile)
- **Avatar**: 
  - `w-32 h-32 rounded-full`
  - Border 4px white + shadow-lg
  - Badge "Online" (green dot) ở góc dưới phải
- **Thông tin**:
  - Name: `text-3xl font-black`
  - Title: `text-lg text-slate-600`
  - Location/Email/Phone: Icons + text, flex-wrap
- **Actions**:
  - Status badge: `bg-green-50 text-green-700` với CheckCircle icon
  - Edit button: Border, hover effect

### **3. Left Column (1/3 width)**
#### **3.1. KSA Card** (Năng lực)
- **Header**: 
  - Icon Sparkles (joy-pink)
  - Badge "Matching Data" (joy-pink)
- **3 sections**:
  - **Kiến thức**: List với BookOpen icon
  - **Kỹ năng**: Tags/badges (flex-wrap)
  - **Thái độ**: List với Heart icon
- **Style**: `border-t-4 border-joy-pink` (accent top border)

#### **3.2. Expectations Card** (Mong muốn)
- **Icon**: Target
- **Fields**:
  - Mức lương kỳ vọng (green-600, bold)
  - Hình thức làm việc
  - Văn hóa mong muốn (italic, quote style)

#### **3.3. Education Card**
- **Icon**: GraduationCap
- **List**: School → Degree → Period

### **4. Right Column (2/3 width)**
#### **4.1. Bio/Mission Card**
- **Title**: "Giới thiệu bản thân (Sứ Mệnh)" với UserCheck icon
- **Content**: Paragraph `text-lg leading-relaxed`
- **Career Goals section**:
  - Border-top separator
  - Grid layout cho goals
  - TrendingUp icon cho mỗi goal

#### **4.2. Experience Timeline Card**
- **Title**: "Kinh Nghiệm Làm Việc (Nhiệm Vụ)" với Briefcase icon
- **Timeline structure**:
  ```
  ●─── Role 1
  │    Company
  │    Description
  │    ┌─ Achievements ─┐
  │    │ • KPI 1       │
  │    │ • KPI 2       │
  │    └───────────────┘
  │
  ●─── Role 2
  ...
  ```
- **Visual**:
  - Vertical line: `border-l-2 border-slate-100`
  - Dots: `w-4 h-4 rounded-full bg-joy-blue border-4 border-white`
  - Company name: `text-joy-blue font-bold` với Building2 icon
- **Achievements section**:
  - Background: `bg-slate-50`
  - Icon: BarChart3
  - List items với CheckCircle (green)

---

## 🎨 Design System & Styling

### **Colors**
- **Primary**: `joy-blue` (brand color)
- **Accent**: `joy-pink` (matching data highlight)
- **Success**: `green-500/600/700` (status, achievements)
- **Neutral**: `slate-50/100/200/400/500/600/700/900`

### **Spacing & Layout**
- **Container**: `max-w-5xl mx-auto px-4`
- **Cards**: `rounded-2xl shadow-sm border border-slate-200`
- **Gap**: `gap-8` giữa sections, `gap-6` trong cards
- **Padding**: `p-6` hoặc `p-8` tùy card size

### **Typography**
- **Headings**: `font-black` hoặc `font-bold`
- **Body**: `text-slate-700` hoặc `text-slate-600`
- **Small text**: `text-sm` hoặc `text-xs`

### **Icons** (Lucide React)
- Sparkles (KSA)
- BookOpen (Knowledge)
- Zap (Skills)
- Heart (Attitude)
- Target (Expectations)
- GraduationCap (Education)
- UserCheck (Bio)
- Briefcase (Experience)
- BarChart3 (Achievements)
- TrendingUp (Career Goals)
- CheckCircle (Status, Achievements)
- Building2 (Company)
- MapPin, Mail, Phone (Contact info)

---

## 🔑 Tính năng chính (Key Features)

### **1. Public & Shareable**
- Có nút "Chia sẻ" ở header
- URL có thể public (không cần auth để xem)
- SEO-friendly (metadata)

### **2. Matching Engine Ready**
- **KSA structure** match với JD requirements
- Có thể highlight matching % (future feature)
- Skills hiển thị dạng tags để dễ scan

### **3. Professional Timeline**
- Experience hiển thị dạng timeline với visual dots
- Achievements/KPIs riêng biệt, dễ highlight
- Period rõ ràng (start - end)

### **4. Responsive Design**
- Mobile: Stack columns
- Tablet: 2 columns
- Desktop: 3-column grid (1/3 + 2/3)

---

## 📐 Component Structure (Đề xuất)

### **Components cần tạo**:
```
src/components/profile/
├── UserProfileHeader.tsx      # Header với avatar, name, contact
├── UserProfileKSA.tsx         # KSA card (Knowledge, Skills, Attitude)
├── UserProfileExpectations.tsx # Expectations card
├── UserProfileEducation.tsx   # Education card
├── UserProfileBio.tsx         # Bio + Career Goals
├── UserProfileExperience.tsx  # Experience Timeline
└── UserProfilePage.tsx        # Main page component
```

### **Data fetching**:
- API endpoint: `GET /api/users/:userId/profile` (public)
- Hoặc: `GET /api/users/me/profile` (own profile)
- Response structure match với `USER_PROFILE_DATA` ở trên

---

## 🔄 So sánh với trang `/account`

| Feature | `/account` | `/profile` (mới) |
|---------|-----------|------------------|
| **Mục đích** | Quản lý tài khoản | Public CV/Profile |
| **Access** | Private (chỉ owner) | Public (member của company) |
| **Edit** | Full edit form | View-only (hoặc edit riêng) |
| **Focus** | Settings, preferences | Showcase, matching |
| **Layout** | Form-based | Card-based, timeline |

---

## ✅ Checklist Implementation

### **Phase 1: Data Model & API**
- [ ] Tạo/update Prisma schema cho UserProfile (nếu cần thêm fields)
- [ ] Tạo API endpoint `GET /api/users/:userId/profile` (public)
- [ ] Tạo API endpoint `GET /api/users/me/profile` (own)
- [ ] Validation schema (Zod) cho profile data

### **Phase 2: Frontend Components**
- [ ] Tạo route `/profile/:userId` hoặc `/users/:userId`
- [ ] Component `UserProfileHeader`
- [ ] Component `UserProfileKSA`
- [ ] Component `UserProfileExpectations`
- [ ] Component `UserProfileEducation`
- [ ] Component `UserProfileBio`
- [ ] Component `UserProfileExperience`
- [ ] Main page `UserProfilePage`

### **Phase 3: Integration**
- [ ] Link từ company member list → user profile
- [ ] Link từ application → applicant profile
- [ ] Share functionality (copy link)
- [ ] SEO metadata (title, description, og:image)

### **Phase 4: Polish**
- [ ] Loading states
- [ ] Error handling (404, private profile)
- [ ] Responsive testing
- [ ] Print-friendly CSS (optional)

---

## ❓ Câu hỏi cần xác nhận

1. **Route structure**:
   - `/profile/:userId` hay `/users/:userId`?
   - Có cần slug (username) không hay chỉ dùng ID?

2. **Privacy settings**:
   - Profile mặc định là public hay private?
   - Có setting để ẩn/hiện từng section không?

3. **Edit flow**:
   - Edit trực tiếp trên `/profile` hay redirect về `/account`?
   - Có cần "Preview" mode không?

4. **Matching feature**:
   - Có hiển thị matching % với JD không? (future)
   - Có highlight skills match với JD không?

5. **Data source**:
   - Lấy từ `UserProfile` table hiện có hay cần thêm fields?
   - Experience/Education lưu ở đâu? (JSON field hay separate tables?)

---

**Tạo bởi**: AI Assistant  
**Ngày**: 2025-12-19  
**Dự án**: JoyWork Platform

