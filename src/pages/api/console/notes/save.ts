import type { APIRoute } from 'astro';
import {
  getNoteRecord,
  getNoteRecordBySlug,
  saveNote,
} from '../../../../lib/server/notes';
import {
  hasTrustedOrigin,
  readUrlEncodedForm,
} from '../../../../lib/server/security';
import { validateNoteForm } from '../../../../lib/server/validation/notes';
import { getPublicNoteCatalog } from '../../../../lib/server/notes';
import { getAllNotes } from '../../../../lib/content';
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
      new URL('/user/notes?error=invalid', request.url),
      303,
    );
  const form = await readUrlEncodedForm(request, 768 * 1024);
  if (!form)
    return Response.redirect(
      new URL('/user/notes?error=validation', request.url),
      303,
    );
  const id = form.get('id') || null;
  const invalid = (code: string, field?: string) => {
    const query = `error=${code}${field ? `&field=${encodeURIComponent(field)}` : ''}`;
    return new Response(null, {
      status: 303,
      headers: {
        location: id
          ? `/user/notes/${encodeURIComponent(id)}?${query}`
          : `/user/notes/new?${query}`,
      },
    });
  };
  const result = validateNoteForm(form);
  if (!result.success)
    return invalid('validation', Object.keys(result.errors)[0]);
  try {
    const existing = id ? await getNoteRecord(id) : undefined;
    if (id && !existing)
      return Response.redirect(
        new URL('/user/notes?error=missing', request.url),
        303,
      );
    const owner = await getNoteRecordBySlug(result.data.slug);
    if (owner && owner.id !== id) return invalid('slug', 'slug');
    const mdxCollision = isMdxSlugClaimConflict(
      (await getAllNotes()).map((entry) => mdxSlugFromId(entry.id)),
      result.data.slug,
      {
        replacesMdx: result.data.replacesMdx,
        currentSlug: existing?.slug,
      },
    );
    if (mdxCollision) return invalid('slug', 'slug');
    const redirectOwnership = await getRedirectSlugOwnership(
      'note',
      result.data.slug,
      existing?.id,
    );
    if (redirectOwnership === 'unavailable') return invalid('unavailable');
    if (redirectOwnership === 'reserved') return invalid('slug', 'slug');
    const currentPublic = existing
      ? (await getPublicNoteCatalog()).some(
          (note) => note.slug === existing.slug && note.source === 'database',
        )
      : false;
    const saved = await saveNote(
      id,
      result.data,
      locals.user.id,
      currentPublic && result.data.published,
    );
    return new Response(null, {
      status: 303,
      headers: { location: `/user/notes/${saved.id}?notice=saved` },
    });
  } catch (error) {
    if (
      error instanceof SlugRedirectConflictError ||
      isSlugUniqueConstraintError(error, 'note')
    )
      return invalid('slug', 'slug');
    return invalid('unavailable');
  }
};
