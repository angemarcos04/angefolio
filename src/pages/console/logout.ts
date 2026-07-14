import type { APIRoute } from 'astro';
import { getAuth } from '../../lib/server/auth';
import { hasTrustedOrigin } from '../../lib/server/security';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user || !hasTrustedOrigin(request)) {
    return new Response(null, {
      status: 303,
      headers: { location: '/console/login' },
    });
  }

  const headers = new Headers(request.headers);
  headers.set('content-type', 'application/json');
  const authRequest = new Request(new URL('/api/auth/sign-out', request.url), {
    method: 'POST',
    headers,
    body: '{}',
  });
  const authResponse = await getAuth().handler(authRequest);
  const responseHeaders = new Headers(authResponse.headers);
  responseHeaders.delete('content-length');
  responseHeaders.delete('content-type');
  responseHeaders.set('location', '/console/login');

  return new Response(null, { status: 303, headers: responseHeaders });
};
