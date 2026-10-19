import { desc, eq } from 'drizzle-orm';
import type { CollectionEntry } from 'astro:content';
import { auditEvent } from './audit';
import { getDatabase, migrateDatabase } from './db/client';
import { auditLog, contentRevisions, labRecords } from './db/schema';
import { pruneContentRevisions, revisionValues } from './revisions';
import { getAllLabEntries } from '../content';
import { assertContentSlugAvailable } from './redirects';
import { maintainPublicSlugHistory } from './publicSlugHistory';
import type { LabRecordInput } from './validation/lab';
import { getRedirectSourcePaths } from './redirects';

export type LabRecord = typeof labRecords.$inferSelect;

export interface PublicLabEntry {
  source: 'mdx' | 'database';
  /** Present for database records; used to verify historical alias ownership. */
  id?: string;
  slug: string;
  title: string;
  description: string;
  status: string;
  category: string | null;
  tags: string[];
  visible: boolean;
  featured: boolean;
  repo: string | null;
  demo: string | null;
  relatedProject: string | null;
  tools: string[];
  lessons: string[];
  risk: string | null;
  body: string;
  date: Date;
  updatedAt: Date | null;
  entry?: CollectionEntry<'lab'>;
}

function fromMdx(entry: CollectionEntry<'lab'>): PublicLabEntry {
  const data = entry.data;
  return {
    source: 'mdx',
    slug: entry.id.replace(/\.(md|mdx)$/, ''),
    title: data.title,
    description: data.description,
    status: data.status,
    category: data.category ?? null,
    tags: data.tags,
    visible: data.visible,
    featured: data.featured ?? false,
    repo: data.repo ?? null,
    demo: data.demo ?? null,
    relatedProject: data.relatedProject ?? null,
    tools: data.tools ?? [],
    lessons: data.lessons ?? [],
    risk: data.risk ?? null,
    body: 'body' in entry && typeof entry.body === 'string' ? entry.body : '',
    date: data.date,
    updatedAt: data.updatedAt ?? null,
    entry,
  };
}

function fromRecord(record: LabRecord): PublicLabEntry {
  return {
    source: 'database',
    id: record.id,
    slug: record.slug,
    title: record.title,
    description: record.description,
    status: record.status,
    category: record.category,
    tags: Array.isArray(record.tags) ? record.tags : [],
    visible: record.visible,
    featured: record.featured,
    repo: record.repo,
    demo: record.demo,
    relatedProject: record.relatedProject,
    tools: Array.isArray(record.tools) ? record.tools : [],
    lessons: Array.isArray(record.lessons) ? record.lessons : [],
    risk: record.risk,
    body: record.body,
    date: record.date,
    updatedAt: record.updatedAt,
  };
}

export async function getPublicLabCatalog(): Promise<PublicLabEntry[]> {
  const entries = await getAllLabEntries();
  let records: LabRecord[];
  let redirectSources: Set<string>;
  try {
    await migrateDatabase();
    records = await getDatabase().select().from(labRecords);
    redirectSources = await getRedirectSourcePaths('lab');
  } catch {
    // A hidden adopted experiment must not return through the MDX fallback.
    return [];
  }
  const bySlug = new Map(records.map((record) => [record.slug, record]));
  const mdxSlugs = new Set(
    entries.map((entry) => entry.id.replace(/\.(md|mdx)$/, '')),
  );
  const result: PublicLabEntry[] = [];
  for (const entry of entries) {
    const mdx = fromMdx(entry);
    if (redirectSources.has(`/lab/${mdx.slug}`)) continue;
    const record = bySlug.get(mdx.slug);
    if (!record?.replacesMdx) {
      if (mdx.visible) result.push(mdx);
    } else if (record.visible) result.push(fromRecord(record));
  }
  for (const record of records) {
    if (
      !mdxSlugs.has(record.slug) &&
      !redirectSources.has(`/lab/${record.slug}`) &&
      record.visible
    )
      result.push(fromRecord(record));
  }
  return result.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export async function getConsoleLabEntries(): Promise<LabRecord[]> {
  await migrateDatabase();
  return getDatabase().select().from(labRecords).orderBy(desc(labRecords.date));
}

export async function getLabRecord(id: string): Promise<LabRecord | undefined> {
  await migrateDatabase();
  return getDatabase().query.labRecords.findFirst({
    where: eq(labRecords.id, id),
  });
}

export async function getLabRecordBySlug(
  slug: string,
): Promise<LabRecord | undefined> {
  await migrateDatabase();
  return getDatabase().query.labRecords.findFirst({
    where: eq(labRecords.slug, slug),
  });
}

export async function saveLabRecord(
  id: string | null,
  input: LabRecordInput,
  actor: string,
  mdxSlugs: readonly string[],
): Promise<LabRecord> {
  await migrateDatabase();
  return getDatabase().transaction(async (tx) => {
    const existing = id
      ? await tx.query.labRecords.findFirst({ where: eq(labRecords.id, id) })
      : undefined;
    await assertContentSlugAvailable(tx, 'lab', input.slug, existing?.id);
    const [record] = existing
      ? await tx
          .update(labRecords)
          .set({
            ...input,
            updatedAt: input.updatedAt,
            replacesMdx: input.replacesMdx,
          })
          .where(eq(labRecords.id, id!))
          .returning()
      : await tx
          .insert(labRecords)
          .values({ id: crypto.randomUUID(), ...input })
          .returning();
    await maintainPublicSlugHistory(
      tx,
      actor,
      'lab',
      record.id,
      existing,
      record,
      mdxSlugs,
    );
    await tx.insert(auditLog).values(
      auditEvent(
        actor,
        existing ? 'lab.update' : 'lab.create',
        'lab',
        record.id,
        {
          slug: record.slug,
          visible: record.visible,
          replacesMdx: record.replacesMdx,
        },
      ),
    );
    await tx
      .insert(contentRevisions)
      .values(revisionValues(actor, 'lab', record.id, record));
    await pruneContentRevisions(tx, 'lab', record.id);
    return record;
  });
}
