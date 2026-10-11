import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { auditEvent } from '../../../lib/server/audit';
import { getDatabase } from '../../../lib/server/db/client';
import {
  auditLog,
  contentRevisions,
  nowStatus,
} from '../../../lib/server/db/schema';
import { primaryNowStatusId } from '../../../lib/server/now';
import {
  pruneContentRevisions,
  revisionValues,
} from '../../../lib/server/revisions';
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
    headers: { location: `/user/now?${code}` },
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

  const published = form.get('published') === 'on';
  const updatedAt = new Date();
  const actorUserId = locals.user.id;
  await getDatabase().transaction(async (transaction) => {
    const [previous] = await transaction
      .select({ published: nowStatus.published })
      .from(nowStatus)
      .where(eq(nowStatus.id, primaryNowStatusId));
    await transaction
      .insert(nowStatus)
      .values({
        id: primaryNowStatusId,
        currentFocus,
        workingOn,
        learning,
        using,
        statusNote: statusNote || null,
        published,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: nowStatus.id,
        set: {
          currentFocus,
          workingOn,
          learning,
          using,
          statusNote: statusNote || null,
          published,
          updatedAt,
        },
      });
    await transaction.insert(auditLog).values(
      auditEvent(actorUserId, 'now.update', 'now_status', primaryNowStatusId, {
        fromPublished: previous?.published ?? false,
        toPublished: published,
        itemCount: 1 + workingOn.length + learning.length + using.length,
      }),
    );
    const [saved] = await transaction
      .select()
      .from(nowStatus)
      .where(eq(nowStatus.id, primaryNowStatusId));
    await transaction
      .insert(contentRevisions)
      .values(
        revisionValues(actorUserId, 'now_status', primaryNowStatusId, saved),
      );
    await pruneContentRevisions(transaction, 'now_status', primaryNowStatusId);
  });

  return redirectWith('saved=1');
};
