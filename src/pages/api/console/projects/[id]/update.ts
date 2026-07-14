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

const maximumProjectFormBytes = 64 * 1024;

function redirect(id: string, code: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      location: `/console/projects/${encodeURIComponent(id)}?error=${code}`,
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
      location: `/console/projects/${encodeURIComponent(id)}?error=validation&field=${encodeURIComponent(field)}`,
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
        headers: { location: '/console/projects?error=missing' },
      });
    }

    const result = validateProjectForm(form, {
      allowArchivedStatus: existing.archived,
    });
    if (!result.success) return validationRedirect(id, result.errors);

    const slugOwner = await getConsoleProjectBySlug(result.data.slug);
    if (slugOwner && slugOwner.id !== id) return redirect(id, 'slug');

    await updateProjectRecord(id, result.data);
    return new Response(null, {
      status: 303,
      headers: { location: '/console/projects?notice=updated' },
    });
  } catch {
    return redirect(id, 'unavailable');
  }
};
