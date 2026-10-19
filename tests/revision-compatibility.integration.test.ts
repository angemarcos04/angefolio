import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { eq } from 'drizzle-orm';

const directory = await mkdtemp(
  join(existsSync('/dev/shm') ? '/dev/shm' : tmpdir(), 'angefolio-h2-'),
);
process.env.NODE_ENV = 'test';
delete process.env.TURSO_AUTH_TOKEN;
delete process.env.ADMIN_EMAIL;
delete process.env.ADMIN_PASSWORD;
process.env.DATABASE_URL = `file:${join(directory, 'initial.sqlite')}`;

const { getDatabase, migrateDatabase, closeDatabase } =
  await import('../src/lib/server/db/client');
const schema = await import('../src/lib/server/db/schema');
const { revisionValues, restoreContentRevision } =
  await import('../src/lib/server/revisions');
type RevisionMdxSlugCollections =
  import('../src/lib/server/revisions').RevisionMdxSlugCollections;
const { defaultHomepageConfig } = await import('../src/lib/data/homepage');
const actor = 'h2-owner';
const mdx: RevisionMdxSlugCollections = { project: [], note: [], lab: [] };
const date = new Date('2026-01-01T00:00:00.000Z');
let number = 0;

async function reset() {
  closeDatabase();
  process.env.DATABASE_URL = `file:${join(directory, `case-${number++}.sqlite`)}`;
  await migrateDatabase();
  await getDatabase().insert(schema.user).values({
    id: actor,
    name: 'Owner',
    email: 'h2-owner@example.test',
    emailVerified: true,
    createdAt: date,
    updatedAt: date,
  });
}

function project(id: string) {
  return {
    id,
    slug: `${id}-old`,
    title: 'Earlier project',
    description: 'Earlier project description',
    status: 'Prototype',
    category: null,
    role: null,
    problem: null,
    solution: null,
    stack: [],
    links: [],
    github: null,
    demo: null,
    caseStudyBody: '# Earlier project',
    projectDate: null as Date | string | number | null | undefined,
    highlights: [],
    cover: null,
    screenshots: [] as Array<{ src: string; alt: string; caption?: string }>,
    replacesMdx: false,
    featured: false,
    visible: true,
    archived: false,
    statusBeforeArchive: null,
    orderIndex: null,
    createdAt: date,
    updatedAt: date,
  };
}

function lab(id: string) {
  return {
    id,
    slug: `${id}-old`,
    title: 'Earlier lab',
    description: 'Earlier lab description',
    status: 'Idea',
    category: null,
    tags: [],
    visible: true,
    featured: false,
    repo: null,
    demo: null,
    relatedProject: null,
    tools: [],
    lessons: [],
    risk: null,
    body: '# Earlier lab',
    replacesMdx: false,
    date,
    updatedAt: null as Date | string | number | null | undefined,
  };
}

async function insertRevision(
  type: 'project' | 'lab',
  snapshot: Record<string, unknown>,
) {
  const id = snapshot.id as string;
  const current = type === 'project' ? project(id) : lab(id);
  current.slug = `${id}-current`;
  if (type === 'project')
    await getDatabase()
      .insert(schema.projectRecords)
      .values(current as never);
  else
    await getDatabase()
      .insert(schema.labRecords)
      .values(current as never);
  const revision = revisionValues(actor, type, id, snapshot);
  await getDatabase().insert(schema.contentRevisions).values(revision);
  return revision;
}

async function state() {
  const db = getDatabase();
  return {
    projects: await db
      .select()
      .from(schema.projectRecords)
      .orderBy(schema.projectRecords.id),
    blogs: await db
      .select()
      .from(schema.blogRecords)
      .orderBy(schema.blogRecords.id),
    notes: await db
      .select()
      .from(schema.noteRecords)
      .orderBy(schema.noteRecords.id),
    labs: await db
      .select()
      .from(schema.labRecords)
      .orderBy(schema.labRecords.id),
    homepage: await db
      .select()
      .from(schema.homepageSettings)
      .orderBy(schema.homepageSettings.id),
    site: await db
      .select()
      .from(schema.siteSettings)
      .orderBy(schema.siteSettings.id),
    now: await db.select().from(schema.nowStatus).orderBy(schema.nowStatus.id),
    redirects: await db
      .select()
      .from(schema.contentRedirects)
      .orderBy(schema.contentRedirects.fromPath),
    revisions: await db
      .select()
      .from(schema.contentRevisions)
      .orderBy(schema.contentRevisions.id),
    audit: await db.select().from(schema.auditLog).orderBy(schema.auditLog.id),
    media: await db
      .select()
      .from(schema.mediaAssets)
      .orderBy(schema.mediaAssets.id),
  };
}

async function restoreFixture(
  type: 'project' | 'lab',
  snapshot: Record<string, unknown>,
  expected: boolean,
) {
  await reset();
  const revision = await insertRevision(type, snapshot);
  const before = await state();
  assert.equal(
    await restoreContentRevision(
      actor,
      type,
      snapshot.id as string,
      revision.id,
      mdx,
    ),
    expected,
  );
  const after = await state();
  if (!expected) assert.deepEqual(after, before);
  return { revision, before, after };
}

test('older Project snapshot without projectDate restores a null date', async () => {
  await reset();
  const snapshot: Record<string, unknown> = project('h2-project');
  delete snapshot.projectDate;
  const revision = await insertRevision('project', snapshot);
  assert.equal(
    await restoreContentRevision(
      actor,
      'project',
      'h2-project',
      revision.id,
      mdx,
    ),
    true,
  );
  const [restored] = await getDatabase().select().from(schema.projectRecords);
  assert.equal(restored.projectDate, null);
  const [source] = await getDatabase()
    .select()
    .from(schema.contentRevisions)
    .where(eq(schema.contentRevisions.id, revision.id));
  assert.equal('projectDate' in source.snapshot, false);
});

test('older Lab snapshot without updatedAt restores a null date', async () => {
  await reset();
  const snapshot: Record<string, unknown> = lab('h2-lab');
  delete snapshot.updatedAt;
  const revision = await insertRevision('lab', snapshot);
  assert.equal(
    await restoreContentRevision(actor, 'lab', 'h2-lab', revision.id, mdx),
    true,
  );
  const [restored] = await getDatabase().select().from(schema.labRecords);
  assert.equal(restored.updatedAt, null);
  const [source] = await getDatabase()
    .select()
    .from(schema.contentRevisions)
    .where(eq(schema.contentRevisions.id, revision.id));
  assert.equal('updatedAt' in source.snapshot, false);
});

for (const [name, value] of [
  ['explicit null', null],
  ['ISO string', '2025-07-12T00:00:00.000Z'],
  ['migration integer seconds', 1752278400],
] as const) {
  test(`Project projectDate preserves ${name}`, async () => {
    const snapshot = project(
      `project-date-${name.toLowerCase().replaceAll(' ', '-')}`,
    );
    snapshot.projectDate = value;
    const { revision, after } = await restoreFixture('project', snapshot, true);
    assert.equal(
      after.projects[0].projectDate?.getTime() ?? null,
      value === null ? null : new Date('2025-07-12T00:00:00.000Z').getTime(),
    );
    assert.equal(
      after.revisions.find((item) => item.id === revision.id)?.snapshot
        .projectDate,
      value,
    );
    assert.equal(after.revisions.length, 2);
    assert.equal(
      after.revisions.find((item) => item.restoredFromId === revision.id)
        ?.entityId,
      snapshot.id,
    );
    assert.equal(
      after.audit.filter((item) => item.action === 'project.revision.restore')
        .length,
      1,
    );
  });
  test(`Lab updatedAt preserves ${name}`, async () => {
    const snapshot = lab(`lab-date-${name.toLowerCase().replaceAll(' ', '-')}`);
    snapshot.updatedAt = value;
    const { revision, after } = await restoreFixture('lab', snapshot, true);
    assert.equal(
      after.labs[0].updatedAt?.getTime() ?? null,
      value === null ? null : new Date('2025-07-12T00:00:00.000Z').getTime(),
    );
    assert.equal(
      after.revisions.find((item) => item.id === revision.id)?.snapshot
        .updatedAt,
      value,
    );
    assert.equal(
      after.revisions.find((item) => item.restoredFromId === revision.id)
        ?.entityId,
      snapshot.id,
    );
    assert.equal(
      after.audit.filter((item) => item.action === 'lab.revision.restore')
        .length,
      1,
    );
  });
}

for (const [field, malformed] of [
  ['projectDate', 'not-a-date'],
  ['projectDate', {}],
  ['projectDate', []],
  ['projectDate', true],
  ['projectDate', '2026-02-30T00:00:00.000Z'],
] as const) {
  test(`Project rejects malformed ${field}: ${JSON.stringify(malformed)}`, async () => {
    const snapshot: Record<string, unknown> = project('invalid-project-date');
    snapshot[field] = malformed;
    await restoreFixture('project', snapshot, false);
  });
}

for (const malformed of [
  'not-a-date',
  {},
  [],
  true,
  '2026-02-30T00:00:00.000Z',
]) {
  test(`Lab rejects malformed updatedAt: ${JSON.stringify(malformed)}`, async () => {
    const snapshot: Record<string, unknown> = lab('invalid-lab-date');
    snapshot.updatedAt = malformed;
    await restoreFixture('lab', snapshot, false);
  });
}

test('pre-0012 Project snapshot without screenshots restores an empty collection', async () => {
  const snapshot: Record<string, unknown> = project('no-screenshots');
  delete snapshot.screenshots;
  delete snapshot.projectDate;
  const { revision, after } = await restoreFixture('project', snapshot, true);
  assert.deepEqual(after.projects[0].screenshots, []);
  assert.equal(
    'screenshots' in
      (after.revisions.find((item) => item.id === revision.id)?.snapshot ?? {}),
    false,
  );
});

test('non-object historical snapshot fails normalization without changing any table', async () => {
  await reset();
  const id = 'invalid-snapshot-root';
  await getDatabase()
    .insert(schema.projectRecords)
    .values(project(id) as never);
  const revision = revisionValues(
    actor,
    'project',
    id,
    [] as unknown as Record<string, unknown>,
  );
  await getDatabase().insert(schema.contentRevisions).values(revision);
  const before = await state();
  assert.equal(
    await restoreContentRevision(actor, 'project', id, revision.id, mdx),
    false,
  );
  assert.deepEqual(await state(), before);
});

test('older private Project remains private while its prior public slug is reserved', async () => {
  const snapshot: Record<string, unknown> = project('private-old-project');
  delete snapshot.projectDate;
  delete snapshot.screenshots;
  snapshot.visible = false;
  const { after } = await restoreFixture('project', snapshot, true);
  assert.equal(after.projects[0].visible, false);
  assert.deepEqual(
    after.redirects.map(({ fromPath, toPath }) => ({ fromPath, toPath })),
    [
      {
        fromPath: '/projects/private-old-project-current',
        toPath: '/projects/private-old-project-old',
      },
    ],
  );
});

test('existing Project screenshots survive restoration', async () => {
  const snapshot = project('has-screenshots');
  snapshot.screenshots = [
    { src: '/images/screen.webp', alt: 'Screen', caption: 'Earlier' },
  ];
  const { after } = await restoreFixture('project', snapshot, true);
  assert.deepEqual(after.projects[0].screenshots, snapshot.screenshots);
});

const invalidProjects: Array<
  [string, (snapshot: Record<string, unknown>) => void]
> = [
  [
    'missing title',
    (snapshot) => {
      delete snapshot.title;
    },
  ],
  [
    'string visibility',
    (snapshot) => {
      snapshot.visible = 'false';
    },
  ],
  [
    'malformed screenshots',
    (snapshot) => {
      snapshot.screenshots = [{ src: 'javascript:alert(1)', alt: 'Bad' }];
    },
  ],
  [
    'unsafe link',
    (snapshot) => {
      snapshot.links = [
        { label: 'Bad', href: 'javascript:alert(1)', external: true },
      ];
    },
  ],
];
for (const [name, mutate] of invalidProjects) {
  test(`Project compatibility rejects ${name} without changing database state`, async () => {
    const snapshot: Record<string, unknown> = project(
      `invalid-project-${name.replaceAll(' ', '-')}`,
    );
    delete snapshot.projectDate;
    mutate(snapshot);
    await restoreFixture('project', snapshot, false);
  });
}

const invalidLabs: Array<
  [string, (snapshot: Record<string, unknown>) => void]
> = [
  [
    'missing required date',
    (snapshot) => {
      delete snapshot.date;
    },
  ],
  [
    'unknown status',
    (snapshot) => {
      snapshot.status = 'Unknown';
    },
  ],
  [
    'string visibility',
    (snapshot) => {
      snapshot.visible = 'false';
    },
  ],
];
for (const [name, mutate] of invalidLabs) {
  test(`Lab compatibility rejects ${name} without changing database state`, async () => {
    const snapshot: Record<string, unknown> = lab(
      `invalid-lab-${name.replaceAll(' ', '-')}`,
    );
    delete snapshot.updatedAt;
    mutate(snapshot);
    await restoreFixture('lab', snapshot, false);
  });
}

type OtherType =
  'blog' | 'note' | 'homepage_settings' | 'site_settings' | 'now_status';
function otherSnapshot(type: OtherType, id: string): Record<string, unknown> {
  if (type === 'blog' || type === 'note') {
    return {
      id,
      slug: `${id}-old`,
      title: 'Earlier entry',
      description: 'Earlier description',
      summary: null,
      category: 'Testing',
      tags: [],
      body: '# Earlier entry',
      published: true,
      featured: false,
      createdAt: date,
      updatedAt: date,
      ...(type === 'blog'
        ? { cover: null, archived: false }
        : { replacesMdx: false }),
    };
  }
  if (type === 'homepage_settings') return { id, ...defaultHomepageConfig };
  if (type === 'site_settings') {
    return {
      id,
      siteName: 'Earlier site',
      name: 'Earlier owner',
      seoDescription: 'Earlier SEO description',
      github: 'https://github.com/example',
      email: 'owner@example.test',
    };
  }
  return {
    id,
    currentFocus: 'Earlier focus',
    workingOn: [],
    learning: [],
    using: [],
    statusNote: null,
    published: false,
  };
}

async function restoreOther(
  type: OtherType,
  snapshot: Record<string, unknown>,
  expected: boolean,
  mdxSlugs = mdx,
) {
  await reset();
  const id = snapshot.id as string;
  const current = otherSnapshot(type, id);
  if ('slug' in current) current.slug = `${id}-current`;
  const db = getDatabase();
  if (type === 'blog')
    await db.insert(schema.blogRecords).values(current as never);
  if (type === 'note')
    await db.insert(schema.noteRecords).values(current as never);
  if (type === 'homepage_settings')
    await db
      .insert(schema.homepageSettings)
      .values({ id, settings: current, updatedAt: date });
  if (type === 'site_settings')
    await db
      .insert(schema.siteSettings)
      .values({ id, settings: current, updatedAt: date });
  if (type === 'now_status')
    await db
      .insert(schema.nowStatus)
      .values({ ...current, updatedAt: date } as never);
  const revision = revisionValues(actor, type, id, snapshot);
  await db.insert(schema.contentRevisions).values(revision);
  const before = await state();
  assert.equal(
    await restoreContentRevision(actor, type, id, revision.id, mdxSlugs),
    expected,
  );
  const after = await state();
  if (!expected) assert.deepEqual(after, before);
  else {
    assert.equal(
      after.revisions.find((item) => item.id === revision.id)?.snapshot.id,
      id,
    );
    assert.equal(
      after.revisions.filter((item) => item.restoredFromId === revision.id)
        .length,
      1,
    );
    assert.equal(
      after.audit.filter((item) => item.action === `${type}.revision.restore`)
        .length,
      1,
    );
  }
  return { before, after, revision };
}

for (const type of [
  'blog',
  'note',
  'homepage_settings',
  'site_settings',
  'now_status',
] as const) {
  test(`${type} historical snapshot remains restorable`, async () => {
    const id =
      type.includes('settings') || type === 'now_status'
        ? 'primary'
        : `${type}-historical`;
    const snapshot = otherSnapshot(type, id);
    const { after, revision } = await restoreOther(type, snapshot, true);
    assert.deepEqual(
      after.revisions.find((item) => item.id === revision.id)?.snapshot,
      JSON.parse(JSON.stringify(snapshot)),
    );
  });
}

test('older Homepage snapshot without later affiliation and credential fields remains restorable', async () => {
  const snapshot = otherSnapshot('homepage_settings', 'primary');
  delete snapshot.affiliations;
  delete snapshot.credentials;
  const { after, revision } = await restoreOther(
    'homepage_settings',
    snapshot,
    true,
  );
  const source = after.revisions.find(
    (item) => item.id === revision.id,
  )?.snapshot;
  assert.equal('affiliations' in (source ?? {}), false);
  assert.equal('credentials' in (source ?? {}), false);
});

const invalidOthers: Array<
  [OtherType, string, (s: Record<string, unknown>) => void]
> = [
  [
    'blog',
    'missing required title',
    (s) => {
      delete s.title;
    },
  ],
  [
    'blog',
    'empty published body',
    (s) => {
      s.body = '';
    },
  ],
  [
    'blog',
    'malformed archive flag',
    (s) => {
      s.archived = 'false';
    },
  ],
  [
    'note',
    'missing required description',
    (s) => {
      delete s.description;
    },
  ],
  [
    'note',
    'empty published body',
    (s) => {
      s.body = '';
    },
  ],
  [
    'homepage_settings',
    'malformed nested cards',
    (s) => {
      s.cards = { project: { visible: 'true' } };
    },
  ],
  [
    'site_settings',
    'missing name',
    (s) => {
      delete s.name;
    },
  ],
  [
    'now_status',
    'string publication flag',
    (s) => {
      s.published = 'false';
    },
  ],
];
for (const [type, name, mutate] of invalidOthers) {
  test(`${type} rejects ${name} without changing any table`, async () => {
    const id =
      type.includes('settings') || type === 'now_status'
        ? 'primary'
        : `${type}-invalid`;
    const snapshot = otherSnapshot(type, id);
    mutate(snapshot);
    await restoreOther(type, snapshot, false);
  });
}

test('Note MDX claim still requires explicit replacement intent', async () => {
  const snapshot = otherSnapshot('note', 'note-mdx');
  snapshot.slug = 'reserved';
  await restoreOther('note', snapshot, false, {
    project: [],
    note: ['reserved'],
    lab: [],
  });
  snapshot.replacesMdx = true;
  await restoreOther('note', snapshot, true, {
    project: [],
    note: ['reserved'],
    lab: [],
  });
});

test.after(async () => {
  closeDatabase();
  await rm(directory, { recursive: true, force: true });
});
