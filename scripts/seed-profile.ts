import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const companyId = "cmhmecf1p002b6jud933zzp8m"; // Skyline Media (Demo Company)

  console.log(`Seeding FULL profile for company ${companyId}...`);

  const profileData = {
    // 1. Stats
    stats: [
      { value: "125%", label: "Tăng trưởng năm", trend: "+15%", icon: "TrendingUp" },
      { value: "500+", label: "Nhân sự toàn cầu", icon: "Users" },
      { value: "96%", label: "Tỷ lệ giữ chân", icon: "Heart" },
      { value: "15%", label: "Tăng lương/năm", icon: "Zap" },
      { value: "45/55", label: "Tỷ lệ Nam/Nữ", icon: "Users" },
      { value: "$2,500", label: "Thu nhập TB", icon: "DollarSign" },
    ],

    // 2. VMV
    vision: "Trở thành tập đoàn công nghệ số 1 khu vực, tiên phong kiến tạo hệ sinh thái số thông minh phục vụ 100 triệu người dùng.",
    mission: "Dùng công nghệ để giải quyết các bài toán xã hội, nâng cao chất lượng cuộc sống và tối ưu hóa năng suất lao động.",
    coreValues: "Tận Tâm - Khách hàng là trọng tâm\nSáng Tạo - Đổi mới không ngừng nghỉ\nChính Trực - Minh bạch trong mọi hành động\nHợp Tác - Sức mạnh của sự đoàn kết",

    // 3. Products
    products: [
      { name: 'TechCloud', icon: 'Zap' },
      { name: 'SmartAI', icon: 'Zap' },
      { name: 'FinSafe', icon: 'Zap' },
      { name: 'EduMate', icon: 'Zap' },
      { name: 'HealthLink', icon: 'Zap' },
      { name: 'AutoLog', icon: 'Zap' },
      { name: 'CyberShield', icon: 'Zap' },
      { name: 'GreenEnergy', icon: 'Zap' }
    ],

    // 4. Recruitment Principles
    recruitmentPrinciples: [
      { title: 'Thái Độ > Trình Độ', desc: 'Kỹ năng có thể đào tạo, nhưng thái độ và tư duy tích cực là tố chất sẵn có.', icon: 'Star' },
      { title: 'Phù Hợp Văn Hóa', desc: 'Tìm kiếm mảnh ghép phù hợp với giá trị cốt lõi và sứ mệnh của tổ chức.', icon: 'Heart' },
      { title: 'Minh Bạch Quy Trình', desc: 'Mọi ứng viên đều được tôn trọng và thông báo kết quả rõ ràng, nhanh chóng.', icon: 'ShieldCheck' },
      { title: 'Đa Dạng & Bao Trùm', desc: 'Tôn trọng sự khác biệt, không phân biệt giới tính, vùng miền hay xuất phát điểm.', icon: 'Globe' }
    ],

    // 5. Benefits
    benefits: {
      financial: [
        'Mức lương cạnh tranh Top thị trường (P75)',
        'Thưởng tháng 13 cam kết + Thưởng hiệu quả (2-6 tháng lương)',
        'Đánh giá tăng lương định kỳ 2 lần/năm',
        'Gói bảo hiểm sức khỏe Premium cho bản thân và gia đình',
        'Phụ cấp cơm trưa, xăng xe, điện thoại, trang phục'
      ],
      nonFinancial: [
        'Happy Hour thứ 6 hàng tuần, Teabreak mỗi ngày',
        'Company Trip & Team Building chuẩn 5 sao hàng năm',
        'CLB Thể thao (Bóng đá, Yoga, Running) có HLV riêng',
        'Khu vực Pantry, Gaming, Gym ngay tại văn phòng',
        'Chế độ nghỉ phép linh hoạt & Hybrid working'
      ]
    },

    // 6. HR Journey
    hrJourney: [
      { step: '01', title: 'Hội Nhập (Onboarding)', desc: '2 tuần đầu tiên: Tìm hiểu văn hóa, quy trình và nhận Mentor hướng dẫn 1-1.', color: 'bg-slate-700' },
      { step: '02', title: 'Thử Thách (Probation)', desc: '2 tháng thử việc: Tham gia dự án thực tế, thể hiện năng lực và tiềm năng.', color: 'bg-slate-800' },
      { step: '03', title: 'Phát Triển (Review)', desc: 'Định kỳ 6 tháng: Đánh giá hiệu suất (KPIs/OKRs) và hoạch định lộ trình thăng tiến.', color: 'bg-slate-900' }
    ],

    // 7. Career Path (Levels)
    careerPath: ['Fresher', 'Junior', 'Senior', 'Team Lead', 'Manager', 'Director'],

    // 8. Salary & Bonus
    salaryAndBonus: {
      salary: ['Lương cứng (Fixed)', 'Phụ cấp (Allowance)', 'Lương tháng 13', 'OT pay (nếu có)'],
      bonus: ['Thưởng dự án (Project)', 'Thưởng nóng (Spot)', 'Thưởng kinh doanh', 'ESOP (Cổ phần)']
    },

    // 9. Training
    training: {
      budget: '20.000.000 VNĐ',
      programs: [
        { title: 'Workshop Nội Bộ', desc: 'Chia sẻ kiến thức chuyên môn (Tech Talk) chiều thứ 6 hàng tuần từ các chuyên gia.' },
        { title: 'Hệ Thống Mentor', desc: 'Chương trình Buddy & Mentor 1-1 giúp định hướng phát triển nghề nghiệp rõ ràng.' },
        { title: 'Chứng Chỉ Quốc Tế', desc: 'Tài trợ 100% lệ phí thi các chứng chỉ AWS, Google, PMP, IELTS...' }
      ]
    },

    // 10. Leaders
    leaders: [
      { 
        name: 'Nguyễn Văn Hùng', 
        role: 'Chủ tịch HĐQT (Founder & Chairman)', 
        image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=400', 
        message: 'Chúng tôi không chỉ xây dựng sản phẩm, chúng tôi kiến tạo di sản.',
      },
      { 
        name: 'Trần Thu Hà', 
        role: 'Tổng Giám Đốc (CEO)', 
        image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400', 
        message: 'Con người là tài sản vô giá và là trung tâm của mọi sự phát triển.',
      },
      { 
        name: 'Lê Minh Tuấn', 
        role: 'Giám đốc Công nghệ (CTO)', 
        image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=400', 
        message: 'Đổi mới sáng tạo là DNA của TechCorp.',
      }
    ],

    // 11. Typical Day
    culture: {
        typicalDay: [
            { time: '08:30', title: 'Khởi động', desc: 'Check-in & Coffee sáng', icon: 'Coffee' },
            { time: '09:00', title: 'Đồng bộ', desc: 'Daily Standup Meeting', icon: 'Users' },
            { time: '12:00', title: 'Tái tạo', desc: 'Ăn trưa & Nghỉ ngơi', icon: 'Heart' },
            { time: '16:00', title: 'Tập trung', desc: 'Deep Work / Focus Time', icon: 'Zap' }
        ],
        testimonials: [
            { name: 'Mai Phương Anh', role: 'Senior Developer', quote: 'Môi trường làm việc đẳng cấp, sếp luôn lắng nghe và trao quyền cho nhân viên.', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200' },
            { name: 'Nguyễn Quốc Bảo', role: 'Product Manager', quote: 'Lộ trình thăng tiến cực kỳ rõ ràng, văn hóa đào tạo bài bản chuẩn quốc tế.', image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=200' },
            { name: 'Lê Hương Ly', role: 'UI/UX Designer', quote: 'TechCorp giống như ngôi nhà thứ hai, nơi sự sáng tạo không bao giờ bị giới hạn.', image: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&q=80&w=200' },
        ]
    },

    // 12. Awards
    awards: [
        { year: '2023', name: 'Nơi làm việc tốt nhất Châu Á', org: 'HR Asia Award' },
        { year: '2022', name: 'Sao Khuê 5 Sao (Phần mềm)', org: 'VINASA' },
        { year: '2021', name: 'Top 50 Doanh Nghiệp CNTT', org: 'VNR500' },
        { year: '2020', name: 'Sản phẩm đổi mới sáng tạo', org: 'Better Choice Award' }
    ],

    // 13. Story & Milestones
    story: {
        founderStory: {
            title: '"Từ Garage Nhỏ Đến Giấc Mơ Toàn Cầu"',
            content: 'Vào một ngày mưa năm 2015, ba kỹ sư trẻ ngồi lại với nhau tại một căn phòng trọ nhỏ ở Sài Gòn. Họ trăn trở về việc làm sao để sản phẩm công nghệ Việt Nam có thể cạnh tranh sòng phẳng trên bản đồ thế giới.\n\nVới số vốn ít ỏi nhưng hoài bão lớn, TechCorp ra đời. Chúng tôi không chỉ xây dựng doanh nghiệp, chúng tôi xây dựng một cộng đồng những người dám nghĩ, dám làm và dám thất bại. Tinh thần "Never Give Up" (Không bao giờ bỏ cuộc) đã trở thành kim chỉ nam cho mọi hành động của TechCorp cho đến ngày hôm nay.',
            founder: 'Nguyễn Văn Hùng - Founder',
            image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80&w=800'
        },
        milestones: [
            { year: '2015', title: 'Thành Lập', desc: 'Khởi đầu hành trình từ garage nhỏ với 5 kỹ sư tâm huyết.' },
            { year: '2018', title: 'Vươn Ra Biển Lớn', desc: 'Khai trương văn phòng đại diện tại Singapore và Tokyo.' },
            { year: '2020', title: 'Vòng Vốn Series B', desc: 'Huy động thành công 20 triệu USD từ các quỹ đầu tư uy tín.' },
            { year: '2023', title: 'Top 10 Sao Khuê', desc: 'Vinh danh Top 10 Doanh nghiệp Công nghệ xuất sắc nhất.' },
        ]
    }
  };

  // Check if company exists first
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
      console.error(`Company ${companyId} not found!`);
      return;
  }

  await prisma.companyProfile.upsert({
    where: { companyId },
    create: {
      companyId,
      ...profileData
    },
    update: {
      ...profileData
    }
  });

  console.log("Seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
