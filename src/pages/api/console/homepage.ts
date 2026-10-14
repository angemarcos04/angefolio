import type { APIRoute } from 'astro';
import { saveHomepageConfig } from '../../../lib/server/homepage';
import {
  hasTrustedOrigin,
  readUrlEncodedForm,
} from '../../../lib/server/security';
import { validateHomepageForm } from '../../../lib/server/validation/homepage';

function redirect(query: string) {
  return new Response(null, {
    status: 303,
    headers: { location: `/user/homepage?${query}` },
  });
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user)
    return new Response('Authentication required.', { status: 401 });
  if (!hasTrustedOrigin(request)) return redirect('error=invalid');
  const form = await readUrlEncodedForm(request, 256 * 1024);
  if (!form) return redirect('error=invalid');

  const result = validateHomepageForm(form);
  if (!result.success || !result.data) return redirect('error=validation');
  try {
    await saveHomepageConfig(result.data, locals.user.id);
    return redirect('saved=1');
  } catch {
    return redirect('error=unavailable');
  }
};
