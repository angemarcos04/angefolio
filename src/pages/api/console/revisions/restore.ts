import type { APIRoute } from 'astro';
import {
  getAllLabEntries,
  getAllNotes,
  getAllProjects,
  getProjectSlug,
} from '../../../../lib/content';
import { mdxSlugFromId } from '../../../../lib/data/mdxSlug';
import {
  hasTrustedOrigin,
  readUrlEncodedForm,
} from '../../../../lib/server/security';
import {
  restoreContentRevision,
  revisionEntityTypes,
  type RevisionMdxSlugCollections,
} from '../../../../lib/server/revisions';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user)
    return new Response('Authentication required.', { status: 401 });
  if (!hasTrustedOrigin(request))
    return Response.redirect(new URL('/user?error=invalid', request.url), 303);
  const form = await readUrlEncodedForm(request);
  if (!form)
    return Response.redirect(new URL('/user?error=invalid', request.url), 303);
  const entityType = form.get('entityType') ?? '';
  const entityId = form.get('entityId') ?? '';
  const revisionId = form.get('revisionId') ?? '';
  if (
    !revisionEntityTypes.includes(
      entityType as (typeof revisionEntityTypes)[number],
    ) ||
    !entityId ||
    entityId.length > 64 ||
    !revisionId ||
    revisionId.length > 64
  ) {
    return Response.redirect(new URL('/user?error=invalid', request.url), 303);
  }
  const type = entityType as (typeof revisionEntityTypes)[number];
  const path =
    type === 'now_status'
      ? '/user/now'
      : type === 'homepage_settings'
        ? '/user/homepage'
        : type === 'site_settings'
          ? '/user/settings'
          : `/user/${type === 'project' ? 'projects' : type === 'note' ? 'notes' : type === 'blog' ? 'blog' : 'lab'}/${encodeURIComponent(entityId)}`;
  try {
    const mdxSlugs: RevisionMdxSlugCollections = {
      project: [],
      note: [],
      lab: [],
    };
    if (type === 'project') {
      mdxSlugs.project = (await getAllProjects()).map(getProjectSlug);
    } else if (type === 'note') {
      mdxSlugs.note = (await getAllNotes()).map((entry) =>
        mdxSlugFromId(entry.id),
      );
    } else if (type === 'lab') {
      mdxSlugs.lab = (await getAllLabEntries()).map((entry) =>
        mdxSlugFromId(entry.id),
      );
    }
    const restored = await restoreContentRevision(
      locals.user.id,
      type,
      entityId,
      revisionId,
      mdxSlugs,
    );
    return Response.redirect(
      new URL(
        `${path}?notice=${restored ? 'restored' : 'restore-failed'}`,
        request.url,
      ),
      303,
    );
  } catch {
    return Response.redirect(
      new URL(`${path}?notice=restore-failed`, request.url),
      303,
    );
  }
};
