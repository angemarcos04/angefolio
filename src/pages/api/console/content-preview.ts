import type { APIRoute } from 'astro';
import { renderProjectMarkdown } from '../../../lib/server/markdown';
import {
  hasTrustedOrigin,
  readUrlEncodedForm,
} from '../../../lib/server/security';

const limits: Record<string, number> = {
  project: 30000,
  blog: 200000,
  note: 200000,
  lab: 200000,
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user)
    return new Response('Authentication required.', {
      status: 401,
      headers: { 'cache-control': 'no-store' },
    });
  if (!hasTrustedOrigin(request))
    return new Response('Invalid origin.', {
      status: 403,
      headers: { 'cache-control': 'no-store' },
    });
  const form = await readUrlEncodedForm(request, 768 * 1024);
  const kind = form?.get('kind') ?? '';
  const body = form?.get('body');
  if (
    !form ||
    !Object.hasOwn(limits, kind) ||
    body === null ||
    body === undefined ||
    body.length > limits[kind]
  ) {
    return new Response('Invalid preview.', {
      status: 400,
      headers: { 'cache-control': 'no-store' },
    });
  }
  return Response.json(
    { bodyHtml: renderProjectMarkdown(body) },
    { headers: { 'cache-control': 'no-store', vary: 'cookie' } },
  );
};
