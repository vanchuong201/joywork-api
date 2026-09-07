# Mở CV — cron tắt gói theo chu kỳ (chưa làm)

Ghi chú để bổ sung job nền. **Hiện tại không có cron / scheduler.**

## Hành vi hiện tại (lazy)

Khi admin bật/lưu Mở CV (`setCompanyCvFlipStatus`, `enabled=true`):

- Metadata: `monthlyTotalLimit`, `cycleStartDay`, `cycleCount` (mặc định 1).
- `CompanyFeatureEntitlement.expiresAt` = **00:00 giờ VN** ngày bắt đầu chu kỳ thứ `cycleCount + 1`.
- Tính bởi `computeCvFlipExpiresAt` trong `src/shared/cv-flip-cycle.ts` (UTC+7, `cycleStartDay` 1–31, tháng ngắn clamp ngày cuối).

Khi đọc/dùng, nếu `enabled && expiresAt <= now` thì persist `enabled=false`:

- `CvFlipService.getCompanyLimits` / `disableExpiredCvFlipEntitlements` / `checkAccess`
- `SystemService.listCompanies` (trước khi lọc ON/OFF)

DN hết hạn vẫn bị chặn flip ngay ở lần request đầu tiên sau mốc; cột `enabled` trên DB có thể còn `true` cho đến request đó.

Hai đồng hồ:

| Đồng hồ | Việc | Cron có cần? |
|---|---|---|
| Gói (`expiresAt` + `cycleCount`) | Tắt hẳn Mở CV sau N tháng | **Có** — đây là việc cron sẽ làm |
| Quota chu kỳ (`getCyclePeriod` + `CvFlipUsage` month/year) | Đếm lượt trong 1 tháng chu kỳ | Không — sang kỳ mới tự dùng row usage khác |

Hết **Tổng lượt mở** trong kỳ: expire mọi `CvFlipRequest` `PENDING` của DN (không phải việc của cron gói). Request PENDING cũng hết hạn lazy +10 ngày trong `listMyRequests`.

## Việc cron nên làm

1. Chạy **sau 00:00 VN** mỗi ngày (ví dụ 00:05 `Asia/Ho_Chi_Minh`), hoặc mỗi giờ nếu muốn tắt sớm hơn.
2. `updateMany` `CompanyFeatureEntitlement` nơi `featureKey = 'CV_FLIP'`, `enabled = true`, `expiresAt <= now` → `enabled = false`.
3. Tái sử dụng cùng điều kiện với `disableExpiredCvFlipEntitlements` (cv-flip + system). Nên tách helper dùng chung để cron và lazy không lệch.
4. Log số record đã tắt (Fastify logger), không log metadata nhạy cảm.

**Quyết định còn mở (xác nhận khi làm):**

- Cron có `updateMany` request `PENDING` của các DN vừa tắt gói → `EXPIRED` + `respondedAt=now` hay không? Lazy hiện **không** expire PENDING khi hết hạn gói; ứng viên approve lúc gói đã tắt mới nhận `CV_FLIP_REQUEST_EXPIRED`. Nếu muốn list ProfileTab hiện “Đã hết hạn” ngay sau nửa đêm thì cron nên expire PENDING luôn.

Không cần:

- Reset `CvFlipUsage` (quota theo month/year, không phải job).
- Drop cột `requestCount` / field metadata `monthlyRequestLimit` cũ.
- Recalc `expiresAt` (chỉ ghi lại khi admin bật/lưu cấu hình).

## File chạm khi implement

- `src/shared/cv-flip-cycle.ts` — giữ công thức `expiresAt`.
- `src/modules/cv-flip/cv-flip.service.ts` — `disableExpiredCvFlipEntitlements`.
- `src/modules/system/system.service.ts` — bản admin list.
- Chưa có module cron trong repo; chọn chỗ đăng ký job khi có (script + systemd/compose, hoặc Fastify plugin). Deploy: `joywork-deploy` nếu cần schedule trên server.

Luồng nghiệp vụ tổng: `documents/cv-flip-flow.vi.md` (repo documents).
