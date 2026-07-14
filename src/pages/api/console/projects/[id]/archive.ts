import type { APIRoute } from 'astro';
import { archiveProjectRecord } from '../../../../../lib/server/projects';
import {
  hasTrustedOrigin,
  readUrlEncodedForm,
} from '../../../../../lib/server/security';

export const POST: APIRoute = async ({ request, locals, params }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'Authentication required.' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  const id = params.id ?? '';
  if (!id || id.length > 64 || !hasTrustedOrigin(request)) {
    return new Response(null, {
      status: 303,
      headers: { location: '/console/projects?error=unavailable' },
    });
  }

  const form = await readUrlEncodedForm(request);
  if (!form || form.get('intent') !== 'archive') {
    return new Response(null, {
      status: 303,
      headers: { location: '/console/projects?error=unavailable' },
    });
  }

  try {
    const archived = await archiveProjectRecord(id);
    return new Response(null, {
      status: 303,
      headers: {
        location: archived
          ? '/console/projects?notice=archived'
          : '/console/projects?error=missing',
      },
    });
  } catch {
    return new Response(null, {
      status: 303,
      headers: { location: '/console/projects?error=unavailable' },
    });
  }
};
