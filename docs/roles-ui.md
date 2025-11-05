## JoyWork Roles & UI/Flow (KHÔNG HR)

### Mục đích & Phạm vi
- JoyWork KHÔNG quản lý nhân sự (onboarding, chấm công, lương, hợp đồng…).
- Ứng tuyển chỉ gồm: nộp CV/hồ sơ + liên hệ qua Inbox; có thể theo dõi trạng thái Application.
- Chỉ công ty được đăng bài (Story/Announcement/Event). Không có bài viết cá nhân. Bình luận: tắt.
- "Thành viên công ty" trong sản phẩm = người được cấp quyền quản trị trang công ty (không hàm ý quan hệ lao động/HR).

### Tầng vai trò
- GUEST: chưa đăng nhập.
- USER (Ứng viên): người dùng cá nhân của nền tảng.
- COMPANY ROLES (trên từng công ty): OWNER | ADMIN | MEMBER (cộng tác viên/quản trị nội dung).
- SYSTEM ADMIN: quản trị hệ thống JoyWork.

Ghi chú: OWNER/ADMIN/MEMBER vẫn là USER bình thường. Họ có thể ứng tuyển như mọi cá nhân (xem chính sách ứng tuyển bên dưới).

### Chính sách nội dung & tương tác
- Bài viết: chỉ công ty đăng. Không có bài viết cá nhân.
- Bình luận: tắt (không UI comment).
- Like/Follow: bật để tăng tương tác nhẹ cho Feed và Company Profile.

### Chính sách ứng tuyển
- P0 (mặc định): Cho phép mọi USER (kể cả OWNER/ADMIN/MEMBER của công ty khác) ứng tuyển ở bất kỳ công ty nào, kể cả công ty mình đang quản trị. Lý do: sản phẩm không xử lý HR nội bộ, chỉ đóng vai trò kênh kết nối.
- P1 (tùy chọn nếu cần): Chặn apply vào chính công ty người dùng đang có membership. Khi bật P1:
  - Backend: trước khi tạo `Application`, nếu tồn tại `CompanyMember(userId, job.companyId)` → trả 403.
  - Frontend: ẩn/disable nút Apply cho các job thuộc công ty của tôi, hiển thị tooltip.

### UI hiển thị theo vai trò
- GUEST
  - Feed/Company/Jobs: chỉ xem. Các hành động (Like/Follow/Apply) → yêu cầu đăng nhập.
- USER (Ứng viên)
  - Feed: xem, Like, Follow công ty.
  - Jobs: xem chi tiết, Apply, theo dõi trạng thái Application; trao đổi qua Inbox theo Application.
  - Không có nút “Viết bài”.
- COMPANY MEMBER – MEMBER (cộng tác viên)
  - Trên trang công ty: có thể thấy mục Quản trị nếu được cấp; quyền xuất bản có thể bật/tắt theo chính sách nội bộ (mặc định: có thể đăng/soạn khi được ADMIN/OWNER cho phép).
- COMPANY ADMIN
  - Trên trang công ty: tab “Quản trị” (Stories, Jobs, Applications, Members). Nút “Viết story”, “Tạo job”.
  - Không có tính năng HR nội bộ (không quản lý hợp đồng, chấm công…).
- COMPANY OWNER
  - Như ADMIN + các quyền cấp cao (đổi slug, xóa công ty…).
- SYSTEM ADMIN
  - Khu Moderation/Duyệt công ty/Gỡ nội dung/Khóa user/Analytics hệ thống.

### Menu chuẩn & chức năng

| Menu | Vị trí | Hiển thị cho | Chức năng chính |
|------|--------|--------------|-----------------|
| `Feed` / `Home` | Header, LeftNav | USER, COMPANY MEMBER, SYS_ADMIN | Trang tổng hợp bài viết (story/announcement/event) và các khối discovery; cho phép Like/Follow (nếu đăng nhập). |
| `Jobs` | Header, LeftNav | GUEST (chỉ xem), USER, COMPANY MEMBER, SYS_ADMIN | Danh sách việc làm. USER có thể Apply; COMPANY ADMIN/OWNER thấy nút quản lý Job của công ty mình (CTA dẫn tới trang quản trị). |
| `Companies` / `Discover` | Header, LeftNav | GUEST, USER, COMPANY MEMBER, SYS_ADMIN | Khám phá hồ sơ công ty, theo dõi, truy cập cover story. |
| `Inbox` | Header, LeftNav | USER, COMPANY MEMBER, SYS_ADMIN | Tin nhắn theo Application. COMPANY ADMIN/OWNER dùng để trao đổi với ứng viên. |
| `My Profile` | LeftNav | USER, COMPANY MEMBER, SYS_ADMIN | Quản lý hồ sơ cá nhân (ảnh, headline, kỹ năng, CV). GUEST: ẩn. |
| `Saved Jobs` | LeftNav | USER, COMPANY MEMBER, SYS_ADMIN | Bộ sưu tập việc làm đã lưu (favorited). |
| `Following Companies` | LeftNav | USER, COMPANY MEMBER, SYS_ADMIN | Liệt kê công ty đã follow, nhanh truy cập story/job mới. |
| `My Applications` | LeftNav hoặc dropdown tài khoản | USER, COMPANY MEMBER | Theo dõi trạng thái các hồ sơ đã nộp; truy cập nhanh tới thread Inbox tương ứng. |
| `Công ty của tôi` (nhóm) | LeftNav | COMPANY MEMBER ( OWNER/ADMIN/MEMBER ) | Danh sách công ty mà user được cấp quyền. Mỗi mục dẫn tới `Trang công ty` hoặc `Quản trị`. |
| `Trang công ty` | LeftNav (trong nhóm) | COMPANY MEMBER | Xem giao diện công khai của công ty (story, job). |
| `Quản trị` | LeftNav (trong nhóm) | OWNER, ADMIN | Dashboard nội bộ: quản lý Stories, Jobs, Applications, Collaborators. |
| `Invite collaborators` | LeftNav (trong nhóm) | OWNER, ADMIN | Mời USER khác tham gia quản trị công ty (tạo `CompanyMember`). |
| `System` | Header dropdown + LeftNav (nhóm riêng) | SYS_ADMIN | Moderation, Companies verification, Reports, System settings. |
| `Login` / `Register` CTA | Header | GUEST | Điều hướng tới form đăng nhập/đăng ký. |
| `Account dropdown` | Header | USER, COMPANY MEMBER, SYS_ADMIN | Hiển thị tên/email, truy cập `My Profile`, `My Applications`, `Sign out`. |

Ghi chú:
- Header dùng cho điều hướng cấp cao và hoạt động tốt trên mobile. LeftNav (desktop) hiển thị tùy vai trò, tập trung vào tác vụ thường dùng.
- Các mục không áp dụng cho vai trò hiện tại phải được ẩn hoàn toàn (không disable “cho có”).
- Khi số lượng công ty lớn, nhóm `Công ty của tôi` dùng dropdown hoặc accordion để tránh quá dài.
- Tránh trùng lặp: sử dụng một nhãn duy nhất `Feed` (thay vì vừa `Home` vừa `Main Feed`). Header và LeftNav đều tham chiếu cùng route `/`, nhưng Header chỉ là link, LeftNav là mục chính để chuyển nhanh.

### Flow theo vai trò & menu

#### GUEST (chưa đăng nhập)
- `Feed` → xem feed công ty, CTA `Đăng nhập để tương tác` thay cho Like/Follow.
- `Jobs` → xem danh sách việc làm; bấm `Apply` mở modal đăng nhập/đăng ký.
- `Companies` → xem hồ sơ công ty; nút `Follow` yêu cầu đăng nhập.
- `Inbox` → ẩn khỏi menu; truy cập trực tiếp trả về trang đăng nhập.
- `Login/Register` CTA → dẫn tới form, sau khi thành công chuyển về `Feed`.

#### USER (ứng viên)
- `Feed` → xem và tương tác (Like/Follow). CTA “Khám phá Jobs” trong feed dẫn tới `/jobs`.
- `Jobs` → tìm kiếm, filter; bấm `Apply` → tạo `Application`, mở trạng thái application + thread Inbox tương ứng.
- `Companies` → khám phá, Follow; từ trang công ty có nút `Xem việc đang tuyển` và `Follow`.
- `Inbox` → list thread (mặc định sắp xếp theo thời gian cập nhật); mở thread → chat one-to-one với đại diện công ty.
- `My Profile` → chỉnh hồ sơ; lưu → toast thành công, quay lại feed.
- `Saved Jobs` / `Following Companies` / `My Applications` → liệt kê dữ liệu cá nhân, mỗi item có CTA quay lại Jobs/Companies/Inbox.

#### COMPANY MEMBER (OWNER/ADMIN/MEMBER)
- Tất cả flow của USER.
- `Công ty của tôi` → chọn một công ty:
  - `Trang công ty` → preview công khai; CTA “Viết story” (OWNER/ADMIN) hoặc “Yêu cầu quyền viết” (MEMBER chưa được cấp).
  - `Quản trị` (OWNER/ADMIN) → dashboard gồm:
    1. `Stories` (quản lý bài viết) → create/edit.
    2. `Jobs` (danh sách job công ty) → tạo job mới.
    3. `Applications` → xem hồ sơ ứng viên, mở Inbox.
    4. `Collaborators` → quản lý thành viên, mời thêm.
- `Invite collaborators` → flow mời user qua email hoặc userId; sau khi gửi hiển thị trạng thái pending.

#### SYSTEM ADMIN
- `Feed`, `Jobs`, `Companies`, `Inbox` → như USER (để trải nghiệm giống người dùng).
- `System` nhóm:
  - `Moderation` → danh sách báo cáo nội dung, xử lý Hide/Delete.
  - `Companies verification` → duyệt hồ sơ công ty mới.
  - `Reports`/`Analytics` → biểu đồ thống kê.
- Ngoài ra, System Admin có thể truy cập mọi `Quản trị` công ty ở chế độ read-only + có quyền khóa/bỏ khóa công ty.

#### Kết quả khi điều hướng (summary)
- Mỗi menu phải dẫn tới một trang duy nhất, không pop-up ngoại trừ CTA (Apply, Invite…).
- Nếu thiếu quyền → chuyển hướng tới trang thông báo quyền hạn (ví dụ: truy cập Quản trị khi chỉ là MEMBER: thông báo “Bạn cần quyền ADMIN”).
- Form trong các trang (Apply, Viết story, Invite) sau khi thành công phải điều hướng về bảng liệt kê tương ứng và highlight item mới.

### Ma trận quyền (rút gọn)

| Hành động                      | GUEST | USER | MEMBER | ADMIN | OWNER | SYS_ADMIN |
|--------------------------------|:-----:|:----:|:------:|:-----:|:-----:|:--------:|
| Xem feed/công ty               |  ✅   |  ✅  |   ✅    |  ✅   |  ✅   |    ✅     |
| Follow công ty                 |  ❌   |  ✅  |   ✅    |  ✅   |  ✅   |    ✅     |
| Like bài viết                  |  ❌   |  ✅  |   ✅    |  ✅   |  ✅   |    ✅     |
| Apply job                      |  ❌   |  ✅  |   ✅    |  ✅   |  ✅   |    ✅     |
| Viết story công ty             |  ❌   |  ❌  |   ⭕    |  ✅   |  ✅   |    ✅     |
| Tạo job                        |  ❌   |  ❌  |   ⭕    |  ✅   |  ✅   |    ✅     |
| Quản trị trang công ty         |  ❌   |  ❌  |   ⭕    |  ✅   |  ✅   |    ✅     |
| Moderation hệ thống            |  ❌   |  ❌  |   ❌    |  ❌   |  ❌   |    ✅     |

Ghi chú: ⭕ = tùy chính sách công ty (cấp quyền cho MEMBER).

### Flow sử dụng
- USER (Ứng viên): Feed → Company Profile (storytelling) → Jobs → Apply → Inbox theo Application. Không comment.
- COMPANY ADMIN/OWNER: Tạo công ty → Xuất bản Story → Đăng Job → Theo dõi Applications → Trao đổi qua Inbox. Không có module HR nội bộ.
- SYSTEM ADMIN: Moderation/Duyệt công ty/Gỡ nội dung/Thống kê.

### Copywriting & thuật ngữ
- Dùng “quản trị viên/cộng tác viên công ty” thay cho “nhân viên”.
- Tránh từ ngữ gợi ý quản trị nhân sự (ví dụ: HRMS, chấm công, phê duyệt nghỉ phép…).

### Dữ liệu/Endpoint cần cho UI gating
- Client cần biết:
  - `user.role` để xác định SYSTEM ADMIN.
  - Danh sách memberships: `{ companyId, slug, role }` để hiện/ẩn tính năng quản trị theo từng công ty.
- Hiện có:
  - `/api/auth/me` → `{ user: { id, email, name, role } }`.
  - `/api/companies/me/companies` → danh sách công ty của tôi (chưa trả `role`).
- Đề xuất (tùy chọn): thêm endpoint `/api/users/me/memberships` trả `{ companyId, slug, role }` hoặc mở rộng endpoint hiện tại để kèm `role`.

### Kiểm thử nhanh (QA scenarios)
1) GUEST vào Feed: các nút Like/Follow/Apply mở modal Login.
2) USER Apply job: thấy trạng thái Application và có thread Inbox tương ứng.
3) USER không thấy nút “Viết story”.
4) ADMIN/OWNER thấy tab Quản trị và nút “Viết story/Tạo job” trên trang công ty.
5) Nếu bật chính sách P1: USER là member của công ty đăng job → nút Apply bị disable với tooltip giải thích.

—

Tài liệu này mô tả chính sách vai trò & UI/Flow theo phạm vi KHÔNG HR. Mọi chỉnh sách tùy chọn (ví dụ P1) sẽ chỉ ảnh hưởng logic hiển thị và kiểm tra đơn giản ở API Applications.


