import { desc, eq } from 'drizzle-orm';
import type { CollectionEntry } from 'astro:content';
import { auditEvent } from './audit';
import { getDatabase, migrateDatabase } from './db/client';
import { auditLog, contentRevisions, noteRecords } from './db/schema';
import { pruneContentRevisions, revisionValues } from './revisions';
import { getAllNotes } from '../content';
import { assertContentSlugAvailable } from './redirects';
import { maintainPublicSlugHistory } from './publicSlugHistory';
import type { NoteRecordInput } from './validation/notes';
import { getRedirectSourcePaths } from './redirects';

export type NoteRecord = typeof noteRecords.$inferSelect;

export interface PublicNote {
  source: 'mdx' | 'database';
  /** Present for database records; used to verify historical alias ownership. */
  id?: string;
  slug: string;
  title: string;
  description: string;
  summary: string | null;
  category: string;
  tags: string[];
  published: boolean;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date | null;
  body: string;
  entry?: CollectionEntry<'notes'>;
}

function fromMdx(entry: CollectionEntry<'notes'>): PublicNote {
  return {
    source: 'mdx',
    slug: entry.id.replace(/\.(md|mdx)$/, ''),
    title: entry.data.title,
    description: entry.data.description,
    summary: entry.data.summary ?? null,
    category: entry.data.category,
    tags: entry.data.tags,
    published: entry.data.published,
    featured: entry.data.featured,
    createdAt: entry.data.createdAt,
    updatedAt: entry.data.updatedAt ?? null,
    body: 'body' in entry && typeof entry.body === 'string' ? entry.body : '',
    entry,
  };
}

function fromRecord(record: NoteRecord): PublicNote {
  return {
    source: 'database',
    id: record.id,
    slug: record.slug,
    title: record.title,
    description: record.description,
    summary: record.summary,
    category: record.category,
    tags: Array.isArray(record.tags) ? record.tags : [],
    published: record.published,
    featured: record.featured,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    body: record.body,
  };
}

export async function getPublicNoteCatalog(): Promise<PublicNote[]> {
  const entries = await getAllNotes();
  let records: NoteRecord[];
  let redirectSources: Set<string>;
  try {
    await migrateDatabase();
    records = await getDatabase().select().from(noteRecords);
    redirectSources = await getRedirectSourcePaths('note');
  } catch {
    // DB state can hide adopted MDX notes, so a failed read must not fall back.
    return [];
  }
  const bySlug = new Map(records.map((record) => [record.slug, record]));
  const mdxSlugs = new Set(
    entries.map((entry) => entry.id.replace(/\.(md|mdx)$/, '')),
  );
  const notes: PublicNote[] = [];
  for (const entry of entries) {
    const mdx = fromMdx(entry);
    if (redirectSources.has(`/notes/${mdx.slug}`)) continue;
    const record = bySlug.get(mdx.slug);
    if (!record?.replacesMdx) {
      if (mdx.published) notes.push(mdx);
    } else if (record.published) notes.push(fromRecord(record));
  }
  for (const record of records) {
    if (
      !mdxSlugs.has(record.slug) &&
      !redirectSources.has(`/notes/${record.slug}`) &&
      record.published
    )
      notes.push(fromRecord(record));
  }
  return notes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getConsoleNotes(): Promise<NoteRecord[]> {
  await migrateDatabase();
  return getDatabase()
    .select()
    .from(noteRecords)
    .orderBy(desc(noteRecords.updatedAt));
}

export async function getNoteRecord(
  id: string,
): Promise<NoteRecord | undefined> {
  await migrateDatabase();
  return getDatabase().query.noteRecords.findFirst({
    where: eq(noteRecords.id, id),
  });
}

export async function getNoteRecordBySlug(
  slug: string,
): Promise<NoteRecord | undefined> {
  await migrateDatabase();
  return getDatabase().query.noteRecords.findFirst({
    where: eq(noteRecords.slug, slug),
  });
}

export async function saveNote(
  id: string | null,
  input: NoteRecordInput,
  actor: string,
  mdxSlugs: readonly string[],
): Promise<NoteRecord> {
  await migrateDatabase();
  return getDatabase().transaction(async (tx) => {
    const now = new Date();
    const existing = id
      ? await tx.query.noteRecords.findFirst({ where: eq(noteRecords.id, id) })
      : undefined;
    await assertContentSlugAvailable(tx, 'note', input.slug, existing?.id);
    const [record] = existing
      ? await tx
          .update(noteRecords)
          .set({
            ...input,
            replacesMdx: input.replacesMdx,
            updatedAt: now,
          })
          .where(eq(noteRecords.id, id!))
          .returning()
      : await tx
          .insert(noteRecords)
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
      'note',
      record.id,
      existing,
      record,
      mdxSlugs,
    );
    await tx.insert(auditLog).values(
      auditEvent(
        actor,
        existing ? 'note.update' : 'note.create',
        'note',
        record.id,
        {
          slug: record.slug,
          published: record.published,
          replacesMdx: record.replacesMdx,
        },
      ),
    );
    await tx
      .insert(contentRevisions)
      .values(revisionValues(actor, 'note', record.id, record));
    await pruneContentRevisions(tx, 'note', record.id);
    return record;
  });
}
