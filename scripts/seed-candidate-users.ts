/**
 * Tạo 100 tài khoản ứng viên (USER) với hồ sơ, kinh nghiệm và học vấn đa dạng — phục vụ demo/staging.
 *
 * Chạy: npx tsx scripts/seed-candidate-users.ts
 * Yêu cầu: DATABASE_URL trong .env
 *
 * Email: bulk-candidate-001 … bulk-candidate-100 @ joywork-seed.local
 * Mật khẩu mặc định (tất cả): CandidateSeed123!
 *
 * Chạy lại: xóa các user có email khớp prefix SEED_EMAIL_PREFIX rồi tạo lại (idempotent theo prefix).
 */

import 'dotenv/config';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SEED_EMAIL_PREFIX = 'bulk-candidate-';
const SEED_EMAIL_DOMAIN = '@joywork-seed.local';
const DEFAULT_PASSWORD = 'CandidateSeed123!';

const COUNT = 100;

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sample<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sampleMany<T>(arr: readonly T[], min: number, max: number): T[] {
  const n = randInt(min, max);
  const copy = [...arr].sort(() => Math.random() - 0.5);
  return copy.slice(0, Math.min(n, copy.length));
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items)];
}

function slugifyVi(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base || 'candidate';
  let counter = 0;
  while (true) {
    const existing = await prisma.user.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
    counter += 1;
    slug = `${base}-${counter}`;
  }
}

const ho = [
  'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Dương', 'Lý',
];
const dem = ['Văn', 'Thị', 'Đức', 'Minh', 'Thu', 'Hữu', 'Kim', 'Ngọc', 'Thanh', 'Quốc', 'Tuấn', 'Hải', ''];
const ten = [
  'Anh', 'Bình', 'Chi', 'Dũng', 'Dương', 'Giang', 'Hà', 'Hiếu', 'Hòa', 'Hùng', 'Huy', 'Khánh', 'Khoa',
  'Lan', 'Linh', 'Long', 'Ly', 'Mai', 'Minh', 'My', 'Nam', 'Ngân', 'Nga', 'Nhi', 'Phong', 'Phúc', 'Phương',
  'Quang', 'Quân', 'Sơn', 'Tài', 'Tâm', 'Thảo', 'Thịnh', 'Thu', 'Trang', 'Trung', 'Tú', 'Tuyết', 'Uyên',
  'Việt', 'Vũ', 'Yến', 'Đạt', 'Đông',
];

const verticals = [
  {
    headline: 'Senior Backend Engineer',
    title: 'Kỹ sư phần mềm Backend',
    skills: ['Node.js', 'TypeScript', 'PostgreSQL', 'Redis', 'Docker', 'REST API', 'Prisma'],
    knowledge: ['Kiến trúc microservices', 'Bảo mật API & OAuth2', 'Tối ưu truy vấn SQL'],
    bio: 'Kinh nghiệm xây dựng API hiệu năng cao, ưu tiên code sạch và quan sát được (observability).',
  },
  {
    headline: 'Frontend Developer (React)',
    title: 'Lập trình viên Frontend',
    skills: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'Zustand', 'React Query', 'Jest'],
    knowledge: ['Tối ưu Core Web Vitals', 'A11y cơ bản', 'Design system'],
    bio: 'Thích làm sản phẩm web mượt, giao diện nhất quán và trải nghiệm người dùng tốt.',
  },
  {
    headline: 'Full-stack Developer',
    title: 'Lập trình viên Full-stack',
    skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'AWS EC2', 'Git'],
    knowledge: ['End-to-end feature delivery', 'CI/CD cơ bản', 'Schema-first API'],
    bio: 'Làm trọn vẹn từ UI đến API, phối hợp chặt với team sản phẩm và QA.',
  },
  {
    headline: 'DevOps / Platform Engineer',
    title: 'Kỹ sư DevOps',
    skills: ['Kubernetes', 'Docker', 'Terraform', 'GitHub Actions', 'Prometheus', 'Linux', 'AWS'],
    knowledge: ['GitOps', 'Hạ tầng dạng mã (IaC)', 'SRE practices'],
    bio: 'Tập trung tự động hóa triển khai, giám sát và khôi phục sự cố nhanh.',
  },
  {
    headline: 'QA Engineer',
    title: 'Kỹ sư kiểm thử phần mềm',
    skills: ['Cypress', 'Playwright', 'Jest', 'Test plan', 'API testing', 'Postman', 'Jira'],
    knowledge: ['Chiến lược kiểm thử hồi quy', 'Shift-left testing', 'Báo cáo bug rõ ràng'],
    bio: 'Đảm bảo chất lượng bằng kiểm thử có hệ thống và góp ý cải tiến quy trình.',
  },
  {
    headline: 'UI/UX Designer',
    title: 'Nhà thiết kế UI/UX',
    skills: ['Figma', 'User research', 'Wireframe', 'Prototyping', 'Design system', 'HTML/CSS'],
    knowledge: ['Usability heuristic', 'Design handoff', 'A/B test cơ bản'],
    bio: 'Ưu tiên giải bài toán người dùng trước khi đẹp; làm việc gần với dev và PM.',
  },
  {
    headline: 'Data Analyst',
    title: 'Chuyên viên phân tích dữ liệu',
    skills: ['SQL', 'Python', 'pandas', 'Looker Studio', 'Excel', 'Statistics'],
    knowledge: ['Dashboard KPI', 'Làm sạch dữ liệu', 'Trực quan hóa'],
    bio: 'Biến dữ liệu thành insight hành động cho kinh doanh và vận hành.',
  },
  {
    headline: 'Product Manager',
    title: 'Quản lý sản phẩm',
    skills: ['Roadmap', 'User story', 'Prioritization', 'Analytics', 'Stakeholder management', 'Agile'],
    knowledge: ['Discovery & delivery', 'OKR', 'Phân tích funnel'],
    bio: 'Kết nối nhu cầu người dùng với đội kỹ thuật, đẩy giá trị sản phẩm theo lộ trình rõ ràng.',
  },
  {
    headline: 'Mobile Developer (Flutter)',
    title: 'Lập trình viên ứng dụng di động',
    skills: ['Flutter', 'Dart', 'REST API', 'Firebase', 'Bloc', 'CI cho mobile'],
    knowledge: ['App store release', 'Performance trên thiết bị yếu', 'Offline-first cơ bản'],
    bio: 'Phát triển app ổn định trên đa nền tảng, quan tâm UX và tiêu thụ pin.',
  },
  {
    headline: 'Business Analyst',
    title: 'Chuyên viên phân tích nghiệp vụ',
    skills: ['Requirements', 'UML', 'SQL', 'Workshop', 'Documentation', 'Jira', 'Process mapping'],
    knowledge: ['Thu thập nghiệp vụ', 'User story & acceptance criteria', 'Gap analysis'],
    bio: 'Làm cầu nối giữa bộ phận kinh doanh và IT, làm rõ phạm vi và ưu tiên.',
  },
] as const;

const attitudes = [
  'Chủ động giao tiếp, cập nhật tiến độ minh bạch.',
  'Sẵn sàng nhận phản hồi và cải tiến liên tục.',
  'Làm việc theo dữ liệu và giả thuyết có kiểm chứng.',
  'Tôn trọng deadline, ưu tiên giá trị giao hàng (delivery).',
  'Hợp tác đa chức năng, empathy với người dùng và đồng nghiệp.',
  'Tư duy sở hữu sản phẩm (ownership), không chỉ “xong ticket”.',
  'Cẩn trọng với bảo mật và quyền riêng tư dữ liệu.',
  'Ham học công nghệ mới nhưng cân nhắc chi phí bảo trì.',
];

const careerGoalPool = [
  'Trở thành Tech Lead trong 2–3 năm, xây dựng văn hóa code review tốt.',
  'Mở rộng sang kiến trúc hệ thống và mentoring cho junior.',
  'Chuyên sâu về AI/ML ứng dụng trong sản phẩm thực tế.',
  'Gắn bó startup tăng trưởng nhanh, chịu được áp lực và thay đổi.',
  'Làm việc trong môi trường product-led, ra quyết định dựa metric.',
  'Phát triển kỹ năng tiếng Anh chuyên ngành và thuyết trình.',
  'Tham gia cộng đồng open source và chia sẻ kỹ thuật.',
  'Cân bằng remote/hybrid, duy trì năng suất bền vững.',
];

const companies = [
  'VNG Corporation', 'FPT Software', 'CMC Global', 'MISA', 'KMS Technology', 'Nashtech',
  'Tiki', 'Shopee', 'MoMo', 'Techcombank Digital', 'VPBank IT', 'Viettel Solutions',
  'Base.vn', 'Got It', 'Sky Mavis', 'Be Group', 'Sendo', 'GHN', 'Ahamove',
  'Samsung SDS', 'LG CNS Vietnam', ' Bosch Vietnam', 'Unilever IT', 'Nokia Bell Labs',
];

const schools = [
  'ĐHQG Hà Nội — ĐH Công nghệ (VNU-UET)',
  'ĐH Bách khoa Hà Nội',
  'ĐH Bách khoa TP.HCM',
  'ĐH Công nghệ — ĐHQG TP.HCM',
  'ĐH FPT',
  'ĐH RMIT Việt Nam',
  'ĐH Kinh tế Quốc dân',
  'ĐH Ngoại thương',
];

const degrees = [
  'Cử nhân Công nghệ Thông tin',
  'Kỹ sư Phần mềm',
  'Cử nhân Khoa học Máy tính',
  'Thạc sĩ CNTT',
  'Cử nhân Thiết kế Đồ họa',
  'Cử nhân Quản trị Kinh doanh (chuyên Digital)',
];

const locationSets: { locations: string[]; wardCodes: string[] }[] = [
  { locations: ['Hà Nội'], wardCodes: ['ha-noi/00004'] },
  { locations: ['TP. Hồ Chí Minh'], wardCodes: ['ho-chi-minh/00001'] },
  { locations: ['Đà Nẵng'], wardCodes: ['da-nang/00001'] },
  { locations: ['Hà Nội', 'Remote'], wardCodes: ['ha-noi/00004'] },
  { locations: ['TP. Hồ Chí Minh'], wardCodes: ['ho-chi-minh/00256'] },
  { locations: ['Cần Thơ'], wardCodes: [] },
  { locations: ['Hải Phòng'], wardCodes: [] },
  { locations: ['Bình Dương'], wardCodes: [] },
];

const workModes = ['Remote', 'Hybrid', 'On-site', 'Hybrid — 2 ngày/tuần tại văn phòng'];
const userStatuses = [UserStatus.OPEN_TO_WORK, UserStatus.LOOKING, UserStatus.NOT_AVAILABLE];

function buildFullName(i: number) {
  const h = sample(ho);
  const d = sample(dem);
  const t = sample(ten);
  const mid = d ? `${d} ` : '';
  return `${h} ${mid}${t}`.replace(/\s+/g, ' ').trim();
}

function buildExperiences(userId: string, vertical: (typeof verticals)[number], count: number) {
  const exp = [];
  let cursorEnd = new Date(2026, randInt(0, 3), 1);
  for (let e = 0; e < count; e++) {
    const spanYears = randInt(1, 3);
    const endDate = new Date(cursorEnd);
    const startDate = new Date(endDate);
    startDate.setFullYear(startDate.getFullYear() - spanYears);
    const isCurrent = e === 0 && Math.random() < 0.35;
    cursorEnd = new Date(startDate);
    cursorEnd.setMonth(cursorEnd.getMonth() - randInt(1, 3));

    exp.push({
      userId,
      role:
        e === 0
          ? vertical.headline
          : sample([`Senior ${vertical.title}`, `Middle ${vertical.title}`, `Junior ${vertical.title}`]),
      company: sample(companies),
      startDate,
      endDate: isCurrent ? null : endDate,
      period: isCurrent
        ? `${startDate.getFullYear()} — Hiện tại`
        : `${startDate.getFullYear()} — ${endDate.getFullYear()}`,
      desc: 'Tham gia phát triển tính năng cốt lõi, phối hợp đa team. Trọng tâm: chất lượng, hiệu năng và tài liệu kỹ thuật.',
      achievements: uniqueStrings([
        sample(['Giảm latency API ~30%', 'Tăng độ phủ test E2E', 'Refactor module legacy', 'Triển khai CI pipeline']),
        sample(['Mentor 1–2 junior', 'Áp dụng code review nghiêm ngặt', 'Hỗ trợ on-call rotation']),
      ]),
      order: e,
    });
  }
  return exp;
}

function buildEducations(userId: string, count: number) {
  const ed = [];
  const endYear = randInt(2016, 2024);
  for (let k = 0; k < count; k++) {
    const span = randInt(3, 4);
    const endDate = new Date(endYear - k * 5, 6, 1);
    const startDate = new Date(endDate);
    startDate.setFullYear(startDate.getFullYear() - span);
    ed.push({
      userId,
      school: sample(schools),
      degree: sample(degrees),
      startDate,
      endDate,
      period: `${startDate.getFullYear()} — ${endDate.getFullYear()}`,
      gpa: Math.random() < 0.6 ? `${(randInt(28, 35) / 10).toFixed(1)}/4.0` : null,
      honors: Math.random() < 0.25 ? 'Giải nhì kỳ thực tập / Đồ án xuất sắc' : null,
      order: k,
    });
  }
  return ed;
}

async function main() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  const deleted = await prisma.user.deleteMany({
    where: {
      email: {
        startsWith: SEED_EMAIL_PREFIX,
        endsWith: SEED_EMAIL_DOMAIN,
      },
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Đã xóa ${deleted.count} user seed cũ (nếu có). Tạo ${COUNT} ứng viên mới…`);

  for (let i = 0; i < COUNT; i++) {
    const n = String(i + 1).padStart(3, '0');
    const email = `${SEED_EMAIL_PREFIX}${n}${SEED_EMAIL_DOMAIN}`;
    const vertical = verticals[i % verticals.length];
    const fullName = buildFullName(i);
    const name = fullName;
    const loc = locationSets[i % locationSets.length];

    const extraSkills = sampleMany(
      ['English B2', 'Agile/Scrum', 'Documentation', 'Public speaking', 'Mentoring', 'GraphQL', 'Kafka', 'Elasticsearch'],
      0,
      3,
    );
    const skills = uniqueStrings([...vertical.skills, ...extraSkills]).slice(0, randInt(6, 12));

    const knowledge = uniqueStrings([
      ...vertical.knowledge,
      ...sampleMany(
        ['Domain-driven design', 'Event-driven', 'Observability', 'Product thinking', 'Security baseline'],
        0,
        2,
      ),
    ]);

    const attitude = sampleMany(attitudes, 2, 4);
    const careerGoals = sampleMany(careerGoalPool, 1, 3);

    const salaryMin = randInt(12, 45) * 1_000_000;
    const salaryMax = salaryMin + randInt(5, 35) * 1_000_000;

    const bio = vertical.bio;

    const baseSlug = await ensureUniqueSlug(`${slugifyVi(fullName)}-${n}`);

    const user = await prisma.user.create({
      data: {
        email,
        password: passwordHash,
        role: UserRole.USER,
        name,
        slug: baseSlug,
        phone: `0${[3, 5, 7, 8, 9][randInt(0, 4)]}${String(randInt(0, 99_999_999)).padStart(8, '0')}`,
        emailVerified: true,
        profile: {
          create: {
            fullName,
            headline: vertical.headline,
            title: vertical.title,
            bio,
            skills,
            knowledge,
            attitude,
            careerGoals,
            locations: loc.locations,
            wardCodes: loc.wardCodes,
            avatar: `https://i.pravatar.cc/200?u=${encodeURIComponent(email)}`,
            status: sample(userStatuses),
            isSearchingJob: Math.random() < 0.85,
            isPublic: Math.random() < 0.9,
            allowCvFlip: Math.random() < 0.75,
            contactEmail: email,
            contactPhone: `+84${randInt(3, 9)}${String(randInt(0, 99_999_999)).padStart(8, '0')}`,
            linkedin: Math.random() < 0.7 ? `https://linkedin.com/in/${baseSlug}` : null,
            github: Math.random() < 0.65 ? `https://github.com/${baseSlug}` : null,
            website: Math.random() < 0.4 ? `https://portfolio.example.dev/${baseSlug}` : null,
            expectedSalaryMin: salaryMin,
            expectedSalaryMax: salaryMax,
            salaryCurrency: 'VND',
            workMode: sample(workModes),
            expectedCulture: sample([
              'Môi trường cởi mở, feedback hai chiều.',
              'Tôn trọng work-life balance, kết quả quan trọng hơn giờ ngồi máy.',
              'Được học và thử nghiệm công nghệ mới trong giới hạn an toàn.',
              'Lộ trình thăng tiến minh bạch, đánh giá định kỳ rõ ràng.',
            ]),
            visibility: {
              bio: true,
              experience: true,
              education: true,
              ksa: true,
              expectations: Math.random() < 0.85,
            },
          },
        },
      },
      select: { id: true },
    });

    const expCount = randInt(1, 3);
    const eduCount = randInt(1, 2);

    await prisma.userExperience.createMany({
      data: buildExperiences(user.id, vertical, expCount),
    });
    await prisma.userEducation.createMany({
      data: buildEducations(user.id, eduCount),
    });

    if ((i + 1) % 25 === 0) {
      // eslint-disable-next-line no-console
      console.log(`  … ${i + 1}/${COUNT}`);
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Hoàn tất. Đăng nhập bằng ${SEED_EMAIL_PREFIX}001${SEED_EMAIL_DOMAIN} … (mật khẩu: ${DEFAULT_PASSWORD})`);
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
