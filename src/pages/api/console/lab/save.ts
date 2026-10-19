import type { APIRoute } from 'astro';
import {
  getLabRecord,
  getLabRecordBySlug,
  saveLabRecord,
} from '../../../../lib/server/lab';
import {
  hasTrustedOrigin,
  readUrlEncodedForm,
} from '../../../../lib/server/security';
import { validateLabForm } from '../../../../lib/server/validation/lab';
import { getAllLabEntries } from '../../../../lib/content';
import {
  isMdxSlugClaimConflict,
  mdxSlugFromId,
} from '../../../../lib/data/mdxSlug';
import {
  getRedirectSlugOwnership,
  isSlugUniqueConstraintError,
  SlugRedirectConflictError,
} from '../../../../lib/server/redirects';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user)
    return new Response('Authentication required.', { status: 401 });
  if (!hasTrustedOrigin(request))
    return Response.redirect(
      new URL('/user/lab?error=invalid', request.url),
      303,
    );
  const form = await readUrlEncodedForm(request, 768 * 1024);
  if (!form)
    return Response.redirect(
      new URL('/user/lab?error=validation', request.url),
      303,
    );
  const id = form.get('id') || null;
  const failure = (code: string, field?: string) => {
    const query = `error=${code}${field ? `&field=${encodeURIComponent(field)}` : ''}`;
    return new Response(null, {
      status: 303,
      headers: {
        location: id
          ? `/user/lab/${encodeURIComponent(id)}?${query}`
          : `/user/lab/new?${query}`,
      },
    });
  };
  const validated = validateLabForm(form);
  if (!validated.success)
    return failure('validation', Object.keys(validated.errors)[0]);
  try {
    const existing = id ? await getLabRecord(id) : undefined;
    if (id && !existing)
      return Response.redirect(
        new URL('/user/lab?error=missing', request.url),
        303,
      );
    const owner = await getLabRecordBySlug(validated.data.slug);
    if (owner && owner.id !== id) return failure('slug', 'slug');
    const mdxSlugs = (await getAllLabEntries()).map((entry) =>
      mdxSlugFromId(entry.id),
    );
    const mdxCollision = isMdxSlugClaimConflict(mdxSlugs, validated.data.slug, {
      replacesMdx: validated.data.replacesMdx,
      currentSlug: existing?.slug,
    });
    if (mdxCollision) return failure('slug', 'slug');
    const redirectOwnership = await getRedirectSlugOwnership(
      'lab',
      validated.data.slug,
      existing?.id,
    );
    if (redirectOwnership === 'unavailable') return failure('unavailable');
    if (redirectOwnership === 'reserved') return failure('slug', 'slug');
    const record = await saveLabRecord(
      id,
      validated.data,
      locals.user.id,
      mdxSlugs,
    );
    return new Response(null, {
      status: 303,
      headers: { location: `/user/lab/${record.id}?notice=saved` },
    });
  } catch (error) {
    if (
      error instanceof SlugRedirectConflictError ||
      isSlugUniqueConstraintError(error, 'lab')
    )
      return failure('slug', 'slug');
    return failure('unavailable');
  }
};
