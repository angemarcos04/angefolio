import type { APIRoute } from 'astro';
import { renderProjectMarkdown } from '../../../lib/server/markdown';
import {
  hasTrustedOrigin,
  readUrlEncodedForm,
} from '../../../lib/server/security';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response('Authentication required.', { status: 401 });
  }
  if (!hasTrustedOrigin(request)) {
    return new Response('Invalid origin.', { status: 403 });
  }
  const form = await readUrlEncodedForm(request, 768 * 1024);
  const markdown = form?.get('markdown');
  if (markdown === null || markdown === undefined || markdown.length > 200000) {
    return new Response('Invalid preview.', { status: 400 });
  }
  return new Response(renderProjectMarkdown(markdown), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
};
