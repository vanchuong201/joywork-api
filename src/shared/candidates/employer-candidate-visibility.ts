/**
 * CV live (CV mặc định) chỉ hiển thị cho chính chủ hoặc khi ứng viên đang bật tìm việc.
 * DN đã nhận đơn xem snapshot của đơn, không dựa vào quyền này.
 */
export function canViewLiveCandidateCv(params: {
  isOwner: boolean;
  isSearchingJob: boolean | null | undefined;
  accountActive?: boolean;
}): boolean {
  if (params.isOwner) return true;
  if (params.accountActive === false) return false;
  return params.isSearchingJob === true;
}

export const CANDIDATE_CV_UNAVAILABLE_MESSAGE = 'CV không tồn tại hoặc không còn công khai';
