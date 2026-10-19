import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import test from 'node:test';

const directory = await mkdtemp(
  join(tmpdir(), 'angefolio-revision-atomicity-'),
);
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = `file:${join(directory, 'portfolio.sqlite')}`;

const { getDatabase, migrateDatabase, closeDatabase } =
  await import('../src/lib/server/db/client');
const {
  auditLog,
  blogRecords,
  contentRedirects,
  contentRevisions,
  homepageSettings,
  labRecords,
  mediaAssets,
  noteRecords,
  nowStatus,
  projectRecords,
  siteSettings,
  user,
} = await import('../src/lib/server/db/schema');
const {
  revisionValues,
  restoreContentRevision: restoreContentRevisionWithMdx,
} = await import('../src/lib/server/revisions');
const { defaultHomepageConfig } = await import('../src/lib/data/homepage');

const actor = 'revision-atomicity-owner';
const emptyMdxSlugs = { project: [], note: [], lab: [] } as const;

function restoreContentRevision(
  actorId: string,
  type: Parameters<typeof restoreContentRevisionWithMdx>[1],
  entityId: string,
  revisionId: string,
) {
  return restoreContentRevisionWithMdx(
    actorId,
    type,
    entityId,
    revisionId,
    emptyMdxSlugs,
  );
}

async function resetDatabase(name: string) {
  closeDatabase();
  process.env.DATABASE_URL = `file:${join(directory, name)}`;
  await migrateDatabase();
  const database = getDatabase();
  const now = new Date('2026-01-01T00:00:00.000Z');
  await database.insert(user).values({
    id: actor,
    name: 'Revision Test Owner',
    email: 'revision-owner@example.test',
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  return { database, now };
}

function contentSnapshot(
  type: 'project' | 'blog' | 'note' | 'lab',
  id: string,
  slug: string,
  title: string,
  now: Date,
): Record<string, unknown> {
  const common = { id, slug, title, description: `${title} description` };
  if (type === 'project')
    return {
      ...common,
      status: 'Prototype',
      category: 'Testing',
      role: 'Owner',
      problem: 'Problem',
      solution: 'Solution',
      stack: ['Astro'],
      links: [],
      github: null,
      demo: null,
      caseStudyBody: '# Case study',
      projectDate: null,
      highlights: ['Restored highlight'],
      cover: null,
      screenshots: [],
      replacesMdx: false,
      featured: false,
      visible: true,
      archived: false,
      statusBeforeArchive: null,
      orderIndex: 2,
      createdAt: now,
      updatedAt: now,
    };
  if (type === 'blog')
    return {
      ...common,
      summary: 'Restored summary',
      category: 'Testing',
      tags: ['atomicity'],
      cover: null,
      body: '# Restored body',
      published: true,
      featured: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
  if (type === 'note')
    return {
      ...common,
      summary: 'Restored summary',
      category: 'Testing',
      tags: ['atomicity'],
      body: '# Restored body',
      published: true,
      featured: false,
      replacesMdx: false,
      createdAt: now,
      updatedAt: now,
    };
  return {
    ...common,
    status: 'Idea',
    category: 'Testing',
    tags: ['atomicity'],
    visible: true,
    featured: false,
    repo: null,
    demo: null,
    relatedProject: null,
    tools: ['Astro'],
    lessons: ['Transactions'],
    risk: 'Low',
    body: '# Restored body',
    replacesMdx: false,
    date: now,
    updatedAt: now,
  };
}

async function insertContent(
  type: 'project' | 'blog' | 'note' | 'lab',
  record: Record<string, unknown>,
) {
  const database = getDatabase();
  switch (type) {
    case 'project':
      await database.insert(projectRecords).values(record as never);
      break;
    case 'blog':
      await database.insert(blogRecords).values(record as never);
      break;
    case 'note':
      await database.insert(noteRecords).values(record as never);
      break;
    case 'lab':
      await database.insert(labRecords).values(record as never);
      break;
  }
}

async function insertRevision(
  type: 'project' | 'blog' | 'note' | 'lab',
  entityId: string,
  snapshot: Record<string, unknown>,
) {
  const revision = revisionValues(actor, type, entityId, snapshot);
  await getDatabase().insert(contentRevisions).values(revision);
  return revision;
}

async function databaseSnapshot() {
  const database = getDatabase();
  return {
    projects: await database
      .select()
      .from(projectRecords)
      .orderBy(projectRecords.id),
    blogs: await database.select().from(blogRecords).orderBy(blogRecords.id),
    notes: await database.select().from(noteRecords).orderBy(noteRecords.id),
    labs: await database.select().from(labRecords).orderBy(labRecords.id),
    media: await database.select().from(mediaAssets).orderBy(mediaAssets.id),
    homepage: await database
      .select()
      .from(homepageSettings)
      .orderBy(homepageSettings.id),
    site: await database.select().from(siteSettings).orderBy(siteSettings.id),
    now: await database.select().from(nowStatus).orderBy(nowStatus.id),
    redirects: await database
      .select()
      .from(contentRedirects)
      .orderBy(contentRedirects.fromPath),
    revisions: await database
      .select()
      .from(contentRevisions)
      .orderBy(contentRevisions.id),
    audit: await database.select().from(auditLog).orderBy(auditLog.id),
  };
}

test('a duplicate-slug Blog restore leaves its full database snapshot unchanged', async () => {
  await migrateDatabase();
  const database = getDatabase();
  const now = new Date('2026-01-01T00:00:00.000Z');
  const actor = 'revision-atomicity-owner';
  await database.insert(user).values({
    id: actor,
    name: 'Revision Test Owner',
    email: 'revision-owner@example.test',
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });

  const priorSnapshot = {
    id: 'blog-a',
    slug: 'alpha',
    title: 'Alpha before rename',
    description: 'Original published post.',
    summary: 'Original summary.',
    category: 'Testing',
    tags: ['atomicity'],
    cover: null,
    body: '# Alpha',
    published: true,
    featured: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
  };

  await database.insert(blogRecords).values([
    {
      ...priorSnapshot,
      slug: 'beta',
      title: 'Beta current',
      body: '# Beta',
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    },
    {
      ...priorSnapshot,
      id: 'blog-b',
      slug: 'alpha',
      title: 'Alpha belongs to Blog B',
      body: '# Blog B',
    },
  ]);
  const revision = revisionValues(actor, 'blog', 'blog-a', priorSnapshot);
  await database.insert(contentRevisions).values(revision);

  const state = async () => ({
    posts: await database.select().from(blogRecords).orderBy(blogRecords.id),
    redirects: await database
      .select()
      .from(contentRedirects)
      .orderBy(contentRedirects.fromPath),
    revisions: await database
      .select()
      .from(contentRevisions)
      .orderBy(contentRevisions.id),
    audit: await database.select().from(auditLog).orderBy(auditLog.id),
  });
  const before = await state();

  const restored = await restoreContentRevision(
    actor,
    'blog',
    'blog-a',
    revision.id,
  );

  assert.equal(restored, false);
  assert.deepEqual(await state(), before);
});

test('duplicate-slug restores for every content collection leave all rows unchanged', async () => {
  const { now } = await resetDatabase('all-content-conflicts.sqlite');
  const types = ['project', 'blog', 'note', 'lab'] as const;

  for (const type of types) {
    const entityId = `${type}-a`;
    const prior = contentSnapshot(
      type,
      entityId,
      'alpha',
      `${type} before rename`,
      now,
    );
    await insertContent(
      type,
      contentSnapshot(type, entityId, 'beta', `${type} current`, now),
    );
    await insertContent(
      type,
      contentSnapshot(type, `${type}-b`, 'alpha', `${type} owns alpha`, now),
    );
    const revision = await insertRevision(type, entityId, prior);
    const before = await databaseSnapshot();

    assert.equal(
      await restoreContentRevision(actor, type, entityId, revision.id),
      false,
    );
    assert.deepEqual(await databaseSnapshot(), before, `${type} state changed`);
  }
});

test('successful content restores commit their record, redirect, revision, and audit together', async () => {
  const { now } = await resetDatabase('all-content-success.sqlite');
  const types = ['project', 'blog', 'note', 'lab'] as const;

  for (const type of types) {
    const entityId = `${type}-success`;
    const prior = contentSnapshot(
      type,
      entityId,
      `previous-${type}`,
      `${type} restored title`,
      now,
    );
    await insertContent(
      type,
      contentSnapshot(
        type,
        entityId,
        `current-${type}`,
        `${type} current`,
        now,
      ),
    );
    const revision = await insertRevision(type, entityId, prior);

    assert.equal(
      await restoreContentRevision(actor, type, entityId, revision.id),
      true,
    );
    const state = await databaseSnapshot();
    const row = {
      project: state.projects.find((item) => item.id === entityId),
      blog: state.blogs.find((item) => item.id === entityId),
      note: state.notes.find((item) => item.id === entityId),
      lab: state.labs.find((item) => item.id === entityId),
    }[type];
    assert.equal(row?.slug, `previous-${type}`);
    assert.equal(row?.title, `${type} restored title`);
    assert.equal(
      state.redirects.some(
        (item) =>
          item.fromPath ===
            `/${type === 'project' ? 'projects' : type === 'note' ? 'notes' : type}/${`current-${type}`}` &&
          item.toPath ===
            `/${type === 'project' ? 'projects' : type === 'note' ? 'notes' : type}/${`previous-${type}`}`,
      ),
      true,
    );
    assert.equal(
      state.revisions.some(
        (item) =>
          item.entityId === entityId && item.restoredFromId === revision.id,
      ),
      true,
    );
    assert.equal(
      state.audit.some(
        (item) =>
          item.action === `${type}.revision.restore` &&
          item.entityId === entityId,
      ),
      true,
    );
  }
});

test('late content, revision, and audit failures roll back the full Blog restore', async (t) => {
  for (const stage of ['content', 'revision', 'audit'] as const) {
    await t.test(`${stage} write failure`, async () => {
      const { database, now } = await resetDatabase(`late-${stage}.sqlite`);
      const entityId = `blog-${stage}`;
      const mediaId = '550e8400-e29b-41d4-a716-446655440000';
      await database.insert(mediaAssets).values({
        id: mediaId,
        mimeType: 'image/webp',
        data: Buffer.from('isolated media fixture'),
        createdAt: now,
      });
      const prior = {
        ...contentSnapshot(
          'blog',
          entityId,
          `previous-${stage}`,
          'Blog before failure',
          now,
        ),
        cover: `/media/${mediaId}.webp`,
      };
      await insertContent('blog', {
        ...contentSnapshot(
          'blog',
          entityId,
          `current-${stage}`,
          'Blog current',
          now,
        ),
        cover: `/media/${mediaId}.webp`,
      });
      const revision = await insertRevision('blog', entityId, prior);
      const targetTable =
        stage === 'content'
          ? 'blog_records'
          : stage === 'revision'
            ? 'content_revisions'
            : 'audit_log';
      const triggerBody =
        stage === 'content'
          ? `BEFORE UPDATE ON ${targetTable} WHEN OLD.id = '${entityId}'`
          : stage === 'revision'
            ? `BEFORE INSERT ON ${targetTable} WHEN NEW.restored_from_id IS NOT NULL`
            : `BEFORE INSERT ON ${targetTable} WHEN NEW.action = 'blog.revision.restore'`;
      await database.$client.execute(
        `CREATE TRIGGER fail_restore_${stage} ${triggerBody} BEGIN SELECT RAISE(ABORT, 'injected ${stage} failure'); END`,
      );
      const before = await databaseSnapshot();

      await assert.rejects(
        restoreContentRevision(actor, 'blog', entityId, revision.id),
        (error: unknown) => {
          const message =
            error instanceof Error && error.cause instanceof Error
              ? error.cause.message
              : error instanceof Error
                ? error.message
                : String(error);
          assert.match(message, new RegExp(`injected ${stage} failure`));
          return true;
        },
      );
      assert.deepEqual(await databaseSnapshot(), before);
    });
  }
});

test('invalid revisions, wrong ownership, missing records, and redirect conflicts do not mutate state', async () => {
  const { database, now } = await resetDatabase('invalid-restore.sqlite');
  const entityId = 'blog-invalid';
  const prior = contentSnapshot(
    'blog',
    entityId,
    'previous',
    'Prior title',
    now,
  );
  await insertContent(
    'blog',
    contentSnapshot('blog', entityId, 'current', 'Current title', now),
  );
  const revision = await insertRevision('blog', entityId, prior);

  for (const [requestedEntity, requestedRevision] of [
    [entityId, 'missing-revision'],
    ['other-entity', revision.id],
    ['missing-record', revision.id],
  ] as const) {
    const before = await databaseSnapshot();
    assert.equal(
      await restoreContentRevision(
        actor,
        'blog',
        requestedEntity,
        requestedRevision,
      ),
      false,
    );
    assert.deepEqual(await databaseSnapshot(), before);
  }

  const malformedRevision = revisionValues(actor, 'blog', entityId, {
    id: entityId,
    slug: 'malformed',
    title: 'Malformed snapshot',
    description: 'Invalid tags prevent restoration.',
    createdAt: now,
    tags: 'not-an-array',
  });
  await database.insert(contentRevisions).values(malformedRevision);
  const beforeMalformed = await databaseSnapshot();
  assert.equal(
    await restoreContentRevision(actor, 'blog', entityId, malformedRevision.id),
    false,
  );
  assert.deepEqual(await databaseSnapshot(), beforeMalformed);

  const foreignRevision = await insertRevision(
    'blog',
    'missing-record',
    contentSnapshot('blog', 'missing-record', 'previous', 'Prior title', now),
  );
  const beforeMissing = await databaseSnapshot();
  assert.equal(
    await restoreContentRevision(
      actor,
      'blog',
      'missing-record',
      foreignRevision.id,
    ),
    false,
  );
  assert.deepEqual(await databaseSnapshot(), beforeMissing);

  await database.insert(contentRedirects).values({
    fromPath: '/blog/previous',
    toPath: '/blog/elsewhere',
    entityType: 'blog',
    entityId: 'foreign-owner',
    createdAt: now,
  });
  const beforeConflict = await databaseSnapshot();
  assert.equal(
    await restoreContentRevision(actor, 'blog', entityId, revision.id),
    false,
  );
  assert.deepEqual(await databaseSnapshot(), beforeConflict);
});

test('restoring a private slug repoints owned aliases without creating a private alias', async () => {
  const { database, now } = await resetDatabase(
    'restore-private-rename.sqlite',
  );
  const entityId = 'blog-private-rename';
  await insertContent(
    'blog',
    contentSnapshot('blog', entityId, 'current-private', 'Current', now),
  );
  await database
    .update(blogRecords)
    .set({ published: false })
    .where(eq(blogRecords.id, entityId));
  await database.insert(contentRedirects).values({
    fromPath: '/blog/previously-public',
    toPath: '/blog/current-private',
    entityType: 'blog',
    entityId,
    createdAt: now,
  });
  const revision = await insertRevision('blog', entityId, {
    ...contentSnapshot('blog', entityId, 'restored-private', 'Restored', now),
    published: false,
  });

  assert.equal(
    await restoreContentRevision(actor, 'blog', entityId, revision.id),
    true,
  );
  const record = await database.query.blogRecords.findFirst({
    where: eq(blogRecords.id, entityId),
  });
  assert.equal(record?.slug, 'restored-private');
  assert.equal(record?.published, false);
  assert.deepEqual(
    await database
      .select({
        fromPath: contentRedirects.fromPath,
        toPath: contentRedirects.toPath,
      })
      .from(contentRedirects)
      .where(eq(contentRedirects.entityId, entityId)),
    [{ fromPath: '/blog/previously-public', toPath: '/blog/restored-private' }],
  );

  assert.equal(
    await database
      .select()
      .from(contentRedirects)
      .where(eq(contentRedirects.fromPath, '/blog/current-private'))
      .then((rows) => rows.length),
    0,
  );
});

test('homepage, site, and Now revisions restore successfully', async () => {
  const { database, now } = await resetDatabase('settings-success.sqlite');

  const homepageSnapshot = {
    id: 'primary',
    ...defaultHomepageConfig,
    heroName: 'Restored homepage name',
  };
  await database.insert(homepageSettings).values({
    id: 'primary',
    settings: { ...defaultHomepageConfig, heroName: 'Current homepage name' },
    updatedAt: now,
  });
  const homepageRevision = revisionValues(
    actor,
    'homepage_settings',
    'primary',
    homepageSnapshot,
  );
  await database.insert(contentRevisions).values(homepageRevision);

  const siteSnapshot = {
    id: 'primary',
    siteName: 'Restored site',
    name: 'Restored owner',
    seoDescription: 'Restored description',
    github: 'https://github.com/example-owner',
    email: 'owner@example.test',
  };
  await database.insert(siteSettings).values({
    id: 'primary',
    settings: { ...siteSnapshot, id: undefined, siteName: 'Current site' },
    updatedAt: now,
  });
  const siteRevision = revisionValues(
    actor,
    'site_settings',
    'primary',
    siteSnapshot,
  );
  await database.insert(contentRevisions).values(siteRevision);

  const nowSnapshot = {
    id: 'primary',
    currentFocus: 'Restored focus',
    workingOn: ['Restored project'],
    learning: ['Restored topic'],
    using: ['Astro'],
    statusNote: 'Restored note',
    published: true,
  };
  await database.insert(nowStatus).values({
    id: 'primary',
    currentFocus: 'Current focus',
    workingOn: [],
    learning: [],
    using: [],
    statusNote: null,
    published: false,
    updatedAt: now,
  });
  const nowRevision = revisionValues(
    actor,
    'now_status',
    'primary',
    nowSnapshot,
  );
  await database.insert(contentRevisions).values(nowRevision);

  for (const [type, revision] of [
    ['homepage_settings', homepageRevision],
    ['site_settings', siteRevision],
    ['now_status', nowRevision],
  ] as const) {
    assert.equal(
      await restoreContentRevision(actor, type, 'primary', revision.id),
      true,
    );
  }

  const [homepage] = await database.select().from(homepageSettings);
  const [site] = await database.select().from(siteSettings);
  const [nowRecord] = await database.select().from(nowStatus);
  assert.equal(homepage.settings.heroName, 'Restored homepage name');
  assert.equal(site.settings.siteName, 'Restored site');
  assert.equal(nowRecord.currentFocus, 'Restored focus');
  assert.equal(nowRecord.published, true);
});

test('late revision insert failures roll back homepage, site, and Now restores', async (t) => {
  for (const type of [
    'homepage_settings',
    'site_settings',
    'now_status',
  ] as const) {
    await t.test(type, async () => {
      const { database, now } = await resetDatabase(`late-${type}.sqlite`);
      let snapshot: Record<string, unknown>;
      if (type === 'homepage_settings') {
        snapshot = {
          id: 'primary',
          ...defaultHomepageConfig,
          heroName: 'Restored homepage name',
        };
        await database.insert(homepageSettings).values({
          id: 'primary',
          settings: {
            ...defaultHomepageConfig,
            heroName: 'Current homepage name',
          },
          updatedAt: now,
        });
      } else if (type === 'site_settings') {
        snapshot = {
          id: 'primary',
          siteName: 'Restored site',
          name: 'Restored owner',
          seoDescription: 'Restored description',
          github: 'https://github.com/example-owner',
          email: 'owner@example.test',
        };
        await database.insert(siteSettings).values({
          id: 'primary',
          settings: {
            siteName: 'Current site',
            name: 'Current owner',
            seoDescription: 'Current description',
            github: 'https://github.com/example-owner',
            email: 'owner@example.test',
          },
          updatedAt: now,
        });
      } else {
        snapshot = {
          id: 'primary',
          currentFocus: 'Restored focus',
          workingOn: ['Restored project'],
          learning: ['Restored topic'],
          using: ['Astro'],
          statusNote: 'Restored note',
          published: true,
        };
        await database.insert(nowStatus).values({
          id: 'primary',
          currentFocus: 'Current focus',
          workingOn: [],
          learning: [],
          using: [],
          statusNote: null,
          published: false,
          updatedAt: now,
        });
      }
      const revision = revisionValues(actor, type, 'primary', snapshot);
      await database.insert(contentRevisions).values(revision);
      await database.$client.execute(
        "CREATE TRIGGER fail_settings_restore_revision BEFORE INSERT ON content_revisions WHEN NEW.restored_from_id IS NOT NULL BEGIN SELECT RAISE(ABORT, 'injected settings revision failure'); END",
      );
      const before = await databaseSnapshot();

      await assert.rejects(
        restoreContentRevision(actor, type, 'primary', revision.id),
        (error: unknown) => {
          const message =
            error instanceof Error && error.cause instanceof Error
              ? error.cause.message
              : error instanceof Error
                ? error.message
                : String(error);
          assert.match(message, /injected settings revision failure/);
          return true;
        },
      );
      assert.deepEqual(await databaseSnapshot(), before);
    });
  }
});

test.after(async () => {
  closeDatabase();
  await rm(directory, { recursive: true, force: true });
});
