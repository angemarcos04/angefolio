import type { APIRoute } from 'astro';
import { getAuth } from '../../../lib/server/auth';
import { migrateDatabase } from '../../../lib/server/db/client';
import {
  hasTrustedOrigin,
  readUrlEncodedForm,
} from '../../../lib/server/security';

function loginRedirect(code: string): Response {
  return new Response(null, {
    status: 303,
    headers: { location: `/console/login?error=${code}` },
  });
}

export const POST: APIRoute = async ({ request }) => {
  if (!hasTrustedOrigin(request)) {
    return loginRedirect('invalid');
  }

  const form = await readUrlEncodedForm(request);
  if (!form) return loginRedirect('invalid');

  const email = String(form.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(form.get('password') ?? '');

  if (email.length > 254 || password.length > 128) {
    return loginRedirect('invalid');
  }

  await migrateDatabase();

  const headers = new Headers(request.headers);
  headers.set('content-type', 'application/json');
  const authRequest = new Request(
    new URL('/api/auth/sign-in/email', request.url),
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password, rememberMe: false }),
    },
  );

  const authResponse = await getAuth().handler(authRequest);

  if (!authResponse.ok) return loginRedirect('invalid');

  const responseHeaders = new Headers(authResponse.headers);
  responseHeaders.delete('content-length');
  responseHeaders.delete('content-type');
  responseHeaders.set('location', '/console');

  return new Response(null, { status: 303, headers: responseHeaders });
};
