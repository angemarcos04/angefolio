import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const directory = await mkdtemp(
  join(
    existsSync('/dev/shm') ? '/dev/shm' : tmpdir(),
    'angefolio-revision-validation-',
  ),
);
process.env.NODE_ENV = 'test';
delete process.env.TURSO_AUTH_TOKEN;
process.env.DATABASE_URL = `file:${join(directory, 'validation.sqlite')}`;

const { getDatabase, migrateDatabase, closeDatabase } =
  await import('../src/lib/server/db/client');
const schema = await import('../src/lib/server/db/schema');
const { revisionValues, restoreContentRevision } =
  await import('../src/lib/server/revisions');
const { defaultHomepageConfig } = await import('../src/lib/data/homepage');
const actor = 'revision-validation-owner';
const mdx = { project: [], note: [], lab: [] } as const;
const date = new Date('2026-01-01T00:00:00.000Z');

function base(type: string, id: string): Record<string, unknown> {
  const common = {
    id,
    slug: `${id}-snapshot`,
    title: 'Restored title',
    description: 'Restored description',
  };
  switch (type) {
    case 'project':
      return {
        ...common,
        status: 'Prototype',
        category: null,
        role: null,
        problem: null,
        solution: null,
        stack: [],
        links: [],
        github: null,
        demo: null,
        caseStudyBody: '# Body',
        projectDate: null,
        highlights: [],
        cover: null,
        screenshots: [],
        replacesMdx: false,
        featured: false,
        visible: true,
        archived: false,
        statusBeforeArchive: null,
        orderIndex: null,
        createdAt: date,
        updatedAt: date,
      };
    case 'blog':
      return {
        ...common,
        summary: null,
        cover: null,
        category: 'Testing',
        tags: [],
        body: '# Body',
        published: true,
        featured: false,
        archived: false,
        createdAt: date,
        updatedAt: date,
      };
    case 'note':
      return {
        ...common,
        summary: null,
        category: 'Testing',
        tags: [],
        body: '# Body',
        published: true,
        featured: false,
        replacesMdx: false,
        createdAt: date,
        updatedAt: date,
      };
    case 'lab':
      return {
        ...common,
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
        body: '# Body',
        replacesMdx: false,
        date,
        updatedAt: null,
      };
    case 'homepage_settings':
      return { id, ...defaultHomepageConfig };
    case 'site_settings':
      return {
        id,
        siteName: 'Angefolio',
        name: 'Owner',
        seoDescription: 'Description',
        github: 'https://github.com/example',
        email: 'owner@example.test',
      };
    case 'now_status':
      return {
        id,
        currentFocus: 'Focus',
        workingOn: [],
        learning: [],
        using: [],
        statusNote: null,
        published: false,
      };
    default:
      throw new Error(type);
  }
}

async function state() {
  const db = getDatabase();
  return {
    project: await db
      .select()
      .from(schema.projectRecords)
      .orderBy(schema.projectRecords.id),
    blog: await db
      .select()
      .from(schema.blogRecords)
      .orderBy(schema.blogRecords.id),
    note: await db
      .select()
      .from(schema.noteRecords)
      .orderBy(schema.noteRecords.id),
    lab: await db
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

async function fixture(
  type: string,
  snapshot: Record<string, unknown>,
  current: Record<string, unknown>,
  revisionActor: string | null = actor,
) {
  const db = getDatabase();
  switch (type) {
    case 'project':
      await db.insert(schema.projectRecords).values(current as never);
      break;
    case 'blog':
      await db.insert(schema.blogRecords).values(current as never);
      break;
    case 'note':
      await db.insert(schema.noteRecords).values(current as never);
      break;
    case 'lab':
      await db.insert(schema.labRecords).values(current as never);
      break;
    case 'homepage_settings':
      await db
        .insert(schema.homepageSettings)
        .values({ id: 'primary', settings: current, updatedAt: date });
      break;
    case 'site_settings':
      await db
        .insert(schema.siteSettings)
        .values({ id: 'primary', settings: current, updatedAt: date });
      break;
    case 'now_status':
      await db
        .insert(schema.nowStatus)
        .values({ ...current, updatedAt: date } as never);
      break;
  }
  const revision = revisionValues(
    revisionActor,
    type as never,
    String(snapshot.id),
    snapshot,
  );
  await db.insert(schema.contentRevisions).values(revision);
  return revision;
}

let fixtureNumber = 0;
async function reset() {
  closeDatabase();
  process.env.DATABASE_URL = `file:${join(directory, `case-${fixtureNumber++}.sqlite`)}`;
  await migrateDatabase();
  await getDatabase().insert(schema.user).values({
    id: actor,
    name: 'Owner',
    email: 'revision-owner@example.test',
    emailVerified: true,
    createdAt: date,
    updatedAt: date,
  });
}

const failures: Array<
  [string, string, (snapshot: Record<string, unknown>) => void]
> = [
  [
    'blog',
    'missing required title',
    (s) => {
      delete s.title;
    },
  ],
  [
    'project',
    'string visible flag',
    (s) => {
      s.visible = 'false';
    },
  ],
  [
    'project',
    'unsafe link destination',
    (s) => {
      s.links = [
        { label: 'Documentation', href: 'javascript:alert(1)', external: true },
      ];
    },
  ],
  [
    'lab',
    'unsupported status',
    (s) => {
      s.status = 'Unknown';
    },
  ],
  [
    'note',
    'nonnumeric tag item',
    (s) => {
      s.tags = ['valid', 123];
    },
  ],
  [
    'project',
    'missing title',
    (s) => {
      delete s.title;
    },
  ],
  [
    'project',
    'nonstr description',
    (s) => {
      s.description = 42;
    },
  ],
  [
    'project',
    'unsupported status',
    (s) => {
      s.status = 'Unknown';
    },
  ],
  [
    'project',
    'string archived flag',
    (s) => {
      s.archived = 'false';
    },
  ],
  [
    'project',
    'string featured flag',
    (s) => {
      s.featured = 1;
    },
  ],
  [
    'project',
    'nonarray links',
    (s) => {
      s.links = {};
    },
  ],
  [
    'project',
    'malformed link object',
    (s) => {
      s.links = [{ label: 1, href: 'https://example.test', external: true }];
    },
  ],
  [
    'project',
    'protocol relative internal link',
    (s) => {
      s.links = [
        { label: 'Bad', href: '//example.test/path', external: false },
      ];
    },
  ],
  [
    'project',
    'encoded internal separator',
    (s) => {
      s.links = [
        { label: 'Bad', href: '/%2f%2fevil.example/path', external: false },
      ];
    },
  ],
  [
    'project',
    'malformed internal escape',
    (s) => {
      s.links = [{ label: 'Bad', href: '/%GG', external: false }];
    },
  ],
  [
    'project',
    'too many stack entries',
    (s) => {
      s.stack = Array.from({ length: 21 }, (_, i) => `item${i}`);
    },
  ],
  [
    'project',
    'empty stack item',
    (s) => {
      s.stack = [''];
    },
  ],
  [
    'project',
    'invalid screenshot structure',
    (s) => {
      s.screenshots = [{ src: '/image.png', alt: 3 }];
    },
  ],
  [
    'project',
    'null screenshot caption',
    (s) => {
      s.screenshots = [{ src: '/image.png', alt: 'Screen', caption: null }];
    },
  ],
  [
    'project',
    'duplicate screenshot source',
    (s) => {
      s.screenshots = [
        { src: '/image.png', alt: 'One' },
        { src: '/image.png', alt: 'Two' },
      ];
    },
  ],
  [
    'project',
    'unsafe cover reference',
    (s) => {
      s.cover = 'javascript:alert(1)';
    },
  ],
  [
    'project',
    'invalid order index',
    (s) => {
      s.orderIndex = 10001;
    },
  ],
  [
    'project',
    'invalid project date',
    (s) => {
      s.projectDate = 'not a date';
    },
  ],
  [
    'project',
    'invalid project date type',
    (s) => {
      s.projectDate = [];
    },
  ],
  [
    'project',
    'invalid archive status',
    (s) => {
      s.statusBeforeArchive = 'Unknown';
    },
  ],
  [
    'project',
    'empty visible MDX replacement',
    (s) => {
      s.replacesMdx = true;
      s.caseStudyBody = '';
    },
  ],
  [
    'blog',
    'invalid description',
    (s) => {
      s.description = '';
    },
  ],
  [
    'blog',
    'invalid category',
    (s) => {
      s.category = null;
    },
  ],
  [
    'blog',
    'long summary',
    (s) => {
      s.summary = 'x'.repeat(501);
    },
  ],
  [
    'blog',
    'malformed tags',
    (s) => {
      s.tags = ['good', 123];
    },
  ],
  [
    'blog',
    'empty tag',
    (s) => {
      s.tags = [''];
    },
  ],
  [
    'blog',
    'long tag',
    (s) => {
      s.tags = ['x'.repeat(41)];
    },
  ],
  [
    'blog',
    'string published flag',
    (s) => {
      s.published = 'false';
    },
  ],
  [
    'blog',
    'string archived flag',
    (s) => {
      s.archived = 'false';
    },
  ],
  [
    'blog',
    'empty published body',
    (s) => {
      s.body = '  ';
    },
  ],
  [
    'blog',
    'unsafe cover',
    (s) => {
      s.cover = 'data:image/svg+xml,evil';
    },
  ],
  [
    'blog',
    'impossible calendar date',
    (s) => {
      s.createdAt = '2026-02-30T00:00:00.000Z';
    },
  ],
  [
    'note',
    'missing required metadata',
    (s) => {
      delete s.category;
    },
  ],
  [
    'note',
    'empty tag',
    (s) => {
      s.tags = [''];
    },
  ],
  [
    'note',
    'string published flag',
    (s) => {
      s.published = 'false';
    },
  ],
  [
    'note',
    'string MDX replacement flag',
    (s) => {
      s.replacesMdx = 'false';
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
    'lab',
    'unsupported risk',
    (s) => {
      s.risk = 'Critical';
    },
  ],
  [
    'lab',
    'invalid tool entry',
    (s) => {
      s.tools = ['Astro', 123];
    },
  ],
  [
    'lab',
    'invalid lesson entry',
    (s) => {
      s.lessons = [''];
    },
  ],
  [
    'lab',
    'unsafe repository URL',
    (s) => {
      s.repo = 'javascript:alert(1)';
    },
  ],
  [
    'lab',
    'string visible flag',
    (s) => {
      s.visible = 'false';
    },
  ],
  [
    'lab',
    'empty visible body',
    (s) => {
      s.body = '';
    },
  ],
  [
    'lab',
    'invalid date',
    (s) => {
      s.date = 'garbage';
    },
  ],
  [
    'lab',
    'invalid related project',
    (s) => {
      s.relatedProject = 'data:text/html,x';
    },
  ],
  [
    'homepage_settings',
    'malformed nested card',
    (s) => {
      s.cards = {
        ...(s.cards as object),
        about: {
          visible: 'false',
          title: 'Title',
          eyebrow: 'Eyebrow',
          description: '',
        },
      };
    },
  ],
  [
    'homepage_settings',
    'invalid roles array contents',
    (s) => {
      s.heroRoles = ['Developer', 123];
    },
  ],
  [
    'homepage_settings',
    'invalid stack item',
    (s) => {
      s.stackGroups = [{ title: 'Stack', items: [''] }];
    },
  ],
  [
    'homepage_settings',
    'invalid affiliation',
    (s) => {
      s.affiliations = [
        {
          name: 'Company',
          relationship: 'Member',
          logo: 'javascript:alert(1)',
        },
      ];
    },
  ],
  [
    'homepage_settings',
    'null affiliation collection',
    (s) => {
      s.affiliations = null;
    },
  ],
  [
    'homepage_settings',
    'null affiliation URL',
    (s) => {
      s.affiliations = [
        {
          name: 'Company',
          relationship: 'Member',
          logo: '/logo.png',
          url: null,
        },
      ];
    },
  ],
  [
    'homepage_settings',
    'invalid credential',
    (s) => {
      s.credentials = [
        { id: 'one', title: 'Badge', issuer: 'Issuer', type: 'unknown' },
      ];
    },
  ],
  [
    'site_settings',
    'invalid site name',
    (s) => {
      s.siteName = '';
    },
  ],
  [
    'site_settings',
    'invalid GitHub URL',
    (s) => {
      s.github = 'https://evil.test/owner';
    },
  ],
  [
    'site_settings',
    'invalid contact email',
    (s) => {
      s.email = 'invalid';
    },
  ],
  [
    'now_status',
    'string published flag',
    (s) => {
      s.published = 'false';
    },
  ],
  [
    'now_status',
    'invalid array item',
    (s) => {
      s.workingOn = ['Work', 123];
    },
  ],
  [
    'now_status',
    'too many array items',
    (s) => {
      s.learning = Array.from({ length: 13 }, (_, i) => `item${i}`);
    },
  ],
];

for (const [type, name, mutate] of failures) {
  test(`${type}: rejects ${name} without changing any table`, async () => {
    await reset();
    const id =
      type.includes('settings') || type === 'now_status'
        ? 'primary'
        : `${type}-${name.replaceAll(' ', '-')}`;
    const current = base(type, id);
    const snapshot = base(type, id);
    if ('slug' in current) current.slug = `${id}-current`;
    mutate(snapshot);
    const revision = await fixture(type, snapshot, current);
    const before = await state();
    assert.equal(
      await restoreContentRevision(actor, type as never, id, revision.id, mdx),
      false,
    );
    assert.deepEqual(await state(), before);
  });
}

const successes: Array<
  [string, string, (snapshot: Record<string, unknown>) => void]
> = [
  [
    'project',
    'complete project with legacy internal link and screenshot',
    (s) => {
      s.links = [
        { label: 'Details', href: '/projects/internal', external: false },
        { label: 'Details', href: '/projects/internal', external: false },
      ];
      s.screenshots = [
        { src: '/images/screen.webp', alt: 'Screen', caption: 'Caption' },
      ];
    },
  ],
  [
    'project',
    'historical project without screenshot field',
    (s) => {
      delete s.screenshots;
    },
  ],
  [
    'blog',
    'unpublished empty draft',
    (s) => {
      s.published = false;
      s.body = '';
    },
  ],
  ['blog', 'published post', () => {}],
  [
    'note',
    'unpublished empty draft',
    (s) => {
      s.published = false;
      s.body = '';
    },
  ],
  ['note', 'published note', () => {}],
  [
    'lab',
    'hidden empty draft',
    (s) => {
      s.visible = false;
      s.body = '';
    },
  ],
  ['lab', 'visible experiment', () => {}],
  [
    'homepage_settings',
    'complete homepage',
    (s) => {
      s.heroName = 'Restored homepage';
    },
  ],
  [
    'homepage_settings',
    'older homepage without affiliations or credentials',
    (s) => {
      delete s.affiliations;
      delete s.credentials;
    },
  ],
  [
    'site_settings',
    'site settings',
    (s) => {
      s.siteName = 'Restored site';
    },
  ],
  [
    'now_status',
    'unpublished Now status',
    (s) => {
      s.currentFocus = 'Restored focus';
    },
  ],
];

for (const [type, name, mutate] of successes) {
  test(`${type}: restores ${name} with revision and audit`, async () => {
    await reset();
    const id =
      type.includes('settings') || type === 'now_status'
        ? 'primary'
        : `${type}-valid`;
    const current = base(type, id);
    const snapshot = base(type, id);
    if ('slug' in current) current.slug = `${id}-current`;
    mutate(snapshot);
    const revision = await fixture(type, snapshot, current);
    const before = await state();
    assert.equal(
      await restoreContentRevision(actor, type as never, id, revision.id, mdx),
      true,
    );
    const after = await state();
    assert.equal(after.revisions.length, before.revisions.length + 1);
    assert.ok(after.audit.length >= before.audit.length + 1);
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
    assert.deepEqual(after.media, before.media);
  });
}

for (const type of ['project', 'note', 'lab', 'now_status'] as const) {
  test(`${type}: restores migration 0006 integer booleans without rewriting source revision`, async () => {
    await reset();
    const id = type === 'now_status' ? 'primary' : `${type}-legacy`;
    const current = base(type, id);
    const snapshot = base(type, id);
    if ('slug' in current) current.slug = `${id}-current`;
    const seconds = date.getTime() / 1000;
    if (type === 'project') {
      delete snapshot.screenshots;
      snapshot.createdAt = seconds;
      snapshot.updatedAt = seconds;
      snapshot.featured = 0;
      snapshot.visible = 1;
      snapshot.archived = 0;
      snapshot.replacesMdx = 0;
    } else if (type === 'note') {
      snapshot.createdAt = seconds;
      snapshot.updatedAt = seconds;
      snapshot.published = 1;
      snapshot.featured = 0;
      snapshot.replacesMdx = 0;
    } else if (type === 'lab') {
      snapshot.date = seconds;
      snapshot.updatedAt = seconds;
      snapshot.visible = 1;
      snapshot.featured = 0;
      snapshot.replacesMdx = 0;
    } else {
      snapshot.updatedAt = seconds;
      snapshot.published = 1;
    }
    const revision = await fixture(type, snapshot, current, null);
    const before = await state();
    assert.equal(
      await restoreContentRevision(actor, type, id, revision.id, mdx),
      true,
    );
    const after = await state();
    assert.deepEqual(
      after.revisions.find((item) => item.id === revision.id)?.snapshot,
      before.revisions.find((item) => item.id === revision.id)?.snapshot,
    );
    if (type === 'project') assert.equal(after.project[0].visible, true);
    else if (type === 'note') assert.equal(after.note[0].published, true);
    else if (type === 'lab') assert.equal(after.lab[0].visible, true);
    else assert.equal(after.now[0].published, true);
  });
}

for (const malformed of ['false', 2]) {
  test(`migration-shaped Project rejects ${JSON.stringify(malformed)} visibility`, async () => {
    await reset();
    const id = 'project-malformed-legacy';
    const current = base('project', id);
    const snapshot = base('project', id);
    current.slug = `${id}-current`;
    snapshot.createdAt = date.getTime() / 1000;
    snapshot.visible = malformed;
    const revision = await fixture('project', snapshot, current, null);
    const before = await state();
    assert.equal(
      await restoreContentRevision(actor, 'project', id, revision.id, mdx),
      false,
    );
    assert.deepEqual(await state(), before);
  });
}

test('invalid restore does not prune a full revision history', async () => {
  await reset();
  const id = 'blog-pruning';
  const current = base('blog', id);
  const bad = base('blog', id);
  delete bad.title;
  const badRevision = await fixture('blog', bad, current);
  const db = getDatabase();
  for (let i = 0; i < 50; i++) {
    await db
      .insert(schema.contentRevisions)
      .values(revisionValues(actor, 'blog', id, base('blog', id)));
  }
  const before = await state();
  assert.equal(before.revisions.length, 51);
  assert.equal(
    await restoreContentRevision(actor, 'blog', id, badRevision.id, mdx),
    false,
  );
  assert.deepEqual(await state(), before);
});

test.after(async () => {
  closeDatabase();
  await rm(directory, { recursive: true, force: true });
});
