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
import { getPublicLabCatalog } from '../../../../lib/server/lab';
import { getAllLabEntries } from '../../../../lib/content';
import { SlugRedirectConflictError } from '../../../../lib/server/redirects';

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
  const failure = (code: string) =>
    new Response(null, {
      status: 303,
      headers: {
        location: id
          ? `/user/lab/${encodeURIComponent(id)}?error=${code}`
          : '/user/lab/new?error=' + code,
      },
    });
  const validated = validateLabForm(form);
  if (!validated.success) return failure('validation');
  try {
    const existing = id ? await getLabRecord(id) : undefined;
    if (id && !existing)
      return Response.redirect(
        new URL('/user/lab?error=missing', request.url),
        303,
      );
    const owner = await getLabRecordBySlug(validated.data.slug);
    if (owner && owner.id !== id) return failure('slug');
    const mdxCollision = (await getAllLabEntries()).some(
      (entry) => entry.id.replace(/\.(md|mdx)$/, '') === validated.data.slug,
    );
    if (
      existing &&
      existing.slug !== validated.data.slug &&
      mdxCollision &&
      !validated.data.replacesMdx
    )
      return failure('slug');
    const currentPublic = existing
      ? (await getPublicLabCatalog()).some(
          (entry) =>
            entry.slug === existing.slug && entry.source === 'database',
        )
      : false;
    const record = await saveLabRecord(
      id,
      validated.data,
      locals.user.id,
      currentPublic && validated.data.visible,
    );
    return new Response(null, {
      status: 303,
      headers: { location: `/user/lab/${record.id}?notice=saved` },
    });
  } catch (error) {
    if (error instanceof SlugRedirectConflictError) return failure('slug');
    return failure('unavailable');
  }
};
