import { desc, eq } from 'drizzle-orm';
import { auditEvent } from './audit';
import { getDatabase, migrateDatabase } from './db/client';
import { auditLog, blogRecords, contentRevisions } from './db/schema';
import { pruneContentRevisions, revisionValues } from './revisions';
import {
  assertContentSlugAvailable,
  getRedirectSourcePaths,
} from './redirects';
import { maintainPublicSlugHistory } from './publicSlugHistory';
import type { BlogRecordInput } from './validation/blog';

export type BlogRecord = typeof blogRecords.$inferSelect;

export async function getPublicBlogCatalog(): Promise<BlogRecord[]> {
  try {
    await migrateDatabase();
    const [records, redirectSources] = await Promise.all([
      getDatabase().select().from(blogRecords),
      getRedirectSourcePaths('blog'),
    ]);
    return records
      .filter(
        (record) =>
          record.published &&
          !record.archived &&
          !redirectSources.has(`/blog/${record.slug}`),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch {
    // Fail closed so a database outage cannot expose drafts or archived posts.
    return [];
  }
}

export async function getConsoleBlogPosts(): Promise<BlogRecord[]> {
  await migrateDatabase();
  return getDatabase()
    .select()
    .from(blogRecords)
    .orderBy(desc(blogRecords.updatedAt));
}

export async function getBlogRecord(
  id: string,
): Promise<BlogRecord | undefined> {
  await migrateDatabase();
  return getDatabase().query.blogRecords.findFirst({
    where: eq(blogRecords.id, id),
  });
}

export async function getBlogRecordBySlug(
  slug: string,
): Promise<BlogRecord | undefined> {
  await migrateDatabase();
  return getDatabase().query.blogRecords.findFirst({
    where: eq(blogRecords.slug, slug),
  });
}

export async function saveBlogPost(
  id: string | null,
  input: BlogRecordInput,
  actor: string,
  _redirectSlugChange = false,
): Promise<BlogRecord> {
  await migrateDatabase();
  return getDatabase().transaction(async (tx) => {
    const now = new Date();
    const existing = id
      ? await tx.query.blogRecords.findFirst({ where: eq(blogRecords.id, id) })
      : undefined;
    await assertContentSlugAvailable(tx, 'blog', input.slug, existing?.id);
    const [record] = existing
      ? await tx
          .update(blogRecords)
          .set({ ...input, updatedAt: now })
          .where(eq(blogRecords.id, id!))
          .returning()
      : await tx
          .insert(blogRecords)
          .values({
            id: crypto.randomUUID(),
            ...input,
            createdAt: input.createdAt,
            updatedAt: now,
          })
          .returning();
    await maintainPublicSlugHistory(
      tx,
      actor,
      'blog',
      record.id,
      existing,
      record,
    );
    await tx.insert(auditLog).values(
      auditEvent(
        actor,
        existing ? 'blog.update' : 'blog.create',
        'blog',
        record.id,
        {
          slug: record.slug,
          published: record.published,
          archived: record.archived,
        },
      ),
    );
    await tx
      .insert(contentRevisions)
      .values(revisionValues(actor, 'blog', record.id, record));
    await pruneContentRevisions(tx, 'blog', record.id);
    return record;
  });
}
