import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const companyId = 'cmhmecf1p002b6jud933zzp8m';

  const profileData = {
    // Section: NHỮNG CON SỐ BIẾT NÓI
    stats: {
      items: [
        { value: '125%', label: 'Tăng trưởng năm' },
        { value: '+15%', label: 'So với năm trước' },
        { value: '500+', label: 'Nhân sự toàn cầu' },
        { value: '96%', label: 'Tỷ lệ giữ chân' },
        { value: '15%', label: 'Tăng lương trung bình mỗi năm' },
        { value: '45/55', label: 'Tỷ lệ Nam/Nữ' },
      ],
    },

    // Section: TẦM NHÌN – SỨ MỆNH – GIÁ TRỊ CỐT LÕI
    vision:
      'Trở thành tập đoàn công nghệ số 1 khu vực, tiên phong kiến tạo hệ sinh thái số thông minh phục vụ 100 triệu người dùng.',
    mission:
      'Dùng công nghệ để giải quyết các bài toán xã hội, nâng cao chất lượng cuộc sống và tối ưu hóa năng suất lao động.',
    coreValues:
      'Tận tâm với khách hàng; Sáng tạo không ngừng; Chính trực; Hợp tác; Trách nhiệm với cộng đồng.',

    // Section: HỆ SINH THÁI SẢN PHẨM
    products: {
      items: ['TechCloud', 'SmartAI', 'FinSafe', 'EduMate', 'HealthLink', 'AutoLog', 'CyberShield', 'GreenEnergy'],
    },

    // Section: NGUYÊN TẮC TUYỂN DỤNG
    recruitmentPrinciples: {
      items: [
        {
          title: 'Thái Độ > Trình Độ',
          description: 'Kỹ năng có thể đào tạo, nhưng thái độ và tư duy tích cực là tố chất sẵn có.',
        },
        {
          title: 'Phù Hợp Văn Hóa',
          description: 'Tìm kiếm mảnh ghép phù hợp với giá trị cốt lõi và sứ mệnh.',
        },
        {
          title: 'Minh Bạch Quy Trình',
          description: 'Mọi ứng viên đều được tôn trọng và thông báo kết quả rõ ràng, nhanh chóng.',
        },
        {
          title: 'Đa Dạng & Bao Trùm',
          description: 'Không phân biệt giới tính, vùng miền hay xuất phát điểm.',
        },
      ],
    },

    // Section: PHÚC LỢI TOÀN DIỆN
    benefits: {
      financial: [
        'Mức lương cạnh tranh Top thị trường (P75)',
        'Thưởng tháng 13 + Thưởng hiệu quả (2–6 tháng lương)',
        'Đánh giá tăng lương định kỳ 2 lần/năm',
        'Gói bảo hiểm sức khỏe Premium cho bản thân và gia đình',
        'Phụ cấp cơm trưa, xăng xe, điện thoại, trang phục',
      ],
      nonFinancial: [
        'Happy Hour thứ 6 hàng tuần, Teabreak mỗi ngày',
        'Company Trip & Team Building chuẩn 5 sao hàng năm',
        'CLB Thể thao (Bóng đá, Yoga, Running) có HLV riêng',
        'Pantry, Gaming, Gym ngay tại văn phòng',
        'Chế độ nghỉ phép linh hoạt & Hybrid working',
      ],
    },

    // Section: HÀNH TRÌNH NHÂN SỰ
    hrJourney: {
      steps: [
        {
          stepLabel: '01',
          title: 'Hội Nhập (Onboarding)',
          description: '2 tuần đầu: tìm hiểu văn hóa, quy trình và nhận Mentor hướng dẫn 1-1.',
        },
        {
          stepLabel: '02',
          title: 'Thử Thách (Probation)',
          description: '2 tháng thử việc: tham gia dự án thực tế, thể hiện năng lực.',
        },
        {
          stepLabel: '03',
          title: 'Phát Triển (Review)',
          description: 'Định kỳ 6 tháng: đánh giá hiệu suất và hoạch định lộ trình thăng tiến.',
        },
      ],
    },

    // Section: LỘ TRÌNH THĂNG TIẾN
    careerPath: {
      levels: [
        { label: 'Fresher', levelLabel: 'Level 1' },
        { label: 'Junior', levelLabel: 'Level 2' },
        { label: 'Senior', levelLabel: 'Level 3' },
        { label: 'Team Lead', levelLabel: 'Level 4' },
        { label: 'Manager', levelLabel: 'Level 5' },
        { label: 'Director', levelLabel: 'Level 6' },
      ],
    },

    // Section: CƠ CHẾ LƯƠNG
    salaryMechanism: {
      items: ['Lương cứng (Fixed)', 'Phụ cấp (Allowance)', 'Lương tháng 13', 'OT pay (nếu có)'],
    },

    // Section: HỆ THỐNG THƯỞNG
    bonusSystem: {
      items: ['Thưởng dự án (Project)', 'Thưởng nóng (Spot)', 'Thưởng kinh doanh', 'ESOP (Cổ phần)'],
    },

    // Section: VĂN HÓA HỌC TẬP / ĐÀO TẠO
    learningAndDevelopment: {
      body:
        'Tại TechCorp, việc học chưa bao giờ dừng lại. Chúng tôi cung cấp tài khoản Udemy, Coursera Business không giới hạn và thư viện sách chuyên ngành phong phú.',
      highlights: [
        'Ngân sách đào tạo riêng cho từng nhân sự',
        'Hỗ trợ 100% lệ phí thi chứng chỉ quốc tế',
      ],
    },

    // Section: CHƯƠNG TRÌNH ĐÀO TẠO CHUYÊN SÂU
    trainingPrograms: {
      items: [
        {
          title: 'Workshop Nội Bộ',
          description: 'Tech Talk chiều thứ 6 hàng tuần từ các chuyên gia nội bộ.',
        },
        {
          title: 'Hệ Thống Mentor',
          description: 'Chương trình Buddy & Mentor 1-1 định hướng nghề nghiệp.',
        },
        {
          title: 'Chứng Chỉ Quốc Tế',
          description: 'Tài trợ 100% lệ phí thi các chứng chỉ AWS, Google, PMP, IELTS...',
        },
      ],
    },

    // Section: MỘT NGÀY TẠI CÔNG TY
    typicalDay: {
      slots: [
        { time: '08:30', title: 'Khởi động', description: 'Check-in & Coffee sáng.' },
        { time: '09:00', title: 'Đồng bộ', description: 'Daily Standup Meeting.' },
        { time: '12:00', title: 'Tái tạo', description: 'Ăn trưa & Nghỉ ngơi.' },
        { time: '16:00', title: 'Tập trung', description: 'Deep Work / Focus Time.' },
      ],
    },

    // Section: GIẢI THƯỞNG & VINH DANH
    awards: {
      items: [
        { year: '2023', name: 'Nơi làm việc tốt nhất Châu Á', organization: 'HR Asia Award' },
        { year: '2022', name: 'Sao Khuê 5 Sao (Phần mềm)', organization: 'VINASA' },
        { year: '2021', name: 'Top 50 Doanh Nghiệp CNTT', organization: 'VNR500' },
        { year: '2020', name: 'Sản phẩm đổi mới sáng tạo', organization: 'Better Choice Award' },
      ],
    },

    // Section: CÂU CHUYỆN KHỞI NGUỒN
    founderStory:
      'Vào một ngày mưa năm 2015, ba kỹ sư trẻ ngồi lại với nhau tại một căn phòng trọ nhỏ ở Sài Gòn. Họ trăn trở về việc làm sao để sản phẩm công nghệ Việt Nam có thể cạnh tranh sòng phẳng trên bản đồ thế giới...',

    // Section: CỘT MỐC PHÁT TRIỂN
    milestones: {
      items: [
        {
          year: '2015',
          title: 'Thành Lập',
          description: 'Khởi đầu hành trình từ garage nhỏ với 5 kỹ sư tâm huyết.',
        },
        {
          year: '2018',
          title: 'Vươn Ra Biển Lớn',
          description: 'Mở văn phòng đại diện tại Singapore và Tokyo.',
        },
        {
          year: '2020',
          title: 'Vòng Vốn Series B',
          description: 'Huy động thành công 20 triệu USD từ các quỹ đầu tư uy tín.',
        },
        {
          year: '2023',
          title: 'Top 10 Sao Khuê',
          description: 'Vinh danh Top 10 Doanh nghiệp Công nghệ xuất sắc nhất.',
        },
      ],
    },
  };

  await prisma.companyProfile.upsert({
    where: { companyId },
    update: {
      ...profileData,
    },
    create: {
      companyId,
      ...profileData,
    },
  });

  // eslint-disable-next-line no-console
  console.log('Seeded company profile for companyId:', companyId);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



