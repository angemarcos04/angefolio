import { eq, sql, type SQL } from 'drizzle-orm';
import { getDatabase, migrateDatabase } from './db/client';
import { contentRedirects } from './db/schema';

export const redirectEntityTypes = ['project', 'note', 'blog', 'lab'] as const;
export type RedirectEntityType = (typeof redirectEntityTypes)[number];

export class SlugRedirectConflictError extends Error {
  constructor() {
    super(
      'That slug cannot be used because it would conflict with a redirect.',
    );
    this.name = 'SlugRedirectConflictError';
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

async function redirectOwner(
  transaction: RawTransaction,
  path: string,
): Promise<string | null> {
  const result = (await transaction.run(sql`
    SELECT entity_id FROM content_redirects WHERE from_path = ${path} LIMIT 1
  `)) as { rows?: Array<Record<string, unknown>> };
  const owner = result.rows?.[0]?.entity_id;
  return typeof owner === 'string' ? owner : null;
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
  if (reclaimedOwner && reclaimedOwner !== entityId) {
    throw new SlugRedirectConflictError();
  }
  if (reclaimedOwner === entityId) {
    await tx.run(
      sql`DELETE FROM content_redirects WHERE from_path = ${toPath}`,
    );
  }

  const sourceOwner = await redirectOwner(tx, fromPath);
  if (sourceOwner) throw new SlugRedirectConflictError();

  // Keep every earlier alias pointed directly at the newest canonical URL.
  await tx.run(sql`
    UPDATE content_redirects SET to_path = ${toPath} WHERE to_path = ${fromPath}
  `);
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
