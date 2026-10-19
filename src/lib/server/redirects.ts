import { eq, sql, type SQL } from 'drizzle-orm';
import { getDatabase, migrateDatabase } from './db/client';
import { contentPublicSlugs, contentRedirects } from './db/schema';

export const redirectEntityTypes = ['project', 'note', 'blog', 'lab'] as const;
export type RedirectEntityType = (typeof redirectEntityTypes)[number];

export interface ContentRedirectRecord {
  fromPath: string;
  toPath: string;
  entityType: string;
  entityId: string;
}

export type ContentRedirectLookup =
  | { status: 'found'; record: ContentRedirectRecord }
  | { status: 'missing' }
  | { status: 'unavailable' };

export class SlugRedirectConflictError extends Error {
  constructor() {
    super('That slug is already in use or reserved.');
    this.name = 'SlugRedirectConflictError';
  }
}

const slugTables: Record<RedirectEntityType, string> = {
  project: 'project_records',
  note: 'note_records',
  blog: 'blog_records',
  lab: 'lab_records',
};

/** True only for a recognized slug uniqueness failure, not arbitrary DB errors. */
export function isSlugUniqueConstraintError(
  error: unknown,
  type: RedirectEntityType,
): boolean {
  const table = slugTables[type];
  const message = error instanceof Error ? error.message : String(error);
  return new RegExp(
    `(?:UNIQUE constraint failed:|SQLITE_CONSTRAINT_UNIQUE[^\\n]*?)\\s*(?:main\\.)?${table}\\.slug`,
    'i',
  ).test(message);
}

/**
 * Enforce database slug and redirect-alias ownership inside the content write
 * transaction. An alias owned by the edited record is reclaimed as its
 * canonical slug; aliases owned by any other entity remain reserved.
 */
export async function assertContentSlugAvailable(
  transaction: unknown,
  type: RedirectEntityType,
  slug: string,
  entityId?: string,
): Promise<void> {
  const tx = transaction as RawTransaction;
  const table = slugTables[type];
  const databaseOwner = (await tx.run(sql`
    SELECT id FROM ${sql.raw(table)} WHERE slug = ${slug} LIMIT 1
  `)) as { rows?: Array<Record<string, unknown>> };
  const databaseOwnerId = databaseOwner.rows?.[0]?.id;
  if (typeof databaseOwnerId === 'string' && databaseOwnerId !== entityId) {
    throw new SlugRedirectConflictError();
  }

  const path = contentPath(type, slug);
  const publicOwnerResult = (await tx.run(sql`
    SELECT entity_type, entity_id FROM content_public_slugs
    WHERE path = ${path} LIMIT 1
  `)) as { rows?: Array<Record<string, unknown>> };
  const publicOwner = publicOwnerResult.rows?.[0];
  if (
    publicOwner &&
    (!entityId ||
      publicOwner.entity_type !== type ||
      publicOwner.entity_id !== entityId)
  )
    throw new SlugRedirectConflictError();
  const aliasResult = (await tx.run(sql`
    SELECT entity_type, entity_id FROM content_redirects
    WHERE from_path = ${path} LIMIT 1
  `)) as { rows?: Array<Record<string, unknown>> };
  const alias = aliasResult.rows?.[0];
  if (!alias) return;
  if (!entityId || alias.entity_type !== type || alias.entity_id !== entityId) {
    throw new SlugRedirectConflictError();
  }

  await tx.run(sql`
    DELETE FROM content_redirects
    WHERE from_path = ${path} AND entity_type = ${type} AND entity_id = ${entityId}
  `);
}

export type RedirectSlugOwnership =
  'available' | 'same-entity' | 'reserved' | 'unavailable';

/** Route-level check used to return a useful slug-field error before saving. */
export async function getRedirectSlugOwnership(
  type: RedirectEntityType,
  slug: string,
  entityId?: string,
): Promise<RedirectSlugOwnership> {
  const lookup = await getContentRedirect(contentPath(type, slug));
  if (lookup.status === 'unavailable') return 'unavailable';
  const aliasOwnership =
    lookup.status === 'missing'
      ? 'available'
      : entityId &&
          lookup.record.entityType === type &&
          lookup.record.entityId === entityId
        ? 'same-entity'
        : 'reserved';
  if (aliasOwnership === 'reserved') return 'reserved';
  try {
    const [history] = await getDatabase()
      .select({
        entityType: contentPublicSlugs.entityType,
        entityId: contentPublicSlugs.entityId,
      })
      .from(contentPublicSlugs)
      .where(eq(contentPublicSlugs.path, contentPath(type, slug)));
    if (!history) return aliasOwnership;
    return entityId &&
      history.entityType === type &&
      history.entityId === entityId
      ? 'same-entity'
      : 'reserved';
  } catch {
    return 'unavailable';
  }
}

export function contentPath(type: RedirectEntityType, slug: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new SlugRedirectConflictError();
  }
  const section =
    type === 'project'
      ? 'projects'
      : type === 'note'
        ? 'notes'
        : type === 'blog'
          ? 'blog'
          : 'lab';
  return `/${section}/${slug}`;
}

interface RawTransaction {
  run(query: SQL): Promise<unknown>;
}

/** Keep aliases already owned by an entity pointed at its current canonical
 * path. This deliberately does not create an alias for the previous slug, so
 * private-only slugs do not become public URL history. */
export async function repointExistingContentAliases(
  transaction: unknown,
  type: RedirectEntityType,
  entityId: string,
  toSlug: string,
): Promise<void> {
  const toPath = contentPath(type, toSlug);
  await (transaction as RawTransaction).run(sql`
    UPDATE content_redirects
    SET to_path = ${toPath}
    WHERE entity_type = ${type}
      AND entity_id = ${entityId}
      AND from_path <> ${toPath}
  `);
}

async function redirectOwner(
  transaction: RawTransaction,
  path: string,
): Promise<{ entityType: string; entityId: string } | null> {
  const result = (await transaction.run(sql`
    SELECT entity_type, entity_id
    FROM content_redirects
    WHERE from_path = ${path}
    LIMIT 1
  `)) as { rows?: Array<Record<string, unknown>> };
  const row = result.rows?.[0];
  return typeof row?.entity_type === 'string' &&
    typeof row.entity_id === 'string'
    ? { entityType: row.entity_type, entityId: row.entity_id }
    : null;
}

export async function recordSlugRedirect(
  transaction: unknown,
  actorUserId: string | null,
  type: RedirectEntityType,
  entityId: string,
  fromSlug: string,
  toSlug: string,
): Promise<void> {
  if (fromSlug === toSlug) return;
  const fromPath = contentPath(type, fromSlug);
  const toPath = contentPath(type, toSlug);
  const tx = transaction as RawTransaction;

  const reclaimedOwner = await redirectOwner(tx, toPath);
  if (
    reclaimedOwner &&
    (reclaimedOwner.entityType !== type || reclaimedOwner.entityId !== entityId)
  ) {
    throw new SlugRedirectConflictError();
  }
  if (reclaimedOwner) {
    await tx.run(
      sql`DELETE FROM content_redirects
        WHERE from_path = ${toPath}
          AND entity_type = ${type}
          AND entity_id = ${entityId}`,
    );
  }

  const sourceOwner = await redirectOwner(tx, fromPath);
  if (sourceOwner) throw new SlugRedirectConflictError();

  // Keep only this entity's earlier aliases pointed directly at its newest
  // canonical URL. The scoped helper never creates an alias for fromSlug.
  await repointExistingContentAliases(tx, type, entityId, toSlug);
  await tx.run(sql`
    INSERT INTO content_redirects (from_path, to_path, entity_type, entity_id, created_at)
    VALUES (${fromPath}, ${toPath}, ${type}, ${entityId}, ${Math.floor(Date.now() / 1000)})
  `);
  await tx.run(sql`
    INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id, metadata_json, created_at)
    VALUES (
      ${crypto.randomUUID()}, ${actorUserId}, 'content.redirect.create', ${type}, ${entityId},
      ${JSON.stringify({ fromPath, toPath })}, ${Math.floor(Date.now() / 1000)}
    )
  `);
}

export async function getContentRedirectTarget(
  path: string,
): Promise<string | null> {
  try {
    await migrateDatabase();
    const [record] = await getDatabase()
      .select({ toPath: contentRedirects.toPath })
      .from(contentRedirects)
      .where(eq(contentRedirects.fromPath, path));
    return record?.toPath ?? null;
  } catch {
    return null;
  }
}

/**
 * Return the stored alias only. Public callers must verify its owner against
 * the relevant visibility-filtered catalog before emitting a redirect.
 */
export async function getContentRedirect(
  path: string,
): Promise<ContentRedirectLookup> {
  try {
    await migrateDatabase();
    const [record] = await getDatabase()
      .select({
        fromPath: contentRedirects.fromPath,
        toPath: contentRedirects.toPath,
        entityType: contentRedirects.entityType,
        entityId: contentRedirects.entityId,
      })
      .from(contentRedirects)
      .where(eq(contentRedirects.fromPath, path));
    return record ? { status: 'found', record } : { status: 'missing' };
  } catch {
    // Routes return a noncached 503 instead of resolving an alias without
    // knowing whether it is reserved by redirect history.
    return { status: 'unavailable' };
  }
}

/** Validate redirect ownership and ensure the destination is the owner's
 * current canonical route, not an arbitrary stored path. */
export function publicRedirectTarget(
  redirect: ContentRedirectRecord,
  type: RedirectEntityType,
  ownerId: string | undefined,
  ownerSlug: string,
  requestedPath: string,
): string | null {
  if (
    !ownerId ||
    redirect.entityType !== type ||
    redirect.entityId !== ownerId ||
    redirect.fromPath !== requestedPath
  ) {
    return null;
  }

  try {
    const canonical = contentPath(type, ownerSlug);
    if (redirect.toPath !== canonical || redirect.fromPath === canonical) {
      return null;
    }
    return canonical;
  } catch {
    return null;
  }
}

export async function getRedirectSourcePaths(
  type: RedirectEntityType,
): Promise<Set<string>> {
  await migrateDatabase();
  const rows = await getDatabase()
    .select({ fromPath: contentRedirects.fromPath })
    .from(contentRedirects)
    .where(eq(contentRedirects.entityType, type));
  return new Set(rows.map((row) => row.fromPath));
}
