import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import test from 'node:test';

const directory = await mkdtemp(
  join(tmpdir(), 'angefolio-redirect-lifecycle-'),
);
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = `file:${join(directory, 'portfolio.sqlite')}`;

const { getDatabase, migrateDatabase, closeDatabase } =
  await import('../src/lib/server/db/client');
const { auditLog, blogRecords, contentRedirects, contentRevisions, user } =
  await import('../src/lib/server/db/schema');
const { saveBlogPost } = await import('../src/lib/server/blog');

test('failed private rename rolls back alias maintenance, content, revisions, and audit', async () => {
  await migrateDatabase();
  const database = getDatabase();
  const actor = 'redirect-lifecycle-owner';
  const now = new Date('2026-10-18T00:00:00.000Z');
  await database.insert(user).values({
    id: actor,
    name: 'Redirect Lifecycle Owner',
    email: 'redirect-lifecycle@example.test',
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });

  const input = (slug: string, published: boolean) => ({
    slug,
    title: 'Lifecycle test post',
    description: 'Tests rollback for alias maintenance.',
    summary: null,
    cover: null,
    category: 'Testing',
    tags: ['redirects'],
    body: 'Lifecycle fixture body.',
    published,
    featured: false,
    archived: false,
    createdAt: now,
  });
  const original = await saveBlogPost(null, input('alpha', true), actor);
  await database.insert(contentRedirects).values([
    {
      fromPath: '/blog/foreign-id-alias',
      toPath: '/blog/beta',
      entityType: 'blog',
      entityId: 'foreign-blog-owner',
      createdAt: now,
    },
    {
      fromPath: '/blog/foreign-type-alias',
      toPath: '/blog/beta',
      entityType: 'note',
      entityId: original.id,
      createdAt: now,
    },
  ]);
  await saveBlogPost(original.id, input('beta', true), actor, true);
  await saveBlogPost(original.id, input('gamma', false), actor);

  const snapshot = async () => ({
    content: await database
      .select()
      .from(blogRecords)
      .where(eq(blogRecords.id, original.id)),
    redirects: await database
      .select()
      .from(contentRedirects)
      .orderBy(contentRedirects.fromPath),
    revisions: await database
      .select()
      .from(contentRevisions)
      .where(eq(contentRevisions.entityId, original.id)),
    audit: await database
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, original.id)),
  });

  const before = await snapshot();
  assert.deepEqual(
    before.redirects.map(({ fromPath, toPath, entityType, entityId }) => ({
      fromPath,
      toPath,
      entityType,
      entityId,
    })),
    [
      {
        fromPath: '/blog/alpha',
        toPath: '/blog/gamma',
        entityType: 'blog',
        entityId: original.id,
      },
      {
        fromPath: '/blog/beta',
        toPath: '/blog/gamma',
        entityType: 'blog',
        entityId: original.id,
      },
      {
        fromPath: '/blog/foreign-id-alias',
        toPath: '/blog/beta',
        entityType: 'blog',
        entityId: 'foreign-blog-owner',
      },
      {
        fromPath: '/blog/foreign-type-alias',
        toPath: '/blog/beta',
        entityType: 'note',
        entityId: original.id,
      },
    ],
  );
  await database.$client.execute(`CREATE TRIGGER fail_blog_lifecycle_revision
    BEFORE INSERT ON content_revisions
    WHEN NEW.entity_type = 'blog' AND NEW.entity_id = '${original.id}'
    BEGIN SELECT RAISE(ABORT, 'injected lifecycle revision failure'); END`);

  await assert.rejects(
    saveBlogPost(original.id, input('delta', false), actor),
    (error: unknown) => {
      const cause = error instanceof Error ? error.cause : undefined;
      assert.match(
        cause instanceof Error ? cause.message : String(cause),
        /injected lifecycle revision failure/,
      );
      return true;
    },
  );
  await database.$client.execute('DROP TRIGGER fail_blog_lifecycle_revision');
  assert.deepEqual(await snapshot(), before);
});

test.after(async () => {
  closeDatabase();
  await rm(directory, { recursive: true, force: true });
});
