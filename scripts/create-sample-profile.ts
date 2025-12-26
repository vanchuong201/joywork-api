import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Creating sample profile data...\n');

  // Find a user with slug
  const user = await prisma.user.findFirst({
    where: {
      slug: { not: null },
      name: { not: null },
    },
    include: {
      profile: true,
    },
  });

  if (!user) {
    console.log('❌ No user found with slug');
    return;
  }

  console.log(`Found user: ${user.name} (${user.slug})\n`);

  // Create or update profile
  const profileData = {
    title: 'Full-stack Developer (React/Node.js)',
    headline: 'Experienced developer passionate about building great products',
    bio: 'Lập trình viên đam mê xây dựng các sản phẩm công nghệ có ảnh hưởng tích cực đến xã hội. Tôi tin rằng mã nguồn không chỉ là công cụ mà là nghệ thuật giải quyết vấn đề. Luôn tìm kiếm môi trường khuyến khích sự đổi mới và học tập liên tục.',
    location: 'Hồ Chí Minh, Việt Nam',
    status: 'OPEN_TO_WORK' as const,
    isPublic: true,
    visibility: {
      bio: true,
      experience: true,
      education: true,
      ksa: true,
      expectations: true,
    },
    knowledge: [
      'Kiến thức sâu về JavaScript (ES6+), TypeScript',
      'Hiểu biết về Web Performance & SEO',
      'Kiến thức về RESTful API & GraphQL',
      'System Design cơ bản',
    ],
    skills: ['React', 'Next.js', 'Tailwind CSS', 'Node.js', 'Express', 'PostgreSQL', 'Git', 'CI/CD'],
    attitude: [
      'Cầu tiến, ham học hỏi công nghệ mới',
      'Trách nhiệm cao trong công việc (Ownership)',
      'Tinh thần đồng đội & Chia sẻ kiến thức',
    ],
    expectedSalary: '$2000 - $2500',
    workMode: 'Hybrid hoặc Remote',
    expectedCulture: 'Môi trường cởi mở, minh bạch, tôn trọng sự khác biệt (D&I).',
    careerGoals: [
      'Trở thành Technical Lead trong 2 năm tới',
      'Phát triển sâu hơn về System Architecture',
    ],
  };

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: profileData,
    create: {
      userId: user.id,
      ...profileData,
    },
  });

  console.log('✅ Profile created/updated\n');

  // Create sample experience
  const existingExp = await prisma.userExperience.findFirst({
    where: { userId: user.id },
  });

  if (!existingExp) {
    await prisma.userExperience.create({
      data: {
        userId: user.id,
        role: 'Senior Frontend Developer',
        company: 'Innovate Tech',
        period: '2019 - Hiện tại',
        desc: 'Chịu trách nhiệm chính phát triển UI/UX cho nền tảng E-commerce với hơn 500k users.',
        achievements: [
          'Tối ưu hóa Core Web Vitals, tăng điểm Performance từ 60 lên 95.',
          'Xây dựng Design System dùng chung cho 3 dự án, giảm 30% thời gian development.',
        ],
        order: 0,
      },
    });
    console.log('✅ Sample experience created\n');
  }

  // Create sample education
  const existingEdu = await prisma.userEducation.findFirst({
    where: { userId: user.id },
  });

  if (!existingEdu) {
    await prisma.userEducation.create({
      data: {
        userId: user.id,
        school: 'Đại học Khoa học Tự nhiên',
        degree: 'Cử nhân Công nghệ thông tin',
        period: '2015 - 2019',
        order: 0,
      },
    });
    console.log('✅ Sample education created\n');
  }

  console.log(`✅ Sample data created for user: ${user.name} (${user.slug})`);
  console.log(`   Profile URL: /profile/${user.slug}`);
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

