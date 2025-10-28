# JoyWork User System Documentation

## 📋 Tổng quan

JoyWork có **2 nhóm người dùng chính**:
1. **Người đi làm** (Job Seeker) - Tìm việc làm
2. **Doanh nghiệp** (Company) - Tuyển dụng nhân sự

Một người có thể có nhiều vai trò khác nhau tùy theo ngữ cảnh.

---

## 👥 Các loại người dùng

### 1️⃣ **NGƯỜI ĐI LÀM (Job Seeker)**

#### **Định nghĩa:**
- Sinh viên mới ra trường
- Người đang làm việc muốn đổi công ty
- Freelancer tìm dự án
- Bất kỳ ai muốn tìm việc làm

#### **Trong database:**
```sql
User {
  role: "USER"  -- Đây là người đi làm
}
UserProfile {
  headline: "Senior Developer"
  skills: ["JavaScript", "React", "Node.js"]
  cvUrl: "https://drive.google.com/..."
  location: "Ho Chi Minh City"
  bio: "Passionate about building great products"
}
```

#### **Chức năng:**
- ✅ Xem feed bài viết về văn hóa công ty
- ✅ Follow các công ty yêu thích
- ✅ Like/save bài viết
- ✅ Apply vào các vị trí tuyển dụng
- ✅ Chat với HR qua inbox
- ✅ Tạo và quản lý hồ sơ cá nhân
- ✅ Tìm kiếm công ty và việc làm

---

### 2️⃣ **DOANH NGHIỆP (Company)**

#### **Định nghĩa:**
- Công ty startup
- Công ty lớn (enterprise)
- Agency, studio
- Bất kỳ tổ chức nào muốn tuyển dụng

#### **Trong database:**
```sql
Company {
  name: "JoyWork Technologies"
  slug: "joywork-tech"
  description: "Platform connecting good companies with right people"
  industry: "Technology"
  size: "STARTUP"
  location: "Ho Chi Minh City"
  website: "https://joywork.vn"
}
```

#### **Chức năng:**
- ✅ Tạo hồ sơ công ty (logo, mô tả, văn hóa)
- ✅ Đăng bài viết về văn hóa công ty
- ✅ Đăng tin tuyển dụng
- ✅ Quản lý ứng viên
- ✅ Chat với ứng viên
- ✅ Xem analytics và insights

---

## 👨‍💼 **NHÂN VIÊN CÔNG TY (Company Members)**

Khi một **người đi làm** gia nhập một **công ty**, họ trở thành **Company Member** với các vai trò:

### **🏆 OWNER (Chủ sở hữu công ty)**

#### **Định nghĩa:**
- Người tạo ra công ty trên JoyWork
- Founder, CEO
- Người có quyền cao nhất trong công ty

#### **Trong database:**
```sql
CompanyMember {
  userId: "user123"
  companyId: "company456"
  role: "OWNER"
  joinedAt: "2024-01-01"
}
```

#### **Quyền hạn:**
- ✅ Quản lý toàn bộ công ty
- ✅ Thêm/xóa/sửa nhân viên
- ✅ Xóa công ty
- ✅ Đăng bài viết và tin tuyển dụng
- ✅ Quản lý ứng viên
- ✅ Xem analytics công ty
- ✅ Cấp quyền cho các members khác

### **👨‍💼 ADMIN (Quản trị viên công ty)**

#### **Định nghĩa:**
- HR Manager
- Marketing Manager
- Team Lead
- Người được Owner giao quyền quản lý

#### **Quyền hạn:**
- ✅ Quản lý công ty (trừ xóa công ty)
- ✅ Thêm/sửa nhân viên (trừ Owner)
- ✅ Đăng bài viết và tin tuyển dụng
- ✅ Quản lý ứng viên
- ✅ Xem analytics công ty
- ✅ Mời members mới

### **👥 MEMBER (Nhân viên công ty)**

#### **Định nghĩa:**
- Nhân viên thường
- Developer, Designer, Marketing
- Người được mời vào công ty

#### **Quyền hạn:**
- ✅ Xem dashboard công ty
- ✅ Đăng bài viết (nếu được phép)
- ✅ Xem ứng viên (nếu được phép)
- ✅ Tham gia chat với ứng viên

---

## 🔧 **SYSTEM ADMIN (Quản trị hệ thống)**

### **Định nghĩa:**
- Người quản lý JoyWork platform
- Developer, DevOps của JoyWork
- Support team

### **Trong database:**
```sql
User {
  role: "ADMIN"  -- System admin
}
```

### **Quyền hạn:**
- ✅ Quản lý toàn hệ thống JoyWork
- ✅ Verify các công ty
- ✅ Xóa nội dung không phù hợp
- ✅ Quản lý tất cả users
- ✅ Xem analytics toàn hệ thống
- ✅ Ban/unban users
- ✅ Quản lý system settings

---

## 📊 **Ví dụ thực tế**

### **Scenario 1: Anh Minh - Developer**
```
User: {
  email: "minh@email.com",
  role: "USER"  -- Người đi làm
}
UserProfile: {
  headline: "Senior React Developer",
  skills: ["React", "Node.js", "TypeScript"]
}
CompanyMember: {
  companyId: "joywork-tech",
  role: "MEMBER"  -- Nhân viên của JoyWork
}
```
**→ Anh Minh vừa là người đi làm, vừa là nhân viên JoyWork**

### **Scenario 2: Chị Lan - HR Manager**
```
User: {
  email: "lan@email.com",
  role: "USER"  -- Người đi làm
}
CompanyMember: {
  companyId: "abc-corp",
  role: "ADMIN"  -- HR Manager của ABC Corp
}
```
**→ Chị Lan vừa là người đi làm, vừa là Admin của ABC Corp**

### **Scenario 3: Anh Tuấn - Founder**
```
User: {
  email: "tuan@email.com",
  role: "USER"  -- Người đi làm
}
CompanyMember: {
  companyId: "startup-xyz",
  role: "OWNER"  -- Founder của Startup XYZ
}
```
**→ Anh Tuấn vừa là người đi làm, vừa là Owner của Startup XYZ**

---

## 🔄 **Luồng hoạt động**

### **Onboarding Flow:**
1. **Đăng ký** → Tạo User (role: USER)
2. **Tạo UserProfile** → Thông tin nghề nghiệp
3. **Tạo Company** → Trở thành OWNER
4. **Invite members** → Thêm ADMIN/MEMBER

### **Permission Matrix:**
| Action | USER | MEMBER | ADMIN | OWNER | SYSTEM_ADMIN |
|--------|------|--------|-------|-------|--------------|
| View companies | ✅ | ✅ | ✅ | ✅ | ✅ |
| Follow companies | ✅ | ✅ | ✅ | ✅ | ✅ |
| Apply jobs | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create company | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage company | ❌ | ❌ | ✅ | ✅ | ✅ |
| Delete company | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage members | ❌ | ❌ | ✅ | ✅ | ✅ |
| System admin | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 🎯 **Tóm tắt**

| Đối tượng | Mô tả | Ví dụ |
|-----------|-------|-------|
| **USER** | Người đi làm | Developer, Designer, Marketing |
| **OWNER** | Chủ công ty | Founder, CEO |
| **ADMIN** | Quản lý công ty | HR Manager, Team Lead |
| **MEMBER** | Nhân viên công ty | Developer, Designer |
| **SYSTEM_ADMIN** | Quản trị JoyWork | Support, Developer JoyWork |

**Lưu ý:** Một người có thể có nhiều vai trò cùng lúc!

---

## 🔐 **Authentication & Authorization**

### **JWT Token Structure:**
```json
{
  "userId": "user123",
  "role": "USER",
  "iat": 1640995200,
  "exp": 1640996100
}
```

### **Permission Check Flow:**
1. Verify JWT token
2. Get user from database
3. Check system role (USER/ADMIN)
4. Check company membership (if needed)
5. Check company role (OWNER/ADMIN/MEMBER)
6. Grant/deny access

### **Middleware Chain:**
```
AuthMiddleware.verifyToken() 
→ AuthMiddleware.requireAdmin() (if needed)
→ CompanyMiddleware.checkMembership() (if needed)
→ CompanyMiddleware.checkRole() (if needed)
```

---

*Tài liệu này được cập nhật lần cuối: 27/10/2025*
