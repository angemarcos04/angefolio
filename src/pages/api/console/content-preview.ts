import type { APIRoute } from 'astro';
import {
  normalizeContentPreview,
  previewBodyLimit,
  type PreviewKind,
} from '../../../lib/data/contentPreview';
import { renderProjectMarkdown } from '../../../lib/server/markdown';
import {
  hasTrustedOrigin,
  readUrlEncodedForm,
} from '../../../lib/server/security';

const kinds = new Set<PreviewKind>(['project', 'blog', 'note', 'lab']);

const privateHeaders = {
  'cache-control': 'no-store',
  vary: 'cookie',
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user)
    return new Response('Authentication required.', {
      status: 401,
      headers: privateHeaders,
    });
  if (!hasTrustedOrigin(request))
    return new Response('Invalid origin.', {
      status: 403,
      headers: privateHeaders,
    });
  const form = await readUrlEncodedForm(request, 768 * 1024);
  const kind = form?.get('kind') ?? '';
  const body = form?.get('body');
  if (
    !form ||
    !kinds.has(kind as PreviewKind) ||
    body === null ||
    body === undefined ||
    body.length > previewBodyLimit(kind as PreviewKind)
  ) {
    return new Response('Invalid preview.', {
      status: 400,
      headers: privateHeaders,
    });
  }
  const previewKind = kind as PreviewKind;
  return Response.json(
    {
      preview: normalizeContentPreview(previewKind, form),
      bodyHtml: renderProjectMarkdown(body),
    },
    { headers: privateHeaders },
  );
};
