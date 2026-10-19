import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import {
  auditLog,
  blogRecords,
  contentRevisions,
  homepageSettings,
  labRecords,
  noteRecords,
  nowStatus,
  projectRecords,
  siteSettings,
} from './db/schema';
import { auditEvent } from './audit';
import { getDatabase, migrateDatabase } from './db/client';
import type { HomepageConfig } from '../data/homepage';
import { isSafeImageReference } from '../data/mediaReference';
import { validateRevisionSnapshot } from './validation/revisionSnapshots';
import { normalizeRevisionSnapshot } from './validation/revisionCompatibility';
import { maintainPublicSlugHistory } from './publicSlugHistory';
import { isMdxSlugClaimConflict } from '../data/mdxSlug';
import {
  assertContentSlugAvailable,
  contentPath,
  SlugRedirectConflictError,
  type RedirectEntityType,
} from './redirects';

export const revisionEntityTypes = [
  'now_status',
  'project',
  'note',
  'blog',
  'lab',
  'homepage_settings',
  'site_settings',
] as const;
export type RevisionEntityType = (typeof revisionEntityTypes)[number];
export type ContentRevision = typeof contentRevisions.$inferSelect;

export interface RevisionMdxSlugCollections {
  project: readonly string[];
  note: readonly string[];
  lab: readonly string[];
}

function isValidRestoredSlug(type: RedirectEntityType, slug: string): boolean {
  if (!slug || slug.length > 80) return false;
  try {
    contentPath(type, slug);
    return true;
  } catch {
    return false;
  }
}

interface RevisionTransaction {
  run(query: SQL): Promise<unknown>;
}

class RevisionRestoreAborted extends Error {
  constructor() {
    super('Revision restoration was aborted.');
    this.name = 'RevisionRestoreAborted';
  }
}

export async function pruneContentRevisions(
  transaction: unknown,
  entityType: RevisionEntityType,
  entityId: string,
): Promise<void> {
  await (transaction as RevisionTransaction).run(sql`
    DELETE FROM content_revisions
    WHERE entity_type = ${entityType}
      AND entity_id = ${entityId}
      AND rowid NOT IN (
        SELECT rowid FROM content_revisions
        WHERE entity_type = ${entityType} AND entity_id = ${entityId}
        ORDER BY rowid DESC LIMIT 50
      )
  `);
}

export function revisionValues(
  actorUserId: string | null,
  entityType: RevisionEntityType,
  entityId: string,
  snapshot: Record<string, unknown>,
  restoredFromId: string | null = null,
) {
  return {
    id: crypto.randomUUID(),
    actorUserId,
    entityType,
    entityId,
    snapshot,
    restoredFromId,
    createdAt: new Date(),
  };
}

export async function getEntityRevisions(
  entityType: RevisionEntityType,
  entityId: string,
): Promise<ContentRevision[]> {
  await migrateDatabase();
  return getDatabase()
    .select()
    .from(contentRevisions)
    .where(
      and(
        eq(contentRevisions.entityType, entityType),
        eq(contentRevisions.entityId, entityId),
      ),
    )
    .orderBy(desc(contentRevisions.createdAt))
    .limit(50);
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'number')
    return new Date(value < 100000000000 ? value * 1000 : value);
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function strings(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : null;
}

function projectScreenshots(
  value: unknown,
): Array<{ src: string; alt: string; caption?: string }> | null {
  if (!Array.isArray(value) || value.length > 8) return null;
  const seen = new Set<string>();
  const result: Array<{ src: string; alt: string; caption?: string }> = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    if (
      Object.keys(row).some((key) => !['src', 'alt', 'caption'].includes(key))
    )
      return null;
    if (
      typeof row.src !== 'string' ||
      !isSafeImageReference(row.src) ||
      seen.has(row.src)
    )
      return null;
    if (typeof row.alt !== 'string' || !row.alt.trim() || row.alt.length > 300)
      return null;
    if (
      row.caption !== undefined &&
      (typeof row.caption !== 'string' || row.caption.length > 200)
    )
      return null;
    seen.add(row.src);
    result.push({
      src: row.src,
      alt: row.alt,
      ...(typeof row.caption === 'string' && row.caption
        ? { caption: row.caption }
        : {}),
    });
  }
  return result;
}

export async function restoreContentRevision(
  actor: string | null,
  entityType: RevisionEntityType,
  entityId: string,
  revisionId: string,
  mdxSlugs: RevisionMdxSlugCollections,
): Promise<boolean> {
  await migrateDatabase();
  try {
    return await getDatabase().transaction(async (tx) => {
      const [revision] = await tx
        .select()
        .from(contentRevisions)
        .where(
          and(
            eq(contentRevisions.id, revisionId),
            eq(contentRevisions.entityType, entityType),
            eq(contentRevisions.entityId, entityId),
          ),
        );
      if (!revision) return false;
      const normalized = normalizeRevisionSnapshot(
        entityType,
        revision.snapshot,
      );
      if (!normalized.success) return false;
      const validated = validateRevisionSnapshot(
        entityType,
        normalized.data,
        entityId,
        revision.actorUserId === null && revision.restoredFromId === null,
      );
      if (!validated.success) return false;
      const snapshot = validated.data;
      const now = new Date();
      let current: Record<string, unknown> | undefined;

      if (entityType === 'now_status') {
        const currentFocus = snapshot.currentFocus;
        const workingOn = strings(snapshot.workingOn);
        const learning = strings(snapshot.learning);
        const using = strings(snapshot.using);
        if (
          entityId !== 'primary' ||
          typeof currentFocus !== 'string' ||
          !workingOn ||
          !learning ||
          !using ||
          typeof snapshot.published !== 'boolean'
        )
          return false;
        const [saved] = await tx
          .update(nowStatus)
          .set({
            id: 'primary',
            currentFocus,
            workingOn,
            learning,
            using,
            statusNote:
              typeof snapshot.statusNote === 'string'
                ? snapshot.statusNote
                : null,
            published: snapshot.published,
            updatedAt: now,
          })
          .where(eq(nowStatus.id, 'primary'))
          .returning();
        if (!saved) throw new RevisionRestoreAborted();
        current = saved;
      } else if (entityType === 'homepage_settings') {
        const cards = asRecord(snapshot.cards);
        if (
          entityId !== 'primary' ||
          !Array.isArray(snapshot.heroRoles) ||
          !Array.isArray(snapshot.aboutParagraphs) ||
          !Array.isArray(snapshot.aboutMetadata) ||
          !Array.isArray(snapshot.stackGroups) ||
          !cards
        )
          return false;
        const config = snapshot as unknown as HomepageConfig;
        await tx
          .insert(homepageSettings)
          .values({
            id: entityId,
            settings: config as unknown as Record<string, unknown>,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: homepageSettings.id,
            set: {
              settings: config as unknown as Record<string, unknown>,
              updatedAt: now,
            },
          });
        current = { id: entityId, ...config, updatedAt: now };
      } else if (entityType === 'site_settings') {
        const settings = {
          siteName: snapshot.siteName,
          name: snapshot.name,
          seoDescription: snapshot.seoDescription,
          github: snapshot.github,
          email: snapshot.email,
        };
        if (
          entityId !== 'primary' ||
          Object.values(settings).some((value) => typeof value !== 'string') ||
          !String(settings.siteName).trim() ||
          String(settings.siteName).length > 50 ||
          !String(settings.name).trim() ||
          String(settings.name).length > 100 ||
          !String(settings.seoDescription).trim() ||
          String(settings.seoDescription).length > 320 ||
          !/^https:\/\/github\.com\/[A-Za-z0-9-]+\/?$/i.test(
            String(settings.github),
          ) ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(settings.email)) ||
          String(settings.email).length > 254
        )
          return false;
        await tx
          .insert(siteSettings)
          .values({ id: entityId, settings, updatedAt: now })
          .onConflictDoUpdate({
            target: siteSettings.id,
            set: { settings, updatedAt: now },
          });
        current = { id: entityId, ...settings, updatedAt: now };
      } else if (entityType === 'project') {
        const stack = strings(snapshot.stack);
        const highlights = strings(snapshot.highlights);
        const screenshots =
          snapshot.screenshots === undefined
            ? []
            : projectScreenshots(snapshot.screenshots);
        const links = snapshot.links;
        const createdAt = asDate(snapshot.createdAt);
        const projectDate =
          snapshot.projectDate === null ? null : asDate(snapshot.projectDate);
        const [existing] = await tx
          .select()
          .from(projectRecords)
          .where(eq(projectRecords.id, entityId));
        if (
          !existing ||
          !stack ||
          !highlights ||
          !screenshots ||
          !Array.isArray(links) ||
          !createdAt ||
          (snapshot.projectDate !== null && !projectDate) ||
          typeof snapshot.slug !== 'string' ||
          !isValidRestoredSlug('project', snapshot.slug)
        )
          return false;
        if (
          isMdxSlugClaimConflict(mdxSlugs.project, snapshot.slug, {
            replacesMdx: snapshot.replacesMdx === true,
            currentSlug: existing.slug,
          })
        )
          return false;
        await assertContentSlugAvailable(
          tx,
          'project',
          snapshot.slug,
          entityId,
        );
        const [saved] = await tx
          .update(projectRecords)
          .set({
            slug: snapshot.slug,
            title: snapshot.title as string,
            description: snapshot.description as string,
            status: snapshot.status as string,
            category:
              typeof snapshot.category === 'string' ? snapshot.category : null,
            role: typeof snapshot.role === 'string' ? snapshot.role : null,
            problem:
              typeof snapshot.problem === 'string' ? snapshot.problem : null,
            solution:
              typeof snapshot.solution === 'string' ? snapshot.solution : null,
            stack,
            links: links as Array<{
              label: string;
              href: string;
              external: boolean;
            }>,
            github:
              typeof snapshot.github === 'string' ? snapshot.github : null,
            demo: typeof snapshot.demo === 'string' ? snapshot.demo : null,
            caseStudyBody:
              typeof snapshot.caseStudyBody === 'string'
                ? snapshot.caseStudyBody
                : null,
            projectDate,
            highlights,
            cover: typeof snapshot.cover === 'string' ? snapshot.cover : null,
            screenshots,
            replacesMdx: snapshot.replacesMdx === true,
            featured: snapshot.featured as boolean,
            visible: snapshot.visible as boolean,
            archived: snapshot.archived as boolean,
            statusBeforeArchive:
              typeof snapshot.statusBeforeArchive === 'string'
                ? snapshot.statusBeforeArchive
                : null,
            orderIndex:
              typeof snapshot.orderIndex === 'number'
                ? snapshot.orderIndex
                : null,
            createdAt,
            updatedAt: now,
          })
          .where(eq(projectRecords.id, entityId))
          .returning();
        if (!saved) throw new RevisionRestoreAborted();
        await maintainPublicSlugHistory(
          tx,
          actor,
          'project',
          entityId,
          existing,
          saved,
          mdxSlugs.project,
        );
        current = saved;
      } else if (entityType === 'note') {
        const tags = strings(snapshot.tags);
        const createdAt = asDate(snapshot.createdAt);
        if (
          !tags ||
          !createdAt ||
          typeof snapshot.slug !== 'string' ||
          !isValidRestoredSlug('note', snapshot.slug)
        )
          return false;
        const [existing] = await tx
          .select()
          .from(noteRecords)
          .where(eq(noteRecords.id, entityId));
        if (!existing) return false;
        if (
          isMdxSlugClaimConflict(mdxSlugs.note, snapshot.slug, {
            replacesMdx: snapshot.replacesMdx === true,
            currentSlug: existing.slug,
          })
        )
          return false;
        await assertContentSlugAvailable(tx, 'note', snapshot.slug, entityId);
        const [saved] = await tx
          .update(noteRecords)
          .set({
            slug: snapshot.slug,
            title: snapshot.title as string,
            description: snapshot.description as string,
            summary:
              typeof snapshot.summary === 'string' ? snapshot.summary : null,
            category: snapshot.category as string,
            tags,
            body: snapshot.body as string,
            published: snapshot.published as boolean,
            featured: snapshot.featured as boolean,
            replacesMdx: snapshot.replacesMdx === true,
            createdAt,
            updatedAt: now,
          })
          .where(eq(noteRecords.id, entityId))
          .returning();
        if (!saved) throw new RevisionRestoreAborted();
        await maintainPublicSlugHistory(
          tx,
          actor,
          'note',
          entityId,
          existing,
          saved,
          mdxSlugs.note,
        );
        current = saved;
      } else if (entityType === 'blog') {
        const tags = strings(snapshot.tags);
        const createdAt = asDate(snapshot.createdAt);
        if (
          !tags ||
          !createdAt ||
          typeof snapshot.slug !== 'string' ||
          !isValidRestoredSlug('blog', snapshot.slug)
        )
          return false;
        const [existing] = await tx
          .select()
          .from(blogRecords)
          .where(eq(blogRecords.id, entityId));
        if (!existing) return false;
        await assertContentSlugAvailable(tx, 'blog', snapshot.slug, entityId);
        const [saved] = await tx
          .update(blogRecords)
          .set({
            slug: snapshot.slug,
            title: snapshot.title as string,
            description: snapshot.description as string,
            summary:
              typeof snapshot.summary === 'string' ? snapshot.summary : null,
            cover:
              typeof snapshot.cover === 'string' &&
              isSafeImageReference(snapshot.cover)
                ? snapshot.cover
                : null,
            category: snapshot.category as string,
            tags,
            body: snapshot.body as string,
            published: snapshot.published as boolean,
            featured: snapshot.featured as boolean,
            archived: snapshot.archived as boolean,
            createdAt,
            updatedAt: now,
          })
          .where(eq(blogRecords.id, entityId))
          .returning();
        if (!saved) throw new RevisionRestoreAborted();
        await maintainPublicSlugHistory(
          tx,
          actor,
          'blog',
          entityId,
          existing,
          saved,
        );
        current = saved;
      } else {
        const tags = strings(snapshot.tags);
        const tools = strings(snapshot.tools);
        const lessons = strings(snapshot.lessons);
        const date = asDate(snapshot.date);
        const updatedAt =
          snapshot.updatedAt === null ? null : asDate(snapshot.updatedAt);
        if (
          !tags ||
          !tools ||
          !lessons ||
          !date ||
          (snapshot.updatedAt !== null && !updatedAt) ||
          typeof snapshot.slug !== 'string' ||
          !isValidRestoredSlug('lab', snapshot.slug)
        )
          return false;
        const [existing] = await tx
          .select()
          .from(labRecords)
          .where(eq(labRecords.id, entityId));
        if (!existing) return false;
        if (
          isMdxSlugClaimConflict(mdxSlugs.lab, snapshot.slug, {
            replacesMdx: snapshot.replacesMdx === true,
            currentSlug: existing.slug,
          })
        )
          return false;
        await assertContentSlugAvailable(tx, 'lab', snapshot.slug, entityId);
        const [saved] = await tx
          .update(labRecords)
          .set({
            slug: snapshot.slug,
            title: snapshot.title as string,
            description: snapshot.description as string,
            status: snapshot.status as string,
            category:
              typeof snapshot.category === 'string' ? snapshot.category : null,
            tags,
            visible: snapshot.visible as boolean,
            featured: snapshot.featured as boolean,
            repo: typeof snapshot.repo === 'string' ? snapshot.repo : null,
            demo: typeof snapshot.demo === 'string' ? snapshot.demo : null,
            relatedProject:
              typeof snapshot.relatedProject === 'string'
                ? snapshot.relatedProject
                : null,
            tools,
            lessons,
            risk: typeof snapshot.risk === 'string' ? snapshot.risk : null,
            body: snapshot.body as string,
            replacesMdx: snapshot.replacesMdx === true,
            date,
            updatedAt,
          })
          .where(eq(labRecords.id, entityId))
          .returning();
        if (!saved) throw new RevisionRestoreAborted();
        await maintainPublicSlugHistory(
          tx,
          actor,
          'lab',
          entityId,
          existing,
          saved,
          mdxSlugs.lab,
        );
        current = saved;
      }

      await tx
        .insert(contentRevisions)
        .values(
          revisionValues(actor, entityType, entityId, current, revisionId),
        );
      await pruneContentRevisions(tx, entityType, entityId);
      await tx.insert(auditLog).values(
        auditEvent(
          actor,
          `${entityType}.revision.restore`,
          entityType,
          entityId,
          {
            restoredFrom: revisionId,
          },
        ),
      );
      return true;
    });
  } catch (error) {
    if (
      error instanceof RevisionRestoreAborted ||
      error instanceof SlugRedirectConflictError
    )
      return false;
    throw error;
  }
}
