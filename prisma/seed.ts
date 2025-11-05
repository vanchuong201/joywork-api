import { PrismaClient, UserRole, CompanyMemberRole, PostType, PostVisibility, EmploymentType, ExperienceLevel, ApplicationStatus, MessageType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sample<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function uniqueBy<T>(arr: T[], key: (x: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of arr) {
    const k = key(it);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(it);
    }
  }
  return out;
}

async function main() {
  console.log("Seeding database...");

  // Wipe existing data (order matters due to FKs)
  await prisma.$transaction([
    prisma.message.deleteMany({}),
    prisma.application.deleteMany({}),
    prisma.like.deleteMany({}),
    prisma.follow.deleteMany({}),
    prisma.job.deleteMany({}),
    prisma.post.deleteMany({}),
    prisma.companyMember.deleteMany({}),
    prisma.company.deleteMany({}),
    prisma.userProfile.deleteMany({}),
    prisma.user.deleteMany({}),
  ]);

  const industries = [
    "Technology",
    "Finance",
    "Healthcare",
    "Education",
    "E-commerce",
    "Manufacturing",
    "Media",
    "Logistics",
  ];
  const locations = ["Hanoi", "Ho Chi Minh", "Da Nang", "Remote", "Hybrid HN", "Hybrid HCM"];
  const companySizes = ["STARTUP", "SMALL", "MEDIUM", "LARGE", "ENTERPRISE"] as const;
  const employmentTypes = Object.values(EmploymentType);
  const experienceLevels = Object.values(ExperienceLevel);

  // Create users
  const passwordHash = await bcrypt.hash("password123", 10);
  const users = [] as { id: string; email: string }[];
  // Named test accounts
  const namedUsers = [
    { email: "admin@joywork.dev", role: UserRole.ADMIN, name: "System Admin" },
    { email: "owner@joywork.dev", role: UserRole.USER, name: "Owner User" },
    { email: "candidate@joywork.dev", role: UserRole.USER, name: "Candidate User" },
  ];
  for (const nu of namedUsers) {
    const u = await prisma.user.create({
      data: {
        email: nu.email,
        password: passwordHash,
        role: nu.role,
        name: nu.name,
        profile: {
          create: {
            avatar: `https://i.pravatar.cc/150?u=${nu.email}`,
            headline: sample(["Software Engineer", "Product Manager", "Designer", "Data Analyst"]),
            bio: "This is a sample user for testing UI.",
            skills: ["TypeScript", "React", "Node.js", "SQL"].slice(0, randInt(1, 4)),
            location: sample(locations),
            website: "https://joywork.dev",
            github: "https://github.com/joywork",
            linkedin: "https://linkedin.com/company/joywork",
          },
        },
      },
      select: { id: true, email: true },
    });
    users.push(u);
  }
  // Random users
  const firstNames = ["Minh", "Anh", "Trang", "Tuan", "Linh", "Quang", "Huy", "Lan", "Nam", "Phuong", "Khanh", "Duc", "Hoa", "Thao", "Son", "Thinh"];
  const lastNames = ["Nguyen", "Tran", "Le", "Pham", "Hoang", "Phan", "Vu", "Vo", "Dang", "Bui", "Do"];
  for (let i = 0; i < 35; i++) {
    const name = `${sample(firstNames)} ${sample(lastNames)}`;
    const email = `user${i + 1}@example.com`;
    const u = await prisma.user.create({
      data: {
        email,
        password: passwordHash,
        role: UserRole.USER,
        name,
        profile: {
          create: {
            avatar: `https://i.pravatar.cc/150?u=${email}`,
            headline: sample(["Frontend Engineer", "Backend Engineer", "QA Engineer", "HR Specialist", "Marketing Executive", "Operations"]),
            bio: "Sample candidate profile.",
            skills: uniqueBy(["React", "Next.js", "NestJS", "PostgreSQL", "Prisma", "AWS", "K8s", "Figma", "Storybook", "Cypress"].sort(() => 0.5 - Math.random()).slice(0, randInt(2, 6)), (x) => x),
            location: sample(locations),
            website: `https://portfolio.example.com/${i + 1}`,
            github: i % 3 === 0 ? `https://github.com/user${i + 1}` : null,
            linkedin: `https://linkedin.com/in/user${i + 1}`,
          },
        },
      },
      select: { id: true, email: true },
    });
    users.push(u);
  }

  // Create companies
  const companies: { id: string; slug: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const name = sample([
      "Global Tech Solutions",
      "Future Finance Partners",
      "Innovate Pharma",
      "Urban Development Group",
      "Skyline Media",
      "Green Logistics",
      "Sunrise Education",
      "Blue Ocean E-commerce",
      "Prime Manufacturing",
      "Atlas Healthcare",
      "Pioneer Software",
      "Nova Analytics",
    ]);
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${i + 1}`;
    const c = await prisma.company.create({
      data: {
        name,
        slug,
        tagline: sample(["Build the future.", "Engineering impact.", "Human first.", "Make work joyful."]),
        description: "Sample company description to test layout and truncation in UI.",
        logoUrl: `https://picsum.photos/seed/${slug}/120/120`,
        coverUrl: `https://picsum.photos/seed/${slug}-cover/1200/675`,
        website: `https://www.${slug}.com`,
        location: sample(locations),
        industry: sample(industries),
        size: sample(companySizes) as any,
        foundedYear: 2000 + randInt(0, 24),
        isVerified: Math.random() < 0.35,
      },
      select: { id: true, slug: true },
    });
    companies.push(c);
  }

  // Assign members (OWNER/ADMIN/MEMBER)
  for (const c of companies) {
    const pool = [...users].sort(() => 0.5 - Math.random());
    const owner = pool[0];
    const admin = pool[1];
    const memberCount = randInt(1, 4);
    const members = [owner, admin, ...pool.slice(2, 2 + memberCount)];
    for (const [idx, m] of members.entries()) {
      await prisma.companyMember.create({
        data: {
          userId: m.id,
          companyId: c.id,
          role: idx === 0 ? CompanyMemberRole.OWNER : idx === 1 ? CompanyMemberRole.ADMIN : CompanyMemberRole.MEMBER,
        },
      });
    }
  }

  // Posts per company
  const allPosts: { id: string; companyId: string }[] = [];
  for (const c of companies) {
    const postCount = randInt(6, 10);
    for (let i = 0; i < postCount; i++) {
      const type = sample([PostType.STORY, PostType.ANNOUNCEMENT, PostType.EVENT]);
      const p = await prisma.post.create({
        data: {
          companyId: c.id,
          title: `${type === PostType.STORY ? "Story" : type === PostType.ANNOUNCEMENT ? "Announcement" : "Event"} #${i + 1}`,
          content: "This is a sample post content to test card layout, line clamp and actions.",
          excerpt: Math.random() < 0.5 ? "Short excerpt for SEO and previews." : null,
          coverUrl: Math.random() < 0.75 ? `https://picsum.photos/seed/${c.slug}-${i + 1}/1200/675` : null,
          type,
          visibility: PostVisibility.PUBLIC,
          publishedAt: new Date(Date.now() - randInt(1, 30) * 86400000),
        },
        select: { id: true, companyId: true },
      });
      // Optionally create multiple images (gallery)
      const imgCount = Math.random() < 0.8 ? randInt(1, 5) : 0;
      if (imgCount > 0) {
        const data = Array.from({ length: imgCount }).map((_, k) => ({
          postId: p.id,
          url: `https://picsum.photos/seed/${c.slug}-p${i + 1}-${k + 1}/1200/675`,
          width: 1200,
          height: 675,
          order: k,
        }));
        await prisma.postImage.createMany({ data });
      }
      allPosts.push(p);
    }
  }

  // Jobs per company
  const allJobs: { id: string; companyId: string }[] = [];
  const jobTitles = [
    "Frontend Engineer",
    "Backend Engineer",
    "Fullstack Developer",
    "Product Manager",
    "QA Engineer",
    "UI/UX Designer",
    "Data Analyst",
    "DevOps Engineer",
  ];
  for (const c of companies) {
    const jobCount = randInt(2, 4);
    for (let i = 0; i < jobCount; i++) {
      const jt = sample(jobTitles);
      const j = await prisma.job.create({
        data: {
          companyId: c.id,
          title: jt,
          description: `We are hiring a ${jt}. Work with a passionate team to build products people love.`,
          requirements: "3+ years experience. Strong fundamentals.",
          responsibilities: "Build, ship, and improve features.",
          benefits: "Competitive salary, growth, flexible work.",
          location: sample(["HN", "HCM", "Remote"]),
          remote: Math.random() < 0.4,
          salaryMin: [1000, 1200, 1500, 2000, 2500][randInt(0, 4)],
          salaryMax: [1800, 2000, 2500, 3000, 3500][randInt(0, 4)],
          currency: "USD",
          employmentType: sample(employmentTypes),
          experienceLevel: sample(experienceLevels),
          skills: uniqueBy(["React", "TypeScript", "Node.js", "SQL", "AWS", "Docker", "Kubernetes", "Figma", "Jest", "Cypress"].sort(() => 0.5 - Math.random()).slice(0, randInt(3, 6)), (x) => x),
          tags: uniqueBy(["Culture", "Team", "Hiring", "Leadership", "Remote", "Growth"].sort(() => 0.5 - Math.random()).slice(0, randInt(2, 5)), (x) => x),
          applicationDeadline: Math.random() < 0.7 ? new Date(Date.now() + randInt(10, 60) * 86400000) : null,
          isActive: Math.random() < 0.85,
        },
        select: { id: true, companyId: true },
      });
      allJobs.push(j);
    }
  }

  // Follows (users follow companies)
  for (const u of users) {
    const followCompanies = [...companies].sort(() => 0.5 - Math.random()).slice(0, randInt(2, 6));
    for (const c of followCompanies) {
      await prisma.follow.create({ data: { userId: u.id, companyId: c.id } });
    }
  }

  // Likes (users like posts)
  for (const u of users) {
    const liked = [...allPosts].sort(() => 0.5 - Math.random()).slice(0, randInt(2, 10));
    for (const p of liked) {
      await prisma.like.create({ data: { userId: u.id, postId: p.id } });
    }
  }

  // Applications by users to jobs
  const applications: { id: string; userId: string; jobId: string }[] = [];
  for (const u of users) {
    const appliedJobs = [...allJobs].sort(() => 0.5 - Math.random()).slice(0, randInt(0, 4));
    for (const j of appliedJobs) {
      const app = await prisma.application.create({
        data: {
          userId: u.id,
          jobId: j.id,
          status: sample([ApplicationStatus.PENDING, ApplicationStatus.REVIEWING, ApplicationStatus.SHORTLISTED, ApplicationStatus.REJECTED]),
          coverLetter: Math.random() < 0.7 ? "I am very interested in this role and believe I am a strong fit." : null,
          resumeUrl: Math.random() < 0.8 ? `https://files.example.com/resume/${u.id}.pdf` : null,
          notes: Math.random() < 0.3 ? "Internal note for application." : null,
        },
        select: { id: true, userId: true, jobId: true },
      });
      applications.push(app);
    }
  }

  // Messages for some applications
  for (const app of applications.slice(0, Math.floor(applications.length * 0.4))) {
    // sender rotates between applicant and a company member
    const jobEntry = allJobs.find((j) => j.id === app.jobId);
    if (!jobEntry) continue;
    const members = await prisma.companyMember.findMany({ where: { companyId: jobEntry.companyId }, select: { userId: true } });
    const companySender = members.length ? sample(members).userId : null;
    const messagesCount = randInt(2, 6);
    let lastSenderCandidate = true;
    for (let i = 0; i < messagesCount; i++) {
      const senderId = lastSenderCandidate ? app.userId : (companySender ?? app.userId);
      await prisma.message.create({
        data: {
          applicationId: app.id,
          senderId,
          content: lastSenderCandidate ? "Hello, I would love to learn more about the role." : "Thanks for your interest. Can you share more about your recent projects?",
          messageType: MessageType.TEXT,
          isRead: Math.random() < 0.5,
        },
      });
      lastSenderCandidate = !lastSenderCandidate;
    }
  }

  console.log("Seeding completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


