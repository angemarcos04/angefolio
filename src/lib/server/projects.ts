import { and, eq } from 'drizzle-orm';
import { getDatabase, migrateDatabase } from './db/client';
import { projectRecords } from './db/schema';
import type { ProjectRecordInput } from './validation/projects';

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

  return { ...record, stack, links };
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

export async function getPublicProjectRecords(): Promise<ProjectRecord[]> {
  try {
    await migrateDatabase();
    const records = await getDatabase()
      .select()
      .from(projectRecords)
      .where(
        and(
          eq(projectRecords.visible, true),
          eq(projectRecords.archived, false),
        ),
      );
    return sortProjectRecords(records);
  } catch {
    return [];
  }
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

export async function getProjectRecordBySlug(
  slug: string,
): Promise<ProjectRecord | undefined> {
  try {
    await migrateDatabase();
    const record = await getDatabase().query.projectRecords.findFirst({
      where: and(
        eq(projectRecords.slug, slug),
        eq(projectRecords.visible, true),
        eq(projectRecords.archived, false),
      ),
    });
    return record ? normalizeProjectRecord(record) : undefined;
  } catch {
    return undefined;
  }
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
): Promise<ProjectRecord> {
  await migrateDatabase();
  const now = new Date();
  const [record] = await getDatabase()
    .insert(projectRecords)
    .values({
      id: crypto.randomUUID(),
      ...input,
      archived: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return record;
}

export async function updateProjectRecord(
  id: string,
  input: ProjectRecordInput,
): Promise<ProjectRecord | undefined> {
  await migrateDatabase();
  const existing = await getProjectRecordById(id);
  if (!existing) return undefined;

  const [record] = await getDatabase()
    .update(projectRecords)
    .set({
      ...input,
      status: existing.archived ? 'Archived' : input.status,
      featured: existing.archived ? false : input.featured,
      visible: existing.archived ? false : input.visible,
      updatedAt: new Date(),
    })
    .where(eq(projectRecords.id, id))
    .returning();
  return record;
}

export async function archiveProjectRecord(id: string): Promise<boolean> {
  await migrateDatabase();
  const rows = await getDatabase()
    .update(projectRecords)
    .set({
      status: 'Archived',
      archived: true,
      visible: false,
      featured: false,
      updatedAt: new Date(),
    })
    .where(eq(projectRecords.id, id))
    .returning({ id: projectRecords.id });
  return rows.length > 0;
}

export async function toggleProjectVisible(id: string): Promise<boolean> {
  const existing = await getProjectRecordById(id);
  if (!existing || existing.archived) return false;
  await getDatabase()
    .update(projectRecords)
    .set({ visible: !existing.visible, updatedAt: new Date() })
    .where(eq(projectRecords.id, id));
  return true;
}

export async function toggleProjectFeatured(id: string): Promise<boolean> {
  const existing = await getProjectRecordById(id);
  if (!existing || existing.archived) return false;
  await getDatabase()
    .update(projectRecords)
    .set({ featured: !existing.featured, updatedAt: new Date() })
    .where(eq(projectRecords.id, id));
  return true;
}
