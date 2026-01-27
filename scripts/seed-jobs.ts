import { PrismaClient, EmploymentType, ExperienceLevel, JobLevel, EducationLevel } from '@prisma/client';

const prisma = new PrismaClient();

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sample<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Job templates with diverse data
const jobTemplates = [
  {
    title: 'Senior Frontend Developer',
    generalInfo: '<ul><li><p><strong>Tên vị trí:</strong> Senior Frontend Developer</p></li><li><p><strong>Bộ phận:</strong> Engineering</p></li><li><p><strong>Báo cáo cho:</strong> Tech Lead</p></li><li><p><strong>Địa điểm:</strong> Hà Nội / Remote</p></li></ul>',
    mission: '<p><em>Xây dựng và phát triển các sản phẩm web hiện đại, tối ưu trải nghiệm người dùng và đóng góp vào chiến lược công nghệ của công ty.</em></p>',
    tasks: '<p><strong>Nhiệm vụ chính:</strong></p><ul><li><p>Thiết kế và phát triển giao diện người dùng responsive, hiệu năng cao</p></li><li><p>Tối ưu hóa hiệu suất ứng dụng web (Core Web Vitals)</p></li><li><p>Code review và mentoring junior developers</p></li><li><p>Tham gia thiết kế kiến trúc frontend và quyết định công nghệ</p></li></ul>',
    knowledge: '<ul><li><p>Hiểu sâu về JavaScript/TypeScript, React, Next.js</p></li><li><p>Nắm vững HTML5, CSS3, và các framework CSS hiện đại</p></li><li><p>Kiến thức về Web Performance, SEO, Accessibility</p></li><li><p>Hiểu biết về State Management (Redux, Zustand, Jotai)</p></li></ul>',
    skills: '<ul><li><p>Kỹ năng lập trình frontend chuyên sâu</p></li><li><p>Khả năng làm việc với RESTful APIs và GraphQL</p></li><li><p>Kinh nghiệm với Testing (Jest, React Testing Library, Cypress)</p></li><li><p>Kỹ năng debugging và performance profiling</p></li></ul>',
    attitude: '<ul><li><p>Tư duy sáng tạo, luôn tìm cách cải thiện sản phẩm</p></li><li><p>Chủ động học hỏi và cập nhật công nghệ mới</p></li><li><p>Làm việc nhóm hiệu quả, giao tiếp tốt</p></li><li><p>Chịu trách nhiệm cao với chất lượng code</p></li></ul>',
    location: 'Hà Nội',
    remote: true,
    salaryMin: 25000000,
    salaryMax: 40000000,
    currency: 'VND',
    employmentType: 'FULL_TIME' as EmploymentType,
    experienceLevel: 'SENIOR' as ExperienceLevel,
  },
  {
    title: 'Backend Engineer (Node.js)',
    generalInfo: '<ul><li><p><strong>Tên vị trí:</strong> Backend Engineer</p></li><li><p><strong>Bộ phận:</strong> Backend Engineering</p></li><li><p><strong>Báo cáo cho:</strong> Backend Lead</p></li></ul>',
    mission: '<p><em>Xây dựng hệ thống backend vững chắc, scalable và bảo mật cao, phục vụ hàng triệu người dùng.</em></p>',
    tasks: '<p><strong>Nhiệm vụ:</strong></p><ul><li><p>Phát triển và duy trì RESTful APIs và GraphQL services</p></li><li><p>Thiết kế database schema và tối ưu queries</p></li><li><p>Implement authentication, authorization và security best practices</p></li><li><p>Monitoring, logging và troubleshooting production issues</p></li></ul>',
    knowledge: '<ul><li><p>Thành thạo Node.js, Express, NestJS</p></li><li><p>Kiến thức sâu về PostgreSQL, MongoDB, Redis</p></li><li><p>Hiểu biết về Microservices, Docker, Kubernetes</p></li><li><p>Nắm vững Design Patterns và Clean Architecture</p></li></ul>',
    skills: '<ul><li><p>Kỹ năng lập trình backend chuyên sâu</p></li><li><p>Kinh nghiệm với message queues (RabbitMQ, Kafka)</p></li><li><p>Kỹ năng testing (Unit, Integration, E2E)</p></li><li><p>Khả năng optimize performance và scalability</p></li></ul>',
    attitude: '<ul><li><p>Tư duy hệ thống, nhìn xa trông rộng</p></li><li><p>Chú trọng code quality và best practices</p></li><li><p>Chủ động trong việc giải quyết vấn đề</p></li></ul>',
    location: 'Ho Chi Minh',
    remote: false,
    salaryMin: 20000000,
    salaryMax: 35000000,
    currency: 'VND',
    employmentType: 'FULL_TIME' as EmploymentType,
    experienceLevel: 'MID' as ExperienceLevel,
  },
  {
    title: 'Product Manager',
    generalInfo: '<ul><li><p><strong>Tên vị trí:</strong> Product Manager</p></li><li><p><strong>Bộ phận:</strong> Product</p></li><li><p><strong>Báo cáo cho:</strong> Head of Product</p></li></ul>',
    mission: '<p><em>Định hướng và phát triển sản phẩm, đảm bảo sản phẩm đáp ứng nhu cầu người dùng và mục tiêu kinh doanh.</em></p>',
    tasks: '<p><strong>Nhiệm vụ:</strong></p><ul><li><p>Nghiên cứu thị trường và phân tích nhu cầu người dùng</p></li><li><p>Xây dựng product roadmap và strategy</p></li><li><p>Làm việc với engineering team để deliver features</p></li><li><p>Phân tích metrics và đưa ra quyết định data-driven</p></li></ul>',
    knowledge: '<ul><li><p>Hiểu biết về Product Management methodologies</p></li><li><p>Kiến thức về UX/UI principles</p></li><li><p>Nắm vững analytics tools (Google Analytics, Mixpanel)</p></li><li><p>Hiểu biết về Agile/Scrum framework</p></li></ul>',
    skills: '<ul><li><p>Kỹ năng phân tích và tư duy chiến lược</p></li><li><p>Khả năng giao tiếp và thuyết phục</p></li><li><p>Kỹ năng viết PRD và user stories</p></li><li><p>Kinh nghiệm với A/B testing</p></li></ul>',
    attitude: '<ul><li><p>User-centric mindset</p></li><li><p>Data-driven decision making</p></li><li><p>Chủ động và có tinh thần ownership cao</p></li></ul>',
    location: 'Ho Chi Minh',
    remote: true,
    salaryMin: 30000000,
    salaryMax: 50000000,
    currency: 'VND',
    employmentType: 'FULL_TIME' as EmploymentType,
    experienceLevel: 'SENIOR' as ExperienceLevel,
  },
  {
    title: 'UI/UX Designer',
    generalInfo: '<ul><li><p><strong>Tên vị trí:</strong> UI/UX Designer</p></li><li><p><strong>Bộ phận:</strong> Design</p></li><li><p><strong>Báo cáo cho:</strong> Design Lead</p></li></ul>',
    mission: '<p><em>Tạo ra những trải nghiệm người dùng xuất sắc, thiết kế giao diện đẹp mắt và dễ sử dụng.</em></p>',
    tasks: '<p><strong>Nhiệm vụ:</strong></p><ul><li><p>Thiết kế wireframes, mockups và prototypes</p></li><li><p>Thực hiện user research và usability testing</p></li><li><p>Làm việc với developers để implement designs</p></li><li><p>Xây dựng và maintain design system</p></li></ul>',
    knowledge: '<ul><li><p>Nắm vững Design Principles và UX best practices</p></li><li><p>Hiểu biết về Human-Computer Interaction</p></li><li><p>Kiến thức về Accessibility (WCAG)</p></li><li><p>Hiểu biết về Frontend development (HTML/CSS/JS cơ bản)</p></li></ul>',
    skills: '<ul><li><p>Thành thạo Figma, Sketch, Adobe XD</p></li><li><p>Kỹ năng prototyping (Framer, Principle)</p></li><li><p>Kỹ năng user research và testing</p></li><li><p>Khả năng thiết kế responsive và mobile-first</p></li></ul>',
    attitude: '<ul><li><p>Empathy với người dùng</p></li><li><p>Chú trọng đến từng chi tiết</p></li><li><p>Mở lòng với feedback và iteration</p></li></ul>',
    location: 'Da Nang',
    remote: true,
    salaryMin: 18000000,
    salaryMax: 30000000,
    currency: 'VND',
    employmentType: 'FULL_TIME' as EmploymentType,
    experienceLevel: 'MID' as ExperienceLevel,
  },
  {
    title: 'Data Engineer',
    generalInfo: '<ul><li><p><strong>Tên vị trí:</strong> Data Engineer</p></li><li><p><strong>Bộ phận:</strong> Data</p></li><li><p><strong>Báo cáo cho:</strong> Data Lead</p></li></ul>',
    mission: '<p><em>Xây dựng và duy trì data pipelines, đảm bảo dữ liệu được thu thập, xử lý và lưu trữ hiệu quả.</em></p>',
    tasks: '<p><strong>Nhiệm vụ:</strong></p><ul><li><p>Thiết kế và xây dựng ETL/ELT pipelines</p></li><li><p>Optimize data warehouse và data lake</p></li><li><p>Implement data quality checks và monitoring</p></li><li><p>Làm việc với data scientists để support ML models</p></li></ul>',
    knowledge: '<ul><li><p>Thành thạo Python, SQL, Spark</p></li><li><p>Kiến thức về data warehousing (Snowflake, BigQuery, Redshift)</p></li><li><p>Hiểu biết về streaming data (Kafka, Flink)</p></li><li><p>Nắm vững cloud platforms (AWS, GCP, Azure)</p></li></ul>',
    skills: '<ul><li><p>Kỹ năng xây dựng scalable data pipelines</p></li><li><p>Kinh nghiệm với Airflow, dbt, Prefect</p></li><li><p>Kỹ năng optimize queries và data models</p></li><li><p>Khả năng làm việc với large datasets</p></li></ul>',
    attitude: '<ul><li><p>Tư duy hệ thống và scalability</p></li><li><p>Chú trọng data quality và reliability</p></li><li><p>Chủ động trong việc optimize và improve</p></li></ul>',
    location: 'Ho Chi Minh',
    remote: false,
    salaryMin: 25000000,
    salaryMax: 40000000,
    currency: 'VND',
    employmentType: 'FULL_TIME' as EmploymentType,
    experienceLevel: 'SENIOR' as ExperienceLevel,
  },
  {
    title: 'DevOps Engineer',
    generalInfo: '<ul><li><p><strong>Tên vị trí:</strong> DevOps Engineer</p></li><li><p><strong>Bộ phận:</strong> Infrastructure</p></li><li><p><strong>Báo cáo cho:</strong> DevOps Lead</p></li></ul>',
    mission: '<p><em>Tự động hóa quy trình deployment, đảm bảo hệ thống ổn định, scalable và bảo mật.</em></p>',
    tasks: '<p><strong>Nhiệm vụ:</strong></p><ul><li><p>Xây dựng và maintain CI/CD pipelines</p></li><li><p>Quản lý infrastructure as code (Terraform, CloudFormation)</p></li><li><p>Monitoring và alerting cho production systems</p></li><li><p>Optimize costs và performance của cloud resources</p></li></ul>',
    knowledge: '<ul><li><p>Thành thạo Docker, Kubernetes, containerization</p></li><li><p>Kiến thức sâu về AWS/GCP/Azure</p></li><li><p>Hiểu biết về Infrastructure as Code</p></li><li><p>Nắm vững monitoring tools (Prometheus, Grafana, Datadog)</p></li></ul>',
    skills: '<ul><li><p>Kỹ năng automation và scripting (Bash, Python)</p></li><li><p>Kinh nghiệm với GitLab CI, GitHub Actions, Jenkins</p></li><li><p>Kỹ năng troubleshooting và incident response</p></li><li><p>Khả năng optimize và cost management</p></li></ul>',
    attitude: '<ul><li><p>Automation-first mindset</p></li><li><p>Chú trọng reliability và uptime</p></li><li><p>Chủ động trong việc improve processes</p></li></ul>',
    location: 'Hà Nội',
    remote: true,
    salaryMin: 28000000,
    salaryMax: 45000000,
    currency: 'VND',
    employmentType: 'FULL_TIME' as EmploymentType,
    experienceLevel: 'SENIOR' as ExperienceLevel,
  },
  {
    title: 'QA Engineer',
    generalInfo: '<ul><li><p><strong>Tên vị trí:</strong> QA Engineer</p></li><li><p><strong>Bộ phận:</strong> Quality Assurance</p></li><li><p><strong>Báo cáo cho:</strong> QA Lead</p></li></ul>',
    mission: '<p><em>Đảm bảo chất lượng sản phẩm thông qua testing toàn diện, từ manual đến automation.</em></p>',
    tasks: '<p><strong>Nhiệm vụ:</strong></p><ul><li><p>Thiết kế và thực hiện test cases</p></li><li><p>Viết và maintain automated tests</p></li><li><p>Thực hiện regression testing và performance testing</p></li><li><p>Báo cáo bugs và theo dõi resolution</p></li></ul>',
    knowledge: '<ul><li><p>Hiểu biết về testing methodologies (Agile, TDD, BDD)</p></li><li><p>Kiến thức về test automation frameworks</p></li><li><p>Nắm vững API testing và database testing</p></li><li><p>Hiểu biết về performance và security testing</p></li></ul>',
    skills: '<ul><li><p>Kỹ năng test automation (Selenium, Cypress, Playwright)</p></li><li><p>Kinh nghiệm với testing tools (Postman, JMeter)</p></li><li><p>Kỹ năng viết test scripts (JavaScript, Python)</p></li><li><p>Khả năng phân tích và debug issues</p></li></ul>',
    attitude: '<ul><li><p>Attention to detail</p></li><li><p>Quality-first mindset</p></li><li><p>Chủ động trong việc tìm bugs</p></li></ul>',
    location: 'Ho Chi Minh',
    remote: false,
    salaryMin: 15000000,
    salaryMax: 25000000,
    currency: 'VND',
    employmentType: 'FULL_TIME' as EmploymentType,
    experienceLevel: 'JUNIOR' as ExperienceLevel,
  },
  {
    title: 'Marketing Manager',
    generalInfo: '<ul><li><p><strong>Tên vị trí:</strong> Marketing Manager</p></li><li><p><strong>Bộ phận:</strong> Marketing</p></li><li><p><strong>Báo cáo cho:</strong> CMO</p></li></ul>',
    mission: '<p><em>Xây dựng và thực thi chiến lược marketing, tăng brand awareness và lead generation.</em></p>',
    tasks: '<p><strong>Nhiệm vụ:</strong></p><ul><li><p>Phát triển marketing campaigns và strategies</p></li><li><p>Quản lý social media và content marketing</p></li><li><p>Phân tích marketing metrics và ROI</p></li><li><p>Làm việc với agencies và partners</p></li></ul>',
    knowledge: '<ul><li><p>Hiểu biết về digital marketing và traditional marketing</p></li><li><p>Kiến thức về SEO, SEM, social media marketing</p></li><li><p>Nắm vững marketing analytics và tools</p></li><li><p>Hiểu biết về brand management</p></li></ul>',
    skills: '<ul><li><p>Kỹ năng lập kế hoạch và execution</p></li><li><p>Kinh nghiệm với marketing tools (Google Analytics, HubSpot)</p></li><li><p>Kỹ năng content creation và copywriting</p></li><li><p>Khả năng phân tích data và insights</p></li></ul>',
    attitude: '<ul><li><p>Creative và data-driven</p></li><li><p>Results-oriented</p></li><li><p>Chủ động và có tinh thần ownership</p></li></ul>',
    location: 'Hà Nội',
    remote: true,
    salaryMin: 20000000,
    salaryMax: 35000000,
    currency: 'VND',
    employmentType: 'FULL_TIME' as EmploymentType,
    experienceLevel: 'MID' as ExperienceLevel,
  },
  {
    title: 'Business Analyst',
    generalInfo: '<ul><li><p><strong>Tên vị trí:</strong> Business Analyst</p></li><li><p><strong>Bộ phận:</strong> Business</p></li><li><p><strong>Báo cáo cho:</strong> Business Lead</p></li></ul>',
    mission: '<p><em>Phân tích business requirements, đóng vai trò cầu nối giữa business và technical teams.</em></p>',
    tasks: '<p><strong>Nhiệm vụ:</strong></p><ul><li><p>Thu thập và phân tích business requirements</p></li><li><p>Viết business requirements documents (BRD)</p></li><li><p>Làm việc với stakeholders để clarify requirements</p></li><li><p>Support UAT và user training</p></li></ul>',
    knowledge: '<ul><li><p>Hiểu biết về business analysis methodologies</p></li><li><p>Kiến thức về process modeling và documentation</p></li><li><p>Nắm vững data analysis và SQL cơ bản</p></li><li><p>Hiểu biết về Agile/Scrum</p></li></ul>',
    skills: '<ul><li><p>Kỹ năng phân tích và tư duy logic</p></li><li><p>Kỹ năng giao tiếp và facilitation</p></li><li><p>Kỹ năng viết tài liệu rõ ràng</p></li><li><p>Khả năng sử dụng tools (Jira, Confluence, Figma)</p></li></ul>',
    attitude: '<ul><li><p>Detail-oriented</p></li><li><p>Proactive communication</p></li><li><p>Problem-solving mindset</p></li></ul>',
    location: 'Ho Chi Minh',
    remote: false,
    salaryMin: 18000000,
    salaryMax: 28000000,
    currency: 'VND',
    employmentType: 'FULL_TIME' as EmploymentType,
    experienceLevel: 'MID' as ExperienceLevel,
  },
  {
    title: 'HR Manager',
    generalInfo: '<ul><li><p><strong>Tên vị trí:</strong> HR Manager</p></li><li><p><strong>Bộ phận:</strong> Human Resources</p></li><li><p><strong>Báo cáo cho:</strong> CHRO</p></li></ul>',
    mission: '<p><em>Quản lý và phát triển nguồn nhân lực, xây dựng văn hóa công ty và đảm bảo employee satisfaction.</em></p>',
    tasks: '<p><strong>Nhiệm vụ:</strong></p><ul><li><p>Recruitment và talent acquisition</p></li><li><p>Employee onboarding và offboarding</p></li><li><p>Performance management và reviews</p></li><li><p>Employee engagement và retention programs</p></li></ul>',
    knowledge: '<ul><li><p>Hiểu biết về HR best practices và labor laws</p></li><li><p>Kiến thức về recruitment và talent management</p></li><li><p>Nắm vững compensation và benefits</p></li><li><p>Hiểu biết về organizational development</p></li></ul>',
    skills: '<ul><li><p>Kỹ năng giao tiếp và interpersonal skills</p></li><li><p>Kinh nghiệm với HRIS và ATS</p></li><li><p>Kỹ năng interviewing và assessment</p></li><li><p>Khả năng conflict resolution</p></li></ul>',
    attitude: '<ul><li><p>People-oriented</p></li><li><p>Empathetic và fair</p></li><li><p>Confidential và trustworthy</p></li></ul>',
    location: 'Hà Nội',
    remote: false,
    salaryMin: 22000000,
    salaryMax: 38000000,
    currency: 'VND',
    employmentType: 'FULL_TIME' as EmploymentType,
    experienceLevel: 'SENIOR' as ExperienceLevel,
  },
  {
    title: 'Mobile Developer (React Native)',
    generalInfo: '<ul><li><p><strong>Tên vị trí:</strong> Mobile Developer</p></li><li><p><strong>Bộ phận:</strong> Mobile Engineering</p></li><li><p><strong>Báo cáo cho:</strong> Mobile Lead</p></li></ul>',
    mission: '<p><em>Phát triển ứng dụng mobile cross-platform, đảm bảo performance và user experience tốt nhất.</em></p>',
    tasks: '<p><strong>Nhiệm vụ:</strong></p><ul><li><p>Phát triển mobile apps với React Native</p></li><li><p>Optimize app performance và battery usage</p></li><li><p>Implement native modules khi cần</p></li><li><p>Testing và debugging trên iOS và Android</p></li></ul>',
    knowledge: '<ul><li><p>Thành thạo React Native, JavaScript/TypeScript</p></li><li><p>Hiểu biết về iOS và Android platforms</p></li><li><p>Kiến thức về mobile app architecture</p></li><li><p>Nắm vững state management và navigation</p></li></ul>',
    skills: '<ul><li><p>Kỹ năng lập trình mobile chuyên sâu</p></li><li><p>Kinh nghiệm với native modules và bridging</p></li><li><p>Kỹ năng testing (Jest, Detox, Appium)</p></li><li><p>Khả năng optimize performance và memory</p></li></ul>',
    attitude: '<ul><li><p>User experience focused</p></li><li><p>Chú trọng performance và battery efficiency</p></li><li><p>Chủ động học hỏi platform-specific features</p></li></ul>',
    location: 'Ho Chi Minh',
    remote: true,
    salaryMin: 20000000,
    salaryMax: 35000000,
    currency: 'VND',
    employmentType: 'FULL_TIME' as EmploymentType,
    experienceLevel: 'MID' as ExperienceLevel,
  },
  {
    title: 'Fullstack Developer',
    generalInfo: '<ul><li><p><strong>Tên vị trí:</strong> Fullstack Developer</p></li><li><p><strong>Bộ phận:</strong> Engineering</p></li><li><p><strong>Báo cáo cho:</strong> Engineering Manager</p></li></ul>',
    mission: '<p><em>Phát triển cả frontend và backend, xây dựng sản phẩm end-to-end từ concept đến production.</em></p>',
    tasks: '<p><strong>Nhiệm vụ:</strong></p><ul><li><p>Phát triển features từ frontend đến backend</p></li><li><p>Thiết kế và implement APIs</p></li><li><p>Optimize database queries và frontend performance</p></li><li><p>Deploy và maintain applications</p></li></ul>',
    knowledge: '<ul><li><p>Thành thạo cả frontend (React) và backend (Node.js)</p></li><li><p>Kiến thức về databases (PostgreSQL, MongoDB)</p></li><li><p>Hiểu biết về cloud platforms và deployment</p></li><li><p>Nắm vững full-stack architecture</p></li></ul>',
    skills: '<ul><li><p>Kỹ năng full-stack development</p></li><li><p>Khả năng làm việc độc lập end-to-end</p></li><li><p>Kỹ năng debugging và problem-solving</p></li><li><p>Kinh nghiệm với CI/CD và DevOps basics</p></li></ul>',
    attitude: '<ul><li><p>Versatile và adaptable</p></li><li><p>Ownership mindset</p></li><li><p>Chủ động trong việc learn và grow</p></li></ul>',
    location: 'Da Nang',
    remote: true,
    salaryMin: 18000000,
    salaryMax: 30000000,
    currency: 'VND',
    employmentType: 'FULL_TIME' as EmploymentType,
    experienceLevel: 'MID' as ExperienceLevel,
  },
  {
    title: 'Sales Executive',
    generalInfo: '<ul><li><p><strong>Tên vị trí:</strong> Sales Executive</p></li><li><p><strong>Bộ phận:</strong> Sales</p></li><li><p><strong>Báo cáo cho:</strong> Sales Manager</p></li></ul>',
    mission: '<p><em>Phát triển và duy trì mối quan hệ với khách hàng, đạt được sales targets và mở rộng thị trường.</em></p>',
    tasks: '<p><strong>Nhiệm vụ:</strong></p><ul><li><p>Tìm kiếm và phát triển leads mới</p></li><li><p>Thực hiện sales calls và meetings</p></li><li><p>Chuẩn bị proposals và contracts</p></li><li><p>Theo dõi và maintain customer relationships</p></li></ul>',
    knowledge: '<ul><li><p>Hiểu biết về sales process và methodologies</p></li><li><p>Kiến thức về sản phẩm và thị trường</p></li><li><p>Nắm vững CRM tools và sales analytics</p></li><li><p>Hiểu biết về negotiation và closing techniques</p></li></ul>',
    skills: '<ul><li><p>Kỹ năng giao tiếp và persuasion</p></li><li><p>Kinh nghiệm với CRM (Salesforce, HubSpot)</p></li><li><p>Kỹ năng presentation và pitching</p></li><li><p>Khả năng build relationships</p></li></ul>',
    attitude: '<ul><li><p>Results-driven và target-oriented</p></li><li><p>Resilient và persistent</p></li><li><p>Customer-focused</p></li></ul>',
    location: 'Ho Chi Minh',
    remote: false,
    salaryMin: 15000000,
    salaryMax: 30000000,
    currency: 'VND',
    employmentType: 'FULL_TIME' as EmploymentType,
    experienceLevel: 'JUNIOR' as ExperienceLevel,
  },
  {
    title: 'Content Writer',
    generalInfo: '<ul><li><p><strong>Tên vị trí:</strong> Content Writer</p></li><li><p><strong>Bộ phận:</strong> Marketing</p></li><li><p><strong>Báo cáo cho:</strong> Content Manager</p></li></ul>',
    mission: '<p><em>Tạo ra nội dung chất lượng cao, thu hút và engage với audience, support marketing và brand goals.</em></p>',
    tasks: '<p><strong>Nhiệm vụ:</strong></p><ul><li><p>Viết blog posts, articles, và social media content</p></li><li><p>Research và develop content ideas</p></li><li><p>SEO optimization cho content</p></li><li><p>Collaborate với design team cho visual content</p></li></ul>',
    knowledge: '<ul><li><p>Hiểu biết về content marketing và SEO</p></li><li><p>Kiến thức về writing styles và best practices</p></li><li><p>Nắm vững grammar và language nuances</p></li><li><p>Hiểu biết về target audience và personas</p></li></ul>',
    skills: '<ul><li><p>Kỹ năng viết xuất sắc (Vietnamese và English)</p></li><li><p>Kinh nghiệm với CMS và content tools</p></li><li><p>Kỹ năng research và fact-checking</p></li><li><p>Khả năng adapt tone và style</p></li></ul>',
    attitude: '<ul><li><p>Creative và imaginative</p></li><li><p>Detail-oriented</p></li><li><p>Open to feedback và iteration</p></li></ul>',
    location: 'Hà Nội',
    remote: true,
    salaryMin: 12000000,
    salaryMax: 20000000,
    currency: 'VND',
    employmentType: 'FULL_TIME' as EmploymentType,
    experienceLevel: 'JUNIOR' as ExperienceLevel,
  },
  {
    title: 'Customer Success Manager',
    generalInfo: '<ul><li><p><strong>Tên vị trí:</strong> Customer Success Manager</p></li><li><p><strong>Bộ phận:</strong> Customer Success</p></li><li><p><strong>Báo cáo cho:</strong> Head of Customer Success</p></li></ul>',
    mission: '<p><em>Đảm bảo khách hàng thành công với sản phẩm, tăng retention và satisfaction, identify upsell opportunities.</em></p>',
    tasks: '<p><strong>Nhiệm vụ:</strong></p><ul><li><p>Onboard new customers và training</p></li><li><p>Regular check-ins và health checks</p></li><li><p>Resolve customer issues và escalations</p></li><li><p>Identify expansion và upsell opportunities</p></li></ul>',
    knowledge: '<ul><li><p>Hiểu biết về customer success methodologies</p></li><li><p>Kiến thức về SaaS metrics (NPS, CSAT, churn)</p></li><li><p>Nắm vững product features và use cases</p></li><li><p>Hiểu biết về account management</p></li></ul>',
    skills: '<ul><li><p>Kỹ năng giao tiếp và relationship building</p></li><li><p>Kinh nghiệm với CRM và customer success tools</p></li><li><p>Kỹ năng problem-solving và troubleshooting</p></li><li><p>Khả năng analyze customer data</p></li></ul>',
    attitude: '<ul><li><p>Customer-first mindset</p></li><li><p>Proactive và solution-oriented</p></li><li><p>Empathetic và patient</p></li></ul>',
    location: 'Ho Chi Minh',
    remote: true,
    salaryMin: 20000000,
    salaryMax: 35000000,
    currency: 'VND',
    employmentType: 'FULL_TIME' as EmploymentType,
    experienceLevel: 'MID' as ExperienceLevel,
  },
  {
    title: 'Finance Manager',
    generalInfo: '<ul><li><p><strong>Tên vị trí:</strong> Finance Manager</p></li><li><p><strong>Bộ phận:</strong> Finance</p></li><li><p><strong>Báo cáo cho:</strong> CFO</p></li></ul>',
    mission: '<p><em>Quản lý tài chính công ty, đảm bảo financial health và compliance, support strategic decision-making.</em></p>',
    tasks: '<p><strong>Nhiệm vụ:</strong></p><ul><li><p>Financial planning và budgeting</p></li><li><p>Financial reporting và analysis</p></li><li><p>Cash flow management</p></li><li><p>Compliance và audit support</p></li></ul>',
    knowledge: '<ul><li><p>Hiểu biết về accounting principles và standards</p></li><li><p>Kiến thức về financial analysis và modeling</p></li><li><p>Nắm vững tax regulations và compliance</p></li><li><p>Hiểu biết về ERP systems</p></li></ul>',
    skills: '<ul><li><p>Kỹ năng financial analysis và reporting</p></li><li><p>Kinh nghiệm với Excel và financial software</p></li><li><p>Kỹ năng budgeting và forecasting</p></li><li><p>Khả năng communicate financial insights</p></li></ul>',
    attitude: '<ul><li><p>Analytical và detail-oriented</p></li><li><p>Integrity và accuracy</p></li><li><p>Strategic thinking</p></li></ul>',
    location: 'Hà Nội',
    remote: false,
    salaryMin: 25000000,
    salaryMax: 45000000,
    currency: 'VND',
    employmentType: 'FULL_TIME' as EmploymentType,
    experienceLevel: 'SENIOR' as ExperienceLevel,
  },
  {
    title: 'Intern - Software Engineering',
    generalInfo: '<ul><li><p><strong>Tên vị trí:</strong> Software Engineering Intern</p></li><li><p><strong>Bộ phận:</strong> Engineering</p></li><li><p><strong>Báo cáo cho:</strong> Engineering Manager</p></li></ul>',
    mission: '<p><em>Học hỏi và đóng góp vào các dự án thực tế, phát triển kỹ năng lập trình và làm việc nhóm.</em></p>',
    tasks: '<p><strong>Nhiệm vụ:</strong></p><ul><li><p>Tham gia phát triển features dưới sự hướng dẫn</p></li><li><p>Học và apply best practices</p></li><li><p>Tham gia code reviews và team meetings</p></li><li><p>Hoàn thành các tasks được giao</p></li></ul>',
    knowledge: '<ul><li><p>Kiến thức cơ bản về programming (JavaScript, Python, Java)</p></li><li><p>Hiểu biết về data structures và algorithms</p></li><li><p>Kiến thức về version control (Git)</p></li><li><p>Đang học hoặc mới tốt nghiệp đại học</p></li></ul>',
    skills: '<ul><li><p>Kỹ năng lập trình cơ bản</p></li><li><p>Khả năng học hỏi nhanh</p></li><li><p>Kỹ năng giao tiếp và teamwork</p></li><li><p>Willingness to learn và take feedback</p></li></ul>',
    attitude: '<ul><li><p>Eager to learn</p></li><li><p>Proactive và curious</p></li><li><p>Open to feedback</p></li></ul>',
    location: 'Ho Chi Minh',
    remote: false,
    salaryMin: 5000000,
    salaryMax: 8000000,
    currency: 'VND',
    employmentType: 'INTERNSHIP' as EmploymentType,
    experienceLevel: 'ENTRY' as ExperienceLevel,
  },
  {
    title: 'Lead Software Engineer',
    generalInfo: '<ul><li><p><strong>Tên vị trí:</strong> Lead Software Engineer</p></li><li><p><strong>Bộ phận:</strong> Engineering</p></li><li><p><strong>Báo cáo cho:</strong> Engineering Director</p></li></ul>',
    mission: '<p><em>Lãnh đạo technical team, đưa ra technical decisions, mentor developers và đảm bảo code quality.</em></p>',
    tasks: '<p><strong>Nhiệm vụ:</strong></p><ul><li><p>Technical leadership và architecture decisions</p></li><li><p>Mentor và coach team members</p></li><li><p>Code review và set coding standards</p></li><li><p>Collaborate với product và other teams</p></li></ul>',
    knowledge: '<ul><li><p>Expert-level knowledge về software engineering</p></li><li><p>Kiến thức sâu về system design và architecture</p></li><li><p>Nắm vững multiple programming languages và frameworks</p></li><li><p>Hiểu biết về team leadership và management</p></li></ul>',
    skills: '<ul><li><p>Kỹ năng technical leadership</p></li><li><p>Kinh nghiệm với large-scale systems</p></li><li><p>Kỹ năng mentoring và coaching</p></li><li><p>Khả năng communicate technical concepts</p></li></ul>',
    attitude: '<ul><li><p>Leadership mindset</p></li><li><p>Mentor và support others</p></li><li><p>Strategic technical thinking</p></li></ul>',
    location: 'Hà Nội',
    remote: true,
    salaryMin: 40000000,
    salaryMax: 60000000,
    currency: 'VND',
    employmentType: 'FULL_TIME' as EmploymentType,
    experienceLevel: 'LEAD' as ExperienceLevel,
  },
  {
    title: 'Part-time Content Creator',
    generalInfo: '<ul><li><p><strong>Tên vị trí:</strong> Content Creator (Part-time)</p></li><li><p><strong>Bộ phận:</strong> Marketing</p></li><li><p><strong>Báo cáo cho:</strong> Marketing Manager</p></li></ul>',
    mission: '<p><em>Tạo ra nội dung social media và video content, tăng engagement và brand awareness.</em></p>',
    tasks: '<p><strong>Nhiệm vụ:</strong></p><ul><li><p>Sáng tạo nội dung cho social media</p></li><li><p>Quay và edit video content</p></li><li><p>Quản lý social media accounts</p></li><li><p>Phân tích engagement metrics</p></li></ul>',
    knowledge: '<ul><li><p>Hiểu biết về social media platforms và trends</p></li><li><p>Kiến thức về video editing và graphic design</p></li><li><p>Nắm vững content creation tools</p></li><li><p>Hiểu biết về audience và engagement</p></li></ul>',
    skills: '<ul><li><p>Kỹ năng video editing (Premiere Pro, Final Cut)</p></li><li><p>Kinh nghiệm với graphic design tools</p></li><li><p>Kỹ năng storytelling và creativity</p></li><li><p>Khả năng adapt to trends</p></li></ul>',
    attitude: '<ul><li><p>Creative và trend-aware</p></li><li><p>Flexible và adaptable</p></li><li><p>Results-driven</p></li></ul>',
    location: 'Ho Chi Minh',
    remote: true,
    salaryMin: 8000000,
    salaryMax: 15000000,
    currency: 'VND',
    employmentType: 'PART_TIME' as EmploymentType,
    experienceLevel: 'JUNIOR' as ExperienceLevel,
  },
  {
    title: 'Freelance Graphic Designer',
    generalInfo: '<ul><li><p><strong>Tên vị trí:</strong> Graphic Designer (Freelance)</p></li><li><p><strong>Bộ phận:</strong> Design</p></li><li><p><strong>Báo cáo cho:</strong> Design Lead</p></li></ul>',
    mission: '<p><em>Tạo ra visual designs chất lượng cao cho các dự án marketing và branding.</em></p>',
    tasks: '<p><strong>Nhiệm vụ:</strong></p><ul><li><p>Thiết kế marketing materials (posters, banners, social media)</p></li><li><p>Brand identity design</p></li><li><p>Illustration và icon design</p></li><li><p>Collaborate với marketing team</p></li></ul>',
    knowledge: '<ul><li><p>Hiểu biết về design principles và typography</p></li><li><p>Kiến thức về color theory và composition</p></li><li><p>Nắm vững design software và tools</p></li><li><p>Hiểu biết về print và digital design</p></li></ul>',
    skills: '<ul><li><p>Thành thạo Adobe Creative Suite (Photoshop, Illustrator, InDesign)</p></li><li><p>Kỹ năng illustration và digital art</p></li><li><p>Kinh nghiệm với branding và identity design</p></li><li><p>Khả năng work với tight deadlines</p></li></ul>',
    attitude: '<ul><li><p>Creative và artistic</p></li><li><p>Detail-oriented</p></li><li><p>Flexible và reliable</p></li></ul>',
    location: 'Da Nang',
    remote: true,
    salaryMin: 10000000,
    salaryMax: 20000000,
    currency: 'VND',
    employmentType: 'FREELANCE' as EmploymentType,
    experienceLevel: 'MID' as ExperienceLevel,
  },
  {
    title: 'Contract Project Manager',
    generalInfo: '<ul><li><p><strong>Tên vị trí:</strong> Project Manager (Contract)</p></li><li><p><strong>Bộ phận:</strong> Project Management</p></li><li><p><strong>Báo cáo cho:</strong> Program Manager</p></li></ul>',
    mission: '<p><em>Quản lý dự án từ initiation đến closure, đảm bảo deliver on time, on budget và meet quality standards.</em></p>',
    tasks: '<p><strong>Nhiệm vụ:</strong></p><ul><li><p>Lập kế hoạch dự án và manage timeline</p></li><li><p>Coordinate với stakeholders và team members</p></li><li><p>Track progress và manage risks</p></li><li><p>Report status và deliverables</p></li></ul>',
    knowledge: '<ul><li><p>Hiểu biết về project management methodologies (Agile, Waterfall)</p></li><li><p>Kiến thức về project management tools</p></li><li><p>Nắm vững risk management và change management</p></li><li><p>Hiểu biết về budgeting và resource planning</p></li></ul>',
    skills: '<ul><li><p>Kỹ năng planning và organization</p></li><li><p>Kinh nghiệm với PM tools (Jira, Asana, Monday)</p></li><li><p>Kỹ năng communication và stakeholder management</p></li><li><p>Khả năng manage multiple priorities</p></li></ul>',
    attitude: '<ul><li><p>Organized và methodical</p></li><li><p>Results-driven</p></li><li><p>Calm under pressure</p></li></ul>',
    location: 'Hà Nội',
    remote: true,
    salaryMin: 25000000,
    salaryMax: 40000000,
    currency: 'VND',
    employmentType: 'CONTRACT' as EmploymentType,
    experienceLevel: 'SENIOR' as ExperienceLevel,
  },
];

const locations = ['Hà Nội', 'Ho Chi Minh', 'Da Nang', 'Can Tho', 'Hai Phong'];
const employmentTypes = Object.values(EmploymentType);
const experienceLevels = Object.values(ExperienceLevel);
const jobLevels: (JobLevel | null)[] = [...Object.values(JobLevel), null];
const educationLevels: (EducationLevel | null)[] = [...Object.values(EducationLevel), null];
const departments = ['Engineering', 'Product', 'Design', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'Data', 'DevOps', null];

async function main() {
  console.log('🌱 Starting job seeding...');

  // Get all companies
  const companies = await prisma.company.findMany({
    select: { id: true, name: true },
  });

  if (companies.length === 0) {
    console.error('❌ No companies found. Please create companies first.');
    process.exit(1);
  }

  console.log(`📊 Found ${companies.length} companies`);

  // Get company owners for job creation
  const companyOwners = await prisma.companyMember.findMany({
    where: { role: 'OWNER' },
    select: { companyId: true, userId: true },
  });

  const ownerMap = new Map(companyOwners.map((co) => [co.companyId, co.userId]));

  let totalCreated = 0;
  const jobsPerCompany = 5; // Create 5 jobs per company for more test data

  for (const company of companies) {
    const ownerId = ownerMap.get(company.id);
    if (!ownerId) {
      console.warn(`⚠️  Skipping company ${company.name} (no owner found)`);
      continue;
    }

    // Select random job templates for this company
    const selectedTemplates = [...jobTemplates]
      .sort(() => 0.5 - Math.random())
      .slice(0, jobsPerCompany);

    for (const template of selectedTemplates) {
      try {
        // Add some variation to the template
        const job = await prisma.job.create({
          data: {
            companyId: company.id,
            title: template.title,
            generalInfo: template.generalInfo,
            mission: template.mission,
            tasks: template.tasks,
            knowledge: template.knowledge,
            skills: template.skills,
            attitude: template.attitude,
            location: sample(locations),
            remote: Math.random() < 0.5,
            salaryMin: template.salaryMin + randInt(-2000000, 2000000),
            salaryMax: template.salaryMax + randInt(-3000000, 3000000),
            currency: template.currency,
            employmentType: sample(employmentTypes),
            experienceLevel: sample(experienceLevels),
            department: sample(departments),
            jobLevel: sample(jobLevels),
            educationLevel: sample(educationLevels),
            tags: ['Hiring', 'Opportunity', 'Growth'].sort(() => 0.5 - Math.random()).slice(0, 3),
            applicationDeadline: Math.random() < 0.7 
              ? new Date(Date.now() + randInt(15, 60) * 24 * 60 * 60 * 1000)
              : null,
            isActive: Math.random() < 0.9,
            kpis: Math.random() < 0.6 ? '<p>Công ty vận hành theo hướng quản trị bằng mục tiêu. Vị trí này sẽ cùng CEO/Quản lý xây dựng và thỏa thuận OKRs theo từng chu kỳ.</p>' : null,
            benefitsIncome: Math.random() < 0.5 ? 'Thưởng tháng 13, thưởng hiệu quả' : null,
            benefitsPerks: Math.random() < 0.5 ? 'Bảo hiểm sức khỏe, phụ cấp ăn trưa, gym, teambuilding' : null,
            contact: Math.random() < 0.5 ? 'Email: tuyendung@company.vn | Phone: 0123456789' : null,
          },
        });

        totalCreated++;
        if (totalCreated % 10 === 0) {
          console.log(`✅ Created ${totalCreated} jobs...`);
        }
      } catch (error: any) {
        console.error(`❌ Failed to create job for ${company.name}:`, error.message);
      }
    }
  }

  console.log(`\n🎉 Seeding completed! Created ${totalCreated} jobs across ${companies.length} companies.`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
