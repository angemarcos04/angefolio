import { sql, type SQL } from 'drizzle-orm';
import {
  contentPath,
  recordSlugRedirect,
  repointExistingContentAliases,
  SlugRedirectConflictError,
  type RedirectEntityType,
} from './redirects';

interface RawTransaction {
  run(query: SQL): Promise<unknown>;
}

const slugTables: Record<RedirectEntityType, string> = {
  project: 'project_records',
  blog: 'blog_records',
  note: 'note_records',
  lab: 'lab_records',
};

async function assertCanonicalOwner(
  tx: RawTransaction,
  type: RedirectEntityType,
  entityId: string,
  slug: string,
): Promise<void> {
  const owner = (await tx.run(sql`
    SELECT id FROM ${sql.raw(slugTables[type])} WHERE slug = ${slug} LIMIT 1
  `)) as { rows?: Array<Record<string, unknown>> };
  const ownerId = owner.rows?.[0]?.id;
  if (typeof ownerId === 'string' && ownerId !== entityId)
    throw new SlugRedirectConflictError();
}

interface PublicRecordState {
  slug: string;
  visible?: boolean;
  published?: boolean;
  archived?: boolean;
  replacesMdx?: boolean;
  caseStudyBody?: string | null;
  body?: string;
}

/** Match database-backed entries eligible for the public catalogs. */
export function isPublicDatabaseRecord(
  type: RedirectEntityType,
  record: PublicRecordState | null | undefined,
  mdxSlugs: readonly string[] = [],
): boolean {
  if (!record) return false;
  const enabled =
    type === 'project'
      ? record.visible === true && record.archived === false
      : type === 'blog'
        ? record.published === true && record.archived === false
        : type === 'note'
          ? record.published === true
          : record.visible === true;
  if (!enabled) return false;
  if (!mdxSlugs.includes(record.slug)) return true;
  if (type === 'blog' || record.replacesMdx !== true) return false;
  const body = type === 'project' ? record.caseStudyBody : record.body;
  return typeof body === 'string' && !!body.trim();
}

async function rememberPublicSlug(
  tx: RawTransaction,
  type: RedirectEntityType,
  entityId: string,
  slug: string,
): Promise<void> {
  const path = contentPath(type, slug);
  await assertCanonicalOwner(tx, type, entityId, slug);
  const existing = (await tx.run(sql`
    SELECT entity_type, entity_id FROM content_public_slugs
    WHERE path = ${path} LIMIT 1
  `)) as { rows?: Array<Record<string, unknown>> };
  const owner = existing.rows?.[0];
  if (owner) {
    if (owner.entity_type !== type || owner.entity_id !== entityId)
      throw new SlugRedirectConflictError();
    return;
  }
  const alias = (await tx.run(sql`
    SELECT entity_type, entity_id FROM content_redirects
    WHERE from_path = ${path} LIMIT 1
  `)) as { rows?: Array<Record<string, unknown>> };
  const aliasOwner = alias.rows?.[0];
  if (
    aliasOwner &&
    (aliasOwner.entity_type !== type || aliasOwner.entity_id !== entityId)
  )
    throw new SlugRedirectConflictError();
  await tx.run(sql`
    INSERT INTO content_public_slugs
      (path, entity_type, entity_id, first_observed_at)
    VALUES (${path}, ${type}, ${entityId}, ${Math.floor(Date.now() / 1000)})
  `);
}

/**
 * Called inside the same write transaction as content, revisions, and audit.
 * Existing public canonical slugs are observed before their state changes;
 * newly public canonical slugs are recorded after the change. Only recorded
 * public slugs become new aliases. Existing owned aliases remain direct.
 */
export async function maintainPublicSlugHistory(
  transaction: unknown,
  actorUserId: string | null,
  type: RedirectEntityType,
  entityId: string,
  previous: PublicRecordState | null | undefined,
  next: PublicRecordState,
  mdxSlugs: readonly string[] = [],
): Promise<void> {
  const tx = transaction as RawTransaction;
  if (isPublicDatabaseRecord(type, previous, mdxSlugs))
    await rememberPublicSlug(tx, type, entityId, previous!.slug);
  if (isPublicDatabaseRecord(type, next, mdxSlugs))
    await rememberPublicSlug(tx, type, entityId, next.slug);

  if (previous?.slug === next.slug) return;
  const toPath = contentPath(type, next.slug);
  const result = (await tx.run(sql`
    SELECT path FROM content_public_slugs
    WHERE entity_type = ${type} AND entity_id = ${entityId}
  `)) as { rows?: Array<Record<string, unknown>> };
  for (const row of result.rows ?? []) {
    const path = row.path;
    if (typeof path !== 'string' || path === toPath) continue;
    const fromSlug = path.split('/').at(-1) ?? '';
    if (contentPath(type, fromSlug) !== path)
      throw new SlugRedirectConflictError();
    await assertCanonicalOwner(tx, type, entityId, fromSlug);
    const alias = (await tx.run(sql`
      SELECT entity_type, entity_id FROM content_redirects
      WHERE from_path = ${path} LIMIT 1
    `)) as { rows?: Array<Record<string, unknown>> };
    const owner = alias.rows?.[0];
    if (owner) {
      if (owner.entity_type !== type || owner.entity_id !== entityId)
        throw new SlugRedirectConflictError();
      continue;
    }
    await recordSlugRedirect(
      tx,
      actorUserId,
      type,
      entityId,
      fromSlug,
      next.slug,
    );
  }
  await repointExistingContentAliases(tx, type, entityId, next.slug);
}
