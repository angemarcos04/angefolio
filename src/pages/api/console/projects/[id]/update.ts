import type { APIRoute } from 'astro';
import {
  getConsoleProjectBySlug,
  getProjectRecordById,
  updateProjectRecord,
} from '../../../../../lib/server/projects';
import {
  hasTrustedOrigin,
  readUrlEncodedForm,
} from '../../../../../lib/server/security';
import { validateProjectForm } from '../../../../../lib/server/validation/projects';
import { getAllProjects, getProjectSlug } from '../../../../../lib/content';
import { isMdxSlugClaimConflict } from '../../../../../lib/data/mdxSlug';
import {
  getRedirectSlugOwnership,
  isSlugUniqueConstraintError,
  SlugRedirectConflictError,
} from '../../../../../lib/server/redirects';

const maximumProjectFormBytes = 512 * 1024;

function redirect(id: string, code: string, field?: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      location: `/user/projects/${encodeURIComponent(id)}?error=${code}${field ? `&field=${encodeURIComponent(field)}` : ''}`,
    },
  });
}

function validationRedirect(
  id: string,
  errors: Record<string, string>,
): Response {
  const field = Object.keys(errors)[0] ?? 'project';
  return new Response(null, {
    status: 303,
    headers: {
      location: `/user/projects/${encodeURIComponent(id)}?error=validation&field=${encodeURIComponent(field)}`,
    },
  });
}

export const POST: APIRoute = async ({ request, locals, params }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'Authentication required.' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const id = params.id ?? '';
  if (!id || id.length > 64 || !hasTrustedOrigin(request)) {
    return redirect(id, 'invalid');
  }

  const form = await readUrlEncodedForm(request, maximumProjectFormBytes);
  if (!form) return redirect(id, 'validation');

  try {
    const existing = await getProjectRecordById(id);
    if (!existing) {
      return new Response(null, {
        status: 303,
        headers: { location: '/user/projects?error=missing' },
      });
    }

    const result = validateProjectForm(form, {
      allowArchivedStatus: existing.archived,
    });
    if (!result.success) return validationRedirect(id, result.errors);

    const slugOwner = await getConsoleProjectBySlug(result.data.slug);
    if (slugOwner && slugOwner.id !== id) return redirect(id, 'slug', 'slug');

    const mdxSlugs = (await getAllProjects()).map(getProjectSlug);
    const mdxCollision = isMdxSlugClaimConflict(mdxSlugs, result.data.slug, {
      replacesMdx: result.data.replacesMdx,
      currentSlug: existing.slug,
    });
    if (mdxCollision) {
      return redirect(id, 'slug', 'slug');
    }
    const redirectOwnership = await getRedirectSlugOwnership(
      'project',
      result.data.slug,
      id,
    );
    if (redirectOwnership === 'unavailable') return redirect(id, 'unavailable');
    if (redirectOwnership === 'reserved') return redirect(id, 'slug', 'slug');
    await updateProjectRecord(id, result.data, locals.user.id, mdxSlugs);
    return new Response(null, {
      status: 303,
      headers: { location: '/user/projects?notice=updated' },
    });
  } catch (error) {
    if (
      error instanceof SlugRedirectConflictError ||
      isSlugUniqueConstraintError(error, 'project')
    ) {
      return redirect(id, 'slug', 'slug');
    }
    return redirect(id, 'unavailable');
  }
};
