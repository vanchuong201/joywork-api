export type ProvinceRegion = 'north' | 'central' | 'south';

export interface ProvinceItem {
  code: string;
  name: string;
  type: string;
  region: ProvinceRegion;
  merged: boolean;
  merged_from: string[];
  merged_from_codes: string[];
}

export const DEFAULT_PROVINCES: ProvinceItem[] = [
  { code: 'ha-noi', name: 'Hà Nội', type: 'thành phố trực thuộc trung ương', region: 'north', merged: false, merged_from: ['Hà Nội'], merged_from_codes: ['ha-noi'] },
  { code: 'hue', name: 'Huế', type: 'thành phố trực thuộc trung ương', region: 'central', merged: false, merged_from: ['Huế'], merged_from_codes: ['hue'] },
  { code: 'cao-bang', name: 'Cao Bằng', type: 'tỉnh', region: 'north', merged: false, merged_from: ['Cao Bằng'], merged_from_codes: ['cao-bang'] },
  { code: 'dien-bien', name: 'Điện Biên', type: 'tỉnh', region: 'north', merged: false, merged_from: ['Điện Biên'], merged_from_codes: ['dien-bien'] },
  { code: 'lai-chau', name: 'Lai Châu', type: 'tỉnh', region: 'north', merged: false, merged_from: ['Lai Châu'], merged_from_codes: ['lai-chau'] },
  { code: 'son-la', name: 'Sơn La', type: 'tỉnh', region: 'north', merged: false, merged_from: ['Sơn La'], merged_from_codes: ['son-la'] },
  { code: 'lang-son', name: 'Lạng Sơn', type: 'tỉnh', region: 'north', merged: false, merged_from: ['Lạng Sơn'], merged_from_codes: ['lang-son'] },
  { code: 'quang-ninh', name: 'Quảng Ninh', type: 'tỉnh', region: 'north', merged: false, merged_from: ['Quảng Ninh'], merged_from_codes: ['quang-ninh'] },
  { code: 'thanh-hoa', name: 'Thanh Hóa', type: 'tỉnh', region: 'north', merged: false, merged_from: ['Thanh Hóa'], merged_from_codes: ['thanh-hoa'] },
  { code: 'nghe-an', name: 'Nghệ An', type: 'tỉnh', region: 'north', merged: false, merged_from: ['Nghệ An'], merged_from_codes: ['nghe-an'] },
  { code: 'ha-tinh', name: 'Hà Tĩnh', type: 'tỉnh', region: 'north', merged: false, merged_from: ['Hà Tĩnh'], merged_from_codes: ['ha-tinh'] },
  { code: 'lao-cai', name: 'Lào Cai', type: 'tỉnh', region: 'north', merged: true, merged_from: ['Lào Cai', 'Yên Bái'], merged_from_codes: ['lao-cai', 'yen-bai'] },
  { code: 'tuyen-quang', name: 'Tuyên Quang', type: 'tỉnh', region: 'north', merged: true, merged_from: ['Tuyên Quang', 'Hà Giang'], merged_from_codes: ['tuyen-quang', 'ha-giang'] },
  { code: 'thai-nguyen', name: 'Thái Nguyên', type: 'tỉnh', region: 'north', merged: true, merged_from: ['Thái Nguyên', 'Bắc Kạn'], merged_from_codes: ['thai-nguyen', 'bac-kan'] },
  { code: 'phu-tho', name: 'Phú Thọ', type: 'tỉnh', region: 'north', merged: true, merged_from: ['Phú Thọ', 'Vĩnh Phúc', 'Hòa Bình'], merged_from_codes: ['phu-tho', 'vinh-phuc', 'hoa-binh'] },
  { code: 'bac-ninh', name: 'Bắc Ninh', type: 'tỉnh', region: 'north', merged: true, merged_from: ['Bắc Ninh', 'Bắc Giang'], merged_from_codes: ['bac-ninh', 'bac-giang'] },
  { code: 'hung-yen', name: 'Hưng Yên', type: 'tỉnh', region: 'north', merged: true, merged_from: ['Hưng Yên', 'Thái Bình'], merged_from_codes: ['hung-yen', 'thai-binh'] },
  { code: 'hai-phong', name: 'Hải Phòng', type: 'thành phố trực thuộc trung ương', region: 'north', merged: true, merged_from: ['Hải Phòng', 'Hải Dương'], merged_from_codes: ['hai-phong', 'hai-duong'] },
  { code: 'ninh-binh', name: 'Ninh Bình', type: 'tỉnh', region: 'north', merged: true, merged_from: ['Ninh Bình', 'Nam Định', 'Hà Nam'], merged_from_codes: ['ninh-binh', 'nam-dinh', 'ha-nam'] },
  { code: 'quang-tri', name: 'Quảng Trị', type: 'tỉnh', region: 'central', merged: true, merged_from: ['Quảng Trị', 'Quảng Bình'], merged_from_codes: ['quang-tri', 'quang-binh'] },
  { code: 'da-nang', name: 'Đà Nẵng', type: 'thành phố trực thuộc trung ương', region: 'central', merged: true, merged_from: ['Đà Nẵng', 'Quảng Nam'], merged_from_codes: ['da-nang', 'quang-nam'] },
  { code: 'quang-ngai', name: 'Quảng Ngãi', type: 'tỉnh', region: 'central', merged: true, merged_from: ['Quảng Ngãi', 'Kon Tum'], merged_from_codes: ['quang-ngai', 'kon-tum'] },
  { code: 'gia-lai', name: 'Gia Lai', type: 'tỉnh', region: 'central', merged: true, merged_from: ['Gia Lai', 'Bình Định'], merged_from_codes: ['gia-lai', 'binh-dinh'] },
  { code: 'khanh-hoa', name: 'Khánh Hòa', type: 'tỉnh', region: 'central', merged: true, merged_from: ['Khánh Hòa', 'Ninh Thuận'], merged_from_codes: ['khanh-hoa', 'ninh-thuan'] },
  { code: 'lam-dong', name: 'Lâm Đồng', type: 'tỉnh', region: 'central', merged: true, merged_from: ['Lâm Đồng', 'Đắk Nông', 'Bình Thuận'], merged_from_codes: ['lam-dong', 'dak-nong', 'binh-thuan'] },
  { code: 'dak-lak', name: 'Đắk Lắk', type: 'tỉnh', region: 'central', merged: true, merged_from: ['Đắk Lắk', 'Phú Yên'], merged_from_codes: ['dak-lak', 'phu-yen'] },
  { code: 'tp-ho-chi-minh', name: 'TP. Hồ Chí Minh', type: 'thành phố trực thuộc trung ương', region: 'south', merged: true, merged_from: ['TP. Hồ Chí Minh', 'Bình Dương', 'Bà Rịa - Vũng Tàu'], merged_from_codes: ['tp-ho-chi-minh', 'binh-duong', 'ba-ria-vung-tau'] },
  { code: 'dong-nai', name: 'Đồng Nai', type: 'tỉnh', region: 'south', merged: true, merged_from: ['Đồng Nai', 'Bình Phước'], merged_from_codes: ['dong-nai', 'binh-phuoc'] },
  { code: 'tay-ninh', name: 'Tây Ninh', type: 'tỉnh', region: 'south', merged: true, merged_from: ['Tây Ninh', 'Long An'], merged_from_codes: ['tay-ninh', 'long-an'] },
  { code: 'can-tho', name: 'Cần Thơ', type: 'thành phố trực thuộc trung ương', region: 'south', merged: true, merged_from: ['Cần Thơ', 'Sóc Trăng', 'Hậu Giang'], merged_from_codes: ['can-tho', 'soc-trang', 'hau-giang'] },
  { code: 'vinh-long', name: 'Vĩnh Long', type: 'tỉnh', region: 'south', merged: true, merged_from: ['Vĩnh Long', 'Bến Tre', 'Trà Vinh'], merged_from_codes: ['vinh-long', 'ben-tre', 'tra-vinh'] },
  { code: 'dong-thap', name: 'Đồng Tháp', type: 'tỉnh', region: 'south', merged: true, merged_from: ['Đồng Tháp', 'Tiền Giang'], merged_from_codes: ['dong-thap', 'tien-giang'] },
  { code: 'ca-mau', name: 'Cà Mau', type: 'tỉnh', region: 'south', merged: true, merged_from: ['Cà Mau', 'Bạc Liêu'], merged_from_codes: ['ca-mau', 'bac-lieu'] },
  { code: 'an-giang', name: 'An Giang', type: 'tỉnh', region: 'south', merged: true, merged_from: ['An Giang', 'Kiên Giang'], merged_from_codes: ['an-giang', 'kien-giang'] },
];
