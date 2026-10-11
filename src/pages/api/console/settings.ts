import type { APIRoute } from 'astro';
import { saveSiteSettings } from '../../../lib/server/siteSettings';
import {
  hasTrustedOrigin,
  readUrlEncodedForm,
} from '../../../lib/server/security';
import { validateSiteSettingsForm } from '../../../lib/server/validation/siteSettings';

function redirect(query: string) {
  return new Response(null, {
    status: 303,
    headers: { location: `/user/settings?${query}` },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user)
    return new Response('Authentication required.', { status: 401 });
  if (!hasTrustedOrigin(request)) return redirect('error=invalid');
  const form = await readUrlEncodedForm(request, 8 * 1024);
  if (!form) return redirect('error=invalid');
  const result = validateSiteSettingsForm(form);
  if (!result.success || !result.data) return redirect('error=validation');
  try {
    await saveSiteSettings(result.data, locals.user.id);
    return redirect('saved=1');
  } catch {
    return redirect('error=unavailable');
  }
};
