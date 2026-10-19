import { eq } from 'drizzle-orm';
import { auditEvent } from './audit';
import { getDatabase, migrateDatabase } from './db/client';
import { auditLog, contentRevisions, projectRecords } from './db/schema';
import { pruneContentRevisions, revisionValues } from './revisions';
import { assertContentSlugAvailable } from './redirects';
import { maintainPublicSlugHistory } from './publicSlugHistory';
import {
  projectStatuses,
  type ProjectRecordInput,
} from './validation/projects';

export type ProjectRecord = typeof projectRecords.$inferSelect;

function normalizeProjectRecord(record: ProjectRecord): ProjectRecord {
  const stack = Array.isArray(record.stack)
    ? record.stack
        .filter((item): item is string => typeof item === 'string')
        .slice(0, 20)
    : [];
  const links = Array.isArray(record.links)
    ? record.links
        .filter(
          (link): link is ProjectRecord['links'][number] =>
            Boolean(link) &&
            typeof link === 'object' &&
            typeof link.label === 'string' &&
            typeof link.href === 'string' &&
            typeof link.external === 'boolean',
        )
        .slice(0, 8)
    : [];
  const screenshots = Array.isArray(record.screenshots)
    ? record.screenshots
        .filter(
          (item) =>
            item &&
            typeof item.src === 'string' &&
            typeof item.alt === 'string',
        )
        .slice(0, 8)
    : [];

  return { ...record, stack, links, screenshots };
}

function sortProjectRecords(records: ProjectRecord[]): ProjectRecord[] {
  return records.map(normalizeProjectRecord).sort((left, right) => {
    if (left.featured !== right.featured) return left.featured ? -1 : 1;
    if (left.orderIndex !== right.orderIndex) {
      if (left.orderIndex === null) return 1;
      if (right.orderIndex === null) return -1;
      return left.orderIndex - right.orderIndex;
    }
    return right.updatedAt.getTime() - left.updatedAt.getTime();
  });
}

export async function getConsoleProjects(): Promise<ProjectRecord[]> {
  await migrateDatabase();
  return sortProjectRecords(await getDatabase().select().from(projectRecords));
}

export async function getProjectRecordById(
  id: string,
): Promise<ProjectRecord | undefined> {
  await migrateDatabase();
  const record = await getDatabase().query.projectRecords.findFirst({
    where: eq(projectRecords.id, id),
  });
  return record ? normalizeProjectRecord(record) : undefined;
}

export async function getConsoleProjectBySlug(
  slug: string,
): Promise<ProjectRecord | undefined> {
  await migrateDatabase();
  const record = await getDatabase().query.projectRecords.findFirst({
    where: eq(projectRecords.slug, slug),
  });
  return record ? normalizeProjectRecord(record) : undefined;
}

export async function createProjectRecord(
  input: ProjectRecordInput,
  actorUserId: string,
  mdxSlugs: readonly string[],
): Promise<ProjectRecord> {
  await migrateDatabase();
  const now = new Date();
  return getDatabase().transaction(async (transaction) => {
    await assertContentSlugAvailable(transaction, 'project', input.slug);
    const [record] = await transaction
      .insert(projectRecords)
      .values({
        id: crypto.randomUUID(),
        ...input,
        archived: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    await maintainPublicSlugHistory(
      transaction,
      actorUserId,
      'project',
      record.id,
      null,
      record,
      mdxSlugs,
    );
    await transaction.insert(auditLog).values(
      auditEvent(actorUserId, 'project.create', 'project', record.id, {
        slug: record.slug,
        visible: record.visible,
      }),
    );
    await transaction
      .insert(contentRevisions)
      .values(revisionValues(actorUserId, 'project', record.id, record));
    await pruneContentRevisions(transaction, 'project', record.id);
    return record;
  });
}

export async function updateProjectRecord(
  id: string,
  input: ProjectRecordInput,
  actorUserId: string,
  mdxSlugs: readonly string[],
): Promise<ProjectRecord | undefined> {
  await migrateDatabase();
  return getDatabase().transaction(async (transaction) => {
    const [existing] = await transaction
      .select()
      .from(projectRecords)
      .where(eq(projectRecords.id, id));
    if (!existing) return undefined;
    await assertContentSlugAvailable(transaction, 'project', input.slug, id);

    const [record] = await transaction
      .update(projectRecords)
      .set({
        ...input,
        status: existing.archived ? 'Archived' : input.status,
        featured: existing.archived ? false : input.featured,
        visible: existing.archived ? false : input.visible,
        replacesMdx: existing.archived
          ? existing.replacesMdx
          : input.replacesMdx,
        updatedAt: new Date(),
      })
      .where(eq(projectRecords.id, id))
      .returning();
    await maintainPublicSlugHistory(
      transaction,
      actorUserId,
      'project',
      id,
      existing,
      record,
      mdxSlugs,
    );
    await transaction.insert(auditLog).values(
      auditEvent(actorUserId, 'project.update', 'project', id, {
        fromSlug: existing.slug,
        toSlug: record.slug,
        visible: record.visible,
        featured: record.featured,
        replacesMdx: record.replacesMdx,
      }),
    );
    await transaction
      .insert(contentRevisions)
      .values(revisionValues(actorUserId, 'project', record.id, record));
    await pruneContentRevisions(transaction, 'project', record.id);
    return normalizeProjectRecord(record);
  });
}

export async function archiveProjectRecord(
  id: string,
  actorUserId: string,
  mdxSlugs: readonly string[],
): Promise<boolean> {
  await migrateDatabase();
  return getDatabase().transaction(async (transaction) => {
    const [existing] = await transaction
      .select()
      .from(projectRecords)
      .where(eq(projectRecords.id, id));
    if (!existing || existing.archived) return false;

    const [updated] = await transaction
      .update(projectRecords)
      .set({
        statusBeforeArchive: existing.status,
        status: 'Archived',
        archived: true,
        visible: false,
        featured: false,
        updatedAt: new Date(),
      })
      .where(eq(projectRecords.id, id))
      .returning();
    await maintainPublicSlugHistory(
      transaction,
      actorUserId,
      'project',
      id,
      existing,
      updated,
      mdxSlugs,
    );
    await transaction.insert(auditLog).values(
      auditEvent(actorUserId, 'project.archive', 'project', id, {
        slug: existing.slug,
        previousStatus: existing.status,
        replacesMdx: existing.replacesMdx,
      }),
    );
    await transaction
      .insert(contentRevisions)
      .values(revisionValues(actorUserId, 'project', id, updated));
    await pruneContentRevisions(transaction, 'project', id);
    return true;
  });
}

export async function restoreProjectRecord(
  id: string,
  actorUserId: string,
  mdxSlugs: readonly string[],
): Promise<boolean> {
  await migrateDatabase();
  return getDatabase().transaction(async (transaction) => {
    const [existing] = await transaction
      .select()
      .from(projectRecords)
      .where(eq(projectRecords.id, id));
    if (!existing?.archived) return false;

    const status =
      existing.statusBeforeArchive &&
      existing.statusBeforeArchive !== 'Archived' &&
      projectStatuses.includes(
        existing.statusBeforeArchive as (typeof projectStatuses)[number],
      )
        ? existing.statusBeforeArchive
        : 'Planning';
    const [updated] = await transaction
      .update(projectRecords)
      .set({
        status,
        statusBeforeArchive: null,
        archived: false,
        visible: false,
        featured: false,
        updatedAt: new Date(),
      })
      .where(eq(projectRecords.id, id))
      .returning();
    await maintainPublicSlugHistory(
      transaction,
      actorUserId,
      'project',
      id,
      existing,
      updated,
      mdxSlugs,
    );
    await transaction.insert(auditLog).values(
      auditEvent(actorUserId, 'project.restore', 'project', id, {
        slug: existing.slug,
        status,
      }),
    );
    await transaction
      .insert(contentRevisions)
      .values(revisionValues(actorUserId, 'project', id, updated));
    await pruneContentRevisions(transaction, 'project', id);
    return true;
  });
}

export async function toggleProjectVisible(
  id: string,
  actorUserId: string,
  mdxSlugs: readonly string[],
): Promise<boolean> {
  await migrateDatabase();
  return getDatabase().transaction(async (transaction) => {
    const [existing] = await transaction
      .select()
      .from(projectRecords)
      .where(eq(projectRecords.id, id));
    if (
      !existing ||
      existing.archived ||
      (!existing.visible &&
        existing.replacesMdx &&
        !existing.caseStudyBody?.trim())
    ) {
      return false;
    }
    const visible = !existing.visible;
    const [updated] = await transaction
      .update(projectRecords)
      .set({ visible, updatedAt: new Date() })
      .where(eq(projectRecords.id, id))
      .returning();
    await maintainPublicSlugHistory(
      transaction,
      actorUserId,
      'project',
      id,
      existing,
      updated,
      mdxSlugs,
    );
    await transaction.insert(auditLog).values(
      auditEvent(actorUserId, 'project.visibility', 'project', id, {
        slug: existing.slug,
        visible,
      }),
    );
    await transaction
      .insert(contentRevisions)
      .values(revisionValues(actorUserId, 'project', id, updated));
    await pruneContentRevisions(transaction, 'project', id);
    return true;
  });
}

export async function toggleProjectFeatured(
  id: string,
  actorUserId: string,
): Promise<boolean> {
  await migrateDatabase();
  return getDatabase().transaction(async (transaction) => {
    const [existing] = await transaction
      .select()
      .from(projectRecords)
      .where(eq(projectRecords.id, id));
    if (!existing || existing.archived) return false;
    const featured = !existing.featured;
    const [updated] = await transaction
      .update(projectRecords)
      .set({ featured, updatedAt: new Date() })
      .where(eq(projectRecords.id, id))
      .returning();
    await transaction.insert(auditLog).values(
      auditEvent(actorUserId, 'project.featured', 'project', id, {
        slug: existing.slug,
        featured,
      }),
    );
    await transaction
      .insert(contentRevisions)
      .values(revisionValues(actorUserId, 'project', id, updated));
    await pruneContentRevisions(transaction, 'project', id);
    return true;
  });
}
