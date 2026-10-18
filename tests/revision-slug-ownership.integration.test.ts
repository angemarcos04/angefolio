import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { eq } from 'drizzle-orm';
import type { RevisionMdxSlugCollections } from '../src/lib/server/revisions';

const directory = await mkdtemp(
  join(tmpdir(), 'angefolio-revision-slug-ownership-'),
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
  labRecords,
  mediaAssets,
  noteRecords,
  projectRecords,
  user,
} = await import('../src/lib/server/db/schema');
const { revisionValues, restoreContentRevision } =
  await import('../src/lib/server/revisions');
const { contentPath } = await import('../src/lib/server/redirects');
const { mdxSlugFromId } = await import('../src/lib/data/mdxSlug');

type ContentType = 'project' | 'blog' | 'note' | 'lab';
const actor = 'revision-slug-owner';
const now = new Date('2026-01-01T00:00:00.000Z');
const emptyMdx: RevisionMdxSlugCollections = {
  project: [],
  note: [],
  lab: [],
};

function row(
  type: ContentType,
  id: string,
  slug: string,
  replacesMdx = false,
): Record<string, unknown> {
  const common = {
    id,
    slug,
    title: `${id} title`,
    description: `${id} description`,
  };
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
      highlights: [],
      cover: null,
      screenshots: [],
      replacesMdx,
      featured: false,
      visible: true,
      archived: false,
      statusBeforeArchive: null,
      orderIndex: null,
      createdAt: now,
      updatedAt: now,
    };
  if (type === 'blog')
    return {
      ...common,
      summary: null,
      category: 'Testing',
      tags: [],
      cover: null,
      body: '# Article',
      published: true,
      featured: false,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
  if (type === 'note')
    return {
      ...common,
      summary: null,
      category: 'Testing',
      tags: [],
      body: '# Note',
      published: true,
      featured: false,
      replacesMdx,
      createdAt: now,
      updatedAt: now,
    };
  return {
    ...common,
    status: 'Idea',
    category: 'Testing',
    tags: [],
    visible: true,
    featured: false,
    repo: null,
    demo: null,
    relatedProject: null,
    tools: [],
    lessons: [],
    risk: null,
    body: '# Experiment',
    replacesMdx,
    date: now,
    updatedAt: now,
  };
}

async function insertRecord(type: ContentType, value: ReturnType<typeof row>) {
  const db = getDatabase();
  switch (type) {
    case 'project':
      await db.insert(projectRecords).values(value as never);
      break;
    case 'blog':
      await db.insert(blogRecords).values(value as never);
      break;
    case 'note':
      await db.insert(noteRecords).values(value as never);
      break;
    case 'lab':
      await db.insert(labRecords).values(value as never);
      break;
  }
}

async function currentRecord(type: ContentType, id: string) {
  const db = getDatabase();
  switch (type) {
    case 'project':
      return (
        await db.select().from(projectRecords).where(eq(projectRecords.id, id))
      )[0];
    case 'blog':
      return (
        await db.select().from(blogRecords).where(eq(blogRecords.id, id))
      )[0];
    case 'note':
      return (
        await db.select().from(noteRecords).where(eq(noteRecords.id, id))
      )[0];
    case 'lab':
      return (
        await db.select().from(labRecords).where(eq(labRecords.id, id))
      )[0];
  }
}

async function addRevision(
  type: ContentType,
  id: string,
  snapshot: Record<string, unknown>,
) {
  const revision = revisionValues(actor, type, id, snapshot);
  await getDatabase().insert(contentRevisions).values(revision);
  return revision;
}

async function snapshot() {
  const db = getDatabase();
  return {
    projects: await db.select().from(projectRecords).orderBy(projectRecords.id),
    blogs: await db.select().from(blogRecords).orderBy(blogRecords.id),
    notes: await db.select().from(noteRecords).orderBy(noteRecords.id),
    labs: await db.select().from(labRecords).orderBy(labRecords.id),
    redirects: await db
      .select()
      .from(contentRedirects)
      .orderBy(contentRedirects.fromPath),
    revisions: await db
      .select()
      .from(contentRevisions)
      .orderBy(contentRevisions.id),
    audits: await db.select().from(auditLog).orderBy(auditLog.id),
    media: await db.select().from(mediaAssets).orderBy(mediaAssets.id),
  };
}

async function assertFailedWithoutMutation(
  type: ContentType,
  id: string,
  revisionId: string,
  mdxSlugs = emptyMdx,
) {
  const before = await snapshot();
  assert.equal(
    await restoreContentRevision(actor, type, id, revisionId, mdxSlugs),
    false,
  );
  assert.deepEqual(await snapshot(), before);
}

test('revision restoration enforces database, redirect, MDX, and slug ownership', async () => {
  await migrateDatabase();
  const db = getDatabase();
  await db.insert(user).values({
    id: actor,
    name: 'Revision Owner',
    email: 'revision-slug-owner@example.test',
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });

  const types: ContentType[] = ['project', 'blog', 'note', 'lab'];
  // A foreign canonical slug is rejected for every collection.
  for (const type of types) {
    const id = `canonical-${type}`;
    const foreignId = `foreign-canonical-${type}`;
    await insertRecord(type, row(type, id, `current-${type}`));
    await insertRecord(type, row(type, foreignId, `restored-${type}`));
    const revision = await addRevision(
      type,
      id,
      row(type, id, `restored-${type}`),
    );
    await assertFailedWithoutMutation(type, id, revision.id);
  }

  // A foreign alias remains reserved even when its owner is hidden or archived.
  for (const type of types) {
    const id = `alias-target-${type}`;
    const foreignId = `alias-owner-${type}`;
    await insertRecord(type, row(type, id, `current-alias-${type}`));
    const foreign = row(type, foreignId, `canonical-alias-${type}`);
    if (type === 'project') {
      foreign.visible = false;
      foreign.archived = true;
    } else if (type === 'blog') {
      foreign.published = false;
      foreign.archived = true;
    } else if (type === 'note') {
      foreign.published = false;
    } else {
      foreign.visible = false;
    }
    await insertRecord(type, foreign);
    await db.insert(contentRedirects).values({
      fromPath: contentPath(type, `reserved-${type}`),
      toPath: contentPath(type, `canonical-alias-${type}`),
      entityType: type,
      entityId: foreignId,
      createdAt: now,
    });
    const revision = await addRevision(
      type,
      id,
      row(type, id, `reserved-${type}`),
    );
    await assertFailedWithoutMutation(type, id, revision.id);
  }

  // Reclaiming an alias owned by the restored entity succeeds and redirects
  // its former canonical path back without leaving a loop at the reclaimed URL.
  for (const type of types) {
    const id = `reclaim-${type}`;
    await insertRecord(type, row(type, id, `current-reclaim-${type}`));
    const oldSlug = `old-reclaim-${type}`;
    await db.insert(contentRedirects).values({
      fromPath: contentPath(type, oldSlug),
      toPath: contentPath(type, `current-reclaim-${type}`),
      entityType: type,
      entityId: id,
      createdAt: now,
    });
    const revision = await addRevision(type, id, row(type, id, oldSlug));
    assert.equal(
      await restoreContentRevision(actor, type, id, revision.id, emptyMdx),
      true,
    );
    assert.equal((await currentRecord(type, id))?.slug, oldSlug);
    const redirects = await db.select().from(contentRedirects);
    assert.equal(
      redirects.some(
        (redirect) => redirect.fromPath === contentPath(type, oldSlug),
      ),
      false,
    );
    assert.equal(
      redirects.some(
        (redirect) =>
          redirect.fromPath === contentPath(type, `current-reclaim-${type}`) &&
          redirect.toPath === contentPath(type, oldSlug) &&
          redirect.entityId === id,
      ),
      true,
    );
  }

  // Astro collection ID fixtures pass through the production filename-to-slug
  // helper used when constructing the restore endpoint's source reservations.
  for (const type of ['project', 'note', 'lab'] as const) {
    const id = `mdx-${type}`;
    const slug = mdxSlugFromId(`legacy-${type}.mdx`);
    await insertRecord(type, row(type, id, `current-mdx-${type}`));
    const rejected = await addRevision(type, id, row(type, id, slug, false));
    const sourceSlugs: RevisionMdxSlugCollections = {
      ...emptyMdx,
      [type]: [slug],
    };
    await assertFailedWithoutMutation(type, id, rejected.id, sourceSlugs);

    const replacement = await addRevision(type, id, row(type, id, slug, true));
    assert.equal(
      await restoreContentRevision(
        actor,
        type,
        id,
        replacement.id,
        sourceSlugs,
      ),
      true,
    );
    assert.equal((await currentRecord(type, id))?.slug, slug);
    assert.equal(
      ((await currentRecord(type, id)) as { replacesMdx?: boolean } | undefined)
        ?.replacesMdx,
      true,
    );
  }

  // Same-slug restoration may update replacement intent. The explicit true
  // state is accepted as a claim; turning it off relinquishes the MDX claim.
  for (const [initial, restored] of [
    [true, false],
    [false, true],
  ] as const) {
    const id = `mdx-state-${initial}-${restored}`;
    const slug = `same-mdx-${initial}-${restored}`;
    await insertRecord('project', row('project', id, slug, initial));
    const revision = await addRevision(
      'project',
      id,
      row('project', id, slug, restored),
    );
    assert.equal(
      await restoreContentRevision(actor, 'project', id, revision.id, {
        ...emptyMdx,
        project: [slug],
      }),
      true,
    );
    assert.equal(
      (
        (await currentRecord('project', id)) as
          { replacesMdx?: boolean } | undefined
      )?.replacesMdx,
      restored,
    );
  }

  // Restore slugs must satisfy the current CMS path format and length.
  for (const type of types) {
    const id = `invalid-slug-${type}`;
    await insertRecord(type, row(type, id, `valid-current-${type}`));
    for (const slug of [
      'Uppercase',
      'two words',
      '../private',
      'part/other',
      'x'.repeat(81),
    ]) {
      const revision = await addRevision(type, id, row(type, id, slug));
      await assertFailedWithoutMutation(type, id, revision.id);
      assert.equal(
        (await currentRecord(type, id))?.slug,
        `valid-current-${type}`,
      );
    }
    const missingSlug = row(type, id, `valid-current-${type}`);
    delete missingSlug.slug;
    const missingSlugRevision = await addRevision(type, id, missingSlug);
    await assertFailedWithoutMutation(type, id, missingSlugRevision.id);

    const nonStringSlug = row(type, id, `valid-current-${type}`);
    nonStringSlug.slug = 123;
    const invalidTypeRevision = await addRevision(type, id, nonStringSlug);
    await assertFailedWithoutMutation(type, id, invalidTypeRevision.id);
  }

  // Slugs remain independent across collection route namespaces.
  const crossId = 'cross-collection-project';
  await insertRecord('project', row('project', crossId, 'cross-current'));
  await insertRecord(
    'blog',
    row('blog', 'cross-collection-blog', 'cross-shared'),
  );
  const crossRevision = await addRevision(
    'project',
    crossId,
    row('project', crossId, 'cross-shared'),
  );
  assert.equal(
    await restoreContentRevision(
      actor,
      'project',
      crossId,
      crossRevision.id,
      emptyMdx,
    ),
    true,
  );
  assert.equal((await currentRecord('project', crossId))?.slug, 'cross-shared');
});

test.after(async () => {
  closeDatabase();
  await rm(directory, { recursive: true, force: true });
});
