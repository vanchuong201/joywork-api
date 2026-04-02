# Province Location Matching Summary

## Mục tiêu

Phần `province` được chuẩn hóa để phục vụ 2 mục tiêu:

1. Dùng cho UI chọn địa điểm ở CV, JD, company profile.
2. Làm nền tảng lâu dài cho auto-matching giữa ứng viên và doanh nghiệp.

## Dữ liệu chuẩn

Nguồn chuẩn vận hành là bảng DB:

- `province_registry`
- `province_aliases`

`docs/province.json` vẫn được giữ để seed/import dữ liệu và làm dữ liệu tham chiếu.

Mỗi province hiện có các trường:

- `code`: mã chuẩn, immutable, dạng slug ASCII. Ví dụ: `ha-noi`, `tp-ho-chi-minh`
- `name`: tên hiển thị tiếng Việt
- `type`: loại đơn vị hành chính
- `region`: `north` | `central` | `south`
- `merged`: có phải tỉnh/thành sau sáp nhập hay không
- `merged_from`: danh sách tên cũ
- `merged_from_codes`: danh sách mã cũ

## Nguyên tắc thiết kế

### 1. Lưu bằng `code`, không lưu bằng `name`

- DB và matching logic dùng `code`
- UI hiển thị bằng `name`
- Khi tên hiển thị thay đổi, dữ liệu DB không bị ảnh hưởng

### 2. Hỗ trợ tìm theo tỉnh cũ

Khi user search:

- có thể gõ tên tỉnh mới
- có thể gõ tên tỉnh cũ đã sáp nhập
- có thể map về tỉnh mới tương ứng

Ví dụ:

- `Yên Bái` -> `lao-cai`
- `Bình Dương` -> `tp-ho-chi-minh`
- `Quảng Nam` -> `da-nang`

### 3. Hỗ trợ matching theo nhiều cấp

Thiết kế hiện tại hướng đến các mức matching địa điểm:

- `Exact province match`: ứng viên và job giao nhau cùng `province code`
- `Region match`: khác tỉnh nhưng cùng `region`
- `Remote fallback`: job remote có thể nới điều kiện location

## Mô hình dữ liệu đề xuất/đã đi theo

### UserProfile

- dùng `locations: string[]`
- lưu danh sách province code mà ứng viên chấp nhận làm việc

### Job

- dùng `locations: string[]`
- lưu danh sách province code mà JD tuyển dụng

### Company

- giữ `location: string | null`
- dùng như location trụ sở chính
- giá trị lưu là province code

## Ý nghĩa cho auto-matching sau này

Với thiết kế này, service matching có thể:

1. So sánh trực tiếp `candidate.locations` và `job.locations`
2. Chấm điểm cao khi cùng tỉnh
3. Chấm điểm trung bình khi khác tỉnh nhưng cùng vùng
4. Kết hợp thêm `salary range`, `currency`, `work mode`, `remote`

## Quy tắc hiển thị

- API có thể trả thêm `locationName` hoặc fallback `location` để tương thích UI cũ
- UI mới nên ưu tiên:
  - submit bằng `code`
  - render bằng `name`

## Ghi chú migration

Khi migrate dữ liệu cũ:

- dữ liệu text cũ được resolve sang `code`
- nếu là tên tỉnh cũ thì map sang tỉnh mới
- giá trị không resolve được cần giữ lại để review thủ công

## Vận hành registry

- API khởi động theo cơ chế DB-first: nếu bảng `province_registry` đang trống thì seed dữ liệu mặc định, sau đó nạp lại registry từ DB.
- Có thể chủ động seed lại từ `docs/province.json` bằng lệnh:
  - `npm run db:seed:provinces`
- Endpoint admin để xem registry/alias:
  - `GET /api/system/provinces`

## Kết luận

Phần `province` không còn chỉ là danh sách select cho form, mà đã được định hướng thành một `canonical location registry` để dùng chung cho:

- nhập liệu
- tìm kiếm
- lọc dữ liệu
- scoring cho matching engine trong tương lai
