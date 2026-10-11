import type { APIRoute } from 'astro';
import { isServiceReady } from '../../lib/server/readiness';

export const prerender = false;

export const GET: APIRoute = async () => {
  const ready = await isServiceReady();
  return new Response(
    JSON.stringify({ status: ready ? 'ready' : 'not_ready' }),
    {
      status: ready ? 200 : 503,
      headers: {
        'cache-control': 'no-store',
        'content-type': 'application/json; charset=utf-8',
        'x-content-type-options': 'nosniff',
      },
    },
  );
};
