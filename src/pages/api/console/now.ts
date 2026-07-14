import type { APIRoute } from 'astro';
import { getDatabase } from '../../../lib/server/db/client';
import { nowStatus } from '../../../lib/server/db/schema';
import { primaryNowStatusId } from '../../../lib/server/now';
import {
  hasTrustedOrigin,
  readUrlEncodedForm,
} from '../../../lib/server/security';

const maximumItems = 12;
const maximumItemLength = 160;

function parseList(value: string | null): string[] | null {
  const items = String(value ?? '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (
    items.length > maximumItems ||
    items.some((item) => item.length > maximumItemLength)
  ) {
    return null;
  }

  return items;
}

function redirectWith(code: string): Response {
  return new Response(null, {
    status: 303,
    headers: { location: `/console/now?${code}` },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ error: 'Authentication required.' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  if (!hasTrustedOrigin(request)) {
    return redirectWith('error=invalid');
  }

  const form = await readUrlEncodedForm(request);
  if (!form) return redirectWith('error=invalid');

  const currentFocus = String(form.get('currentFocus') ?? '').trim();
  const workingOn = parseList(form.get('workingOn'));
  const learning = parseList(form.get('learning'));
  const using = parseList(form.get('using'));
  const statusNote = String(form.get('statusNote') ?? '').trim();

  if (
    !currentFocus ||
    currentFocus.length > maximumItemLength ||
    statusNote.length > 280 ||
    !workingOn ||
    !learning ||
    !using
  ) {
    return redirectWith('error=validation');
  }

  await getDatabase()
    .insert(nowStatus)
    .values({
      id: primaryNowStatusId,
      currentFocus,
      workingOn,
      learning,
      using,
      statusNote: statusNote || null,
      published: form.get('published') === 'on',
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: nowStatus.id,
      set: {
        currentFocus,
        workingOn,
        learning,
        using,
        statusNote: statusNote || null,
        published: form.get('published') === 'on',
        updatedAt: new Date(),
      },
    });

  return redirectWith('saved=1');
};
