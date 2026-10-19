import type { APIRoute } from 'astro';
import {
  getBlogRecord,
  getBlogRecordBySlug,
  saveBlogPost,
} from '../../../../lib/server/blog';
import {
  getRedirectSlugOwnership,
  isSlugUniqueConstraintError,
  SlugRedirectConflictError,
} from '../../../../lib/server/redirects';
import {
  hasTrustedOrigin,
  readUrlEncodedForm,
} from '../../../../lib/server/security';
import { validateBlogForm } from '../../../../lib/server/validation/blog';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user)
    return new Response('Authentication required.', { status: 401 });
  if (!hasTrustedOrigin(request))
    return Response.redirect(
      new URL('/user/blog?error=invalid', request.url),
      303,
    );
  const form = await readUrlEncodedForm(request, 768 * 1024);
  if (!form)
    return Response.redirect(
      new URL('/user/blog?error=validation', request.url),
      303,
    );

  const id = form.get('id') || null;
  const invalid = (code: string, field?: string) => {
    const query = `error=${code}${field ? `&field=${encodeURIComponent(field)}` : ''}`;
    return new Response(null, {
      status: 303,
      headers: {
        location: id
          ? `/user/blog/${encodeURIComponent(id)}?${query}`
          : `/user/blog/new?${query}`,
      },
    });
  };
  const result = validateBlogForm(form);
  if (!result.success)
    return invalid('validation', Object.keys(result.errors)[0]);

  try {
    const existing = id ? await getBlogRecord(id) : undefined;
    if (id && !existing)
      return Response.redirect(
        new URL('/user/blog?error=missing', request.url),
        303,
      );
    const owner = await getBlogRecordBySlug(result.data.slug);
    if (owner && owner.id !== id) return invalid('slug', 'slug');
    const redirectOwnership = await getRedirectSlugOwnership(
      'blog',
      result.data.slug,
      existing?.id,
    );
    if (redirectOwnership === 'unavailable') return invalid('unavailable');
    if (redirectOwnership === 'reserved') return invalid('slug', 'slug');

    const post = await saveBlogPost(id, result.data, locals.user.id);
    return new Response(null, {
      status: 303,
      headers: { location: `/user/blog/${post.id}?notice=saved` },
    });
  } catch (error) {
    if (
      error instanceof SlugRedirectConflictError ||
      isSlugUniqueConstraintError(error, 'blog')
    )
      return invalid('slug', 'slug');
    return invalid('unavailable');
  }
};
