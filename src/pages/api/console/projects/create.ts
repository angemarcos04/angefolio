import type { APIRoute } from 'astro';
import {
  createProjectRecord,
  getConsoleProjectBySlug,
} from '../../../../lib/server/projects';
import {
  hasTrustedOrigin,
  readUrlEncodedForm,
} from '../../../../lib/server/security';
import { validateProjectForm } from '../../../../lib/server/validation/projects';

const maximumProjectFormBytes = 512 * 1024;

function redirect(code: string): Response {
  return new Response(null, {
    status: 303,
    headers: { location: `/user/projects/new?error=${code}` },
  });
}

function validationRedirect(errors: Record<string, string>): Response {
  const field = Object.keys(errors)[0] ?? 'project';
  return new Response(null, {
    status: 303,
    headers: {
      location: `/user/projects/new?error=validation&field=${encodeURIComponent(field)}`,
    },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'Authentication required.' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (!hasTrustedOrigin(request)) return redirect('invalid');

  const form = await readUrlEncodedForm(request, maximumProjectFormBytes);
  if (!form) return redirect('validation');

  const result = validateProjectForm(form);
  if (!result.success) return validationRedirect(result.errors);

  try {
    if (await getConsoleProjectBySlug(result.data.slug))
      return redirect('slug');
    await createProjectRecord(result.data, locals.user.id);
    return new Response(null, {
      status: 303,
      headers: { location: '/user/projects?notice=created' },
    });
  } catch {
    return redirect('unavailable');
  }
};
