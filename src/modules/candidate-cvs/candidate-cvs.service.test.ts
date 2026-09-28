import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, any>;

const { db, fakePrisma, syncMock } = vi.hoisted(() => {
  const db = {
    users: [] as Row[],
    profiles: [] as Row[],
    cvs: [] as Row[],
    experiences: [] as Row[],
    educations: [] as Row[],
    seq: 0,
  };
  const nextId = (prefix: string) => `${prefix}${++db.seq}`;

  const matches = (row: Row, where: Row = {}): boolean =>
    Object.entries(where).every(([key, cond]) => {
      if (cond && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
        if ('not' in cond) return row[key] !== cond.not;
        if ('in' in cond) return cond.in.includes(row[key]);
        return true;
      }
      return row[key] === cond;
    });

  const pick = (row: Row, select?: Row) => {
    if (!select) return { ...row };
    const out: Row = {};
    for (const key of Object.keys(select)) out[key] = row[key];
    return out;
  };

  const withSections = (cv: Row, include?: Row) => {
    const out: Row = { ...cv };
    if (include?.experiences) out.experiences = db.experiences.filter((e) => e.cvId === cv.id);
    if (include?.educations) out.educations = db.educations.filter((e) => e.cvId === cv.id);
    if (include?._count) out._count = { experiences: db.experiences.filter((e) => e.cvId === cv.id).length };
    return out;
  };

  const cvDefaults = () => ({
    avatar: null, headline: null, bio: null, skills: [], cvUrl: null, locations: [], wardCodes: [],
    specificAddress: null, website: null, linkedin: null, github: null, contactEmail: null, contactPhone: null,
    fullName: null, title: null, visibility: null, knowledge: [], attitude: [], expectedSalaryMin: null,
    expectedSalaryMax: null, salaryCurrency: 'VND', workMode: null, expectedCulture: null, careerGoals: [],
    gender: 'MALE', dayOfBirth: null, monthOfBirth: null, yearOfBirth: null, educationLevel: null,
  });

  const sectionModel = (table: 'experiences' | 'educations', prefix: string) => ({
    findMany: async ({ where }: Row) => db[table].filter((r) => matches(r, where)),
    findFirst: async ({ where, select }: Row) => {
      const row = db[table].find((r) => matches(r, where));
      return row ? pick(row, select) : null;
    },
    create: async ({ data }: Row) => {
      const row = { id: nextId(prefix), order: 0, ...data };
      db[table].push(row);
      return row;
    },
    update: async ({ where, data }: Row) => {
      const row = db[table].find((r) => r.id === where.id)!;
      Object.assign(row, data);
      return row;
    },
    deleteMany: async ({ where }: Row) => {
      const before = db[table].length;
      db[table] = db[table].filter((r) => !matches(r, where));
      return { count: before - db[table].length };
    },
  });

  const fakePrisma: Row = {
    $executeRaw: vi.fn(async () => 1),
    user: {
      findUnique: async ({ where, select }: Row) => {
        const row = db.users.find((u) => u.id === where.id);
        return row ? pick(row, select) : null;
      },
    },
    userProfile: {
      findUnique: async ({ where, select }: Row) => {
        const row = db.profiles.find((p) => p.userId === where.userId);
        return row ? pick(row, select) : null;
      },
      upsert: async ({ where, update, create }: Row) => {
        const row = db.profiles.find((p) => p.userId === where.userId);
        if (row) return Object.assign(row, update);
        const created = { id: nextId('p'), ...create };
        db.profiles.push(created);
        return created;
      },
      update: async ({ where, data }: Row) => {
        const row = db.profiles.find((p) => p.userId === where.userId)!;
        return Object.assign(row, data);
      },
    },
    candidateCv: {
      findFirst: async ({ where, include, select, orderBy }: Row) => {
        let rows = db.cvs.filter((r) => matches(r, where));
        if (orderBy?.createdAt === 'asc') rows = [...rows].sort((a, b) => a.createdAt - b.createdAt);
        const row = rows[0];
        if (!row) return null;
        return select ? pick(row, select) : withSections(row, include);
      },
      findMany: async ({ where, include, select }: Row) =>
        db.cvs.filter((r) => matches(r, where)).map((r) => (select ? pick(r, select) : withSections(r, include))),
      count: async ({ where }: Row) => db.cvs.filter((r) => matches(r, where)).length,
      create: async ({ data, select }: Row) => {
        const { experiences, educations, ...rest } = data;
        const now = new Date(Date.now() + db.seq);
        const row = { id: nextId('cv'), ...cvDefaults(), ...rest, createdAt: now, updatedAt: now };
        if (db.cvs.some((c) => c.userId === row.userId && c.nameNormalized === row.nameNormalized)) {
          throw new Error('unique violation');
        }
        db.cvs.push(row);
        for (const exp of experiences?.create ?? []) db.experiences.push({ id: nextId('e'), cvId: row.id, ...exp });
        for (const edu of educations?.create ?? []) db.educations.push({ id: nextId('d'), cvId: row.id, ...edu });
        return pick(row, select);
      },
      update: async ({ where, data }: Row) => {
        const row = db.cvs.find((c) => c.id === where.id)!;
        return Object.assign(row, data, { updatedAt: new Date() });
      },
      delete: async ({ where }: Row) => {
        db.cvs = db.cvs.filter((c) => c.id !== where.id);
        db.experiences = db.experiences.filter((e) => e.cvId !== where.id);
        db.educations = db.educations.filter((e) => e.cvId !== where.id);
      },
    },
    candidateCvExperience: sectionModel('experiences', 'e'),
    candidateCvEducation: sectionModel('educations', 'd'),
  };
  fakePrisma.$transaction = async (fn: (tx: Row) => Promise<unknown>) => fn(fakePrisma);

  return { db, fakePrisma, syncMock: vi.fn(async () => undefined) };
});

vi.mock('@/shared/database/prisma', () => ({ prisma: fakePrisma }));
vi.mock('@/shared/candidates/candidate-search-sync', () => ({ syncCandidateToEs: syncMock }));

import { CandidateCvService } from './candidate-cvs.service';
import { CV_LIMIT, normalizeCvName } from './candidate-cvs.schema';

const USER = 'u1';

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ code });
}

describe('CandidateCvService', () => {
  let service: CandidateCvService;

  beforeEach(() => {
    db.users = [
      { id: USER, name: 'Nguyễn A', email: 'a@x.test', phone: '0900000000' },
      { id: 'u2', name: 'B', email: 'b@x.test', phone: null },
    ];
    db.profiles = [];
    db.cvs = [];
    db.experiences = [];
    db.educations = [];
    db.seq = 0;
    syncMock.mockClear();
    service = new CandidateCvService();
  });

  it('normalizeCvName gộp khoảng trắng và không phân biệt hoa thường', () => {
    expect(normalizeCvName('  CV   Backend  ')).toBe('cv backend');
    expect(normalizeCvName('CV CỦA TÔI')).toBe(normalizeCvName('cv của tôi'));
  });

  it('ensureDefaultCv tạo profile + "CV của tôi" cho user chưa có', async () => {
    const cvId = await service.ensureDefaultCv(USER);
    expect(db.cvs).toHaveLength(1);
    expect(db.cvs[0]).toMatchObject({ id: cvId, name: 'CV của tôi', userId: USER });
    expect(db.profiles[0]).toMatchObject({ userId: USER, defaultCvId: cvId });
    expect(await service.ensureDefaultCv(USER)).toBe(cvId);
    expect(db.cvs).toHaveLength(1);
  });

  it(`chặn tạo CV thứ ${CV_LIMIT + 1}`, async () => {
    await service.ensureDefaultCv(USER);
    for (let i = 2; i <= CV_LIMIT; i += 1) {
      await service.create(USER, { name: `CV ${i}` });
    }
    await expectCode(service.create(USER, { name: 'CV thừa' }), 'CV_LIMIT_REACHED');
    const firstId = db.cvs[0].id;
    await expectCode(service.duplicate(USER, firstId, {}), 'CV_LIMIT_REACHED');
  });

  it('chặn tên trùng không phân biệt hoa thường / khoảng trắng', async () => {
    await service.create(USER, { name: 'CV Backend' });
    await expectCode(service.create(USER, { name: 'cv   backend' }), 'CV_NAME_DUPLICATE');
    const other = await service.create(USER, { name: 'CV Frontend' });
    await expectCode(service.update(USER, other.id, { name: 'CV BACKEND' }), 'CV_NAME_DUPLICATE');
  });

  it('không cho xóa CV mặc định hoặc CV duy nhất', async () => {
    const defaultId = await service.ensureDefaultCv(USER);
    await expectCode(service.remove(USER, defaultId), 'CV_LAST_ONE');
    const second = await service.create(USER, { name: 'CV 2' });
    await expectCode(service.remove(USER, defaultId), 'CV_IS_DEFAULT');
    await service.remove(USER, second.id);
    expect(db.cvs.map((c) => c.id)).toEqual([defaultId]);
  });

  it('nhân bản copy nội dung + exp/edu với id mới, sửa bản sao không đổi bản gốc', async () => {
    const sourceId = await service.ensureDefaultCv(USER);
    await service.update(USER, sourceId, { title: 'Backend Dev', skills: ['ts'] });
    await service.createExperience(USER, sourceId, { role: 'Dev', company: 'Acme', order: 0 });
    await service.createEducation(USER, sourceId, { school: 'HUST', degree: 'BS', order: 0 });

    const copy = await service.duplicate(USER, sourceId, {});
    expect(copy.name).toBe('Bản sao của CV của tôi');
    expect(copy.title).toBe('Backend Dev');
    expect(copy.experiences).toHaveLength(1);
    expect(copy.educations).toHaveLength(1);

    const sourceExp = db.experiences.find((e) => e.cvId === sourceId)!;
    const copyExp = copy.experiences[0]!;
    expect(copyExp.id).not.toBe(sourceExp.id);

    await service.updateExperience(USER, copy.id, copyExp.id, { company: 'Beta' });
    expect(sourceExp.company).toBe('Acme');

    const copy2 = await service.duplicate(USER, sourceId, {});
    expect(copy2.name).toBe('Bản sao của CV của tôi (2)');
  });

  it('trả 404 chung khi thao tác CV của người khác', async () => {
    const otherCv = await service.ensureDefaultCv('u2');
    await service.ensureDefaultCv(USER);
    await expectCode(service.get(USER, otherCv), 'CV_NOT_FOUND');
    await expectCode(service.update(USER, otherCv, { title: 'x' }), 'CV_NOT_FOUND');
    await expectCode(service.setDefault(USER, otherCv), 'CV_NOT_FOUND');
    await expectCode(service.createExperience(USER, otherCv, { role: 'r', company: 'c', order: 0 }), 'CV_NOT_FOUND');
  });

  it('không sửa được experience thuộc CV khác qua cvId của mình', async () => {
    const mine = await service.ensureDefaultCv(USER);
    const otherCv = await service.ensureDefaultCv('u2');
    const foreignExp = await service.createExperience('u2', otherCv, { role: 'r', company: 'c', order: 0 });
    await expectCode(service.updateExperience(USER, mine, foreignExp.id, { role: 'hack' }), 'EXPERIENCE_NOT_FOUND');
    await expectCode(service.deleteExperience(USER, mine, foreignExp.id), 'EXPERIENCE_NOT_FOUND');
  });

  it('setDefault đổi CV mặc định và sync ES; sửa CV mặc định mới sync', async () => {
    await service.ensureDefaultCv(USER);
    const second = await service.create(USER, { name: 'CV 2' });

    await service.update(USER, second.id, { title: 'x' });
    expect(syncMock).not.toHaveBeenCalled();

    const list = await service.setDefault(USER, second.id);
    expect(list.defaultCvId).toBe(second.id);
    expect(list.cvs[0]).toMatchObject({ id: second.id, isDefault: true });
    expect(syncMock).toHaveBeenCalledTimes(1);

    await service.update(USER, second.id, { title: 'y' });
    expect(syncMock).toHaveBeenCalledTimes(2);
  });

  it('list trả readiness theo từng CV', async () => {
    const cvId = await service.ensureDefaultCv(USER);
    await service.update(USER, cvId, {
      fullName: 'Nguyễn A',
      title: 'Dev',
      bio: 'Bio',
      locations: ['ha-noi'],
      skills: ['ts'],
    });
    await service.createExperience(USER, cvId, { role: 'Dev', company: 'Acme', order: 0 });
    await service.create(USER, { name: 'CV rỗng' });

    const { cvs } = await service.list(USER);
    expect(cvs.find((c) => c.id === cvId)?.readiness.isReady).toBe(true);
    expect(cvs.find((c) => c.name === 'CV rỗng')?.readiness.isReady).toBe(false);
  });
});
