import type { APIRoute } from 'astro';
import { getMediaAsset } from '../../lib/server/media';

export const GET: APIRoute = async ({ params }) => {
  const match = /^([0-9a-f-]{36})\.webp$/i.exec(params.asset ?? '');
  if (!match) return new Response('Not found.', { status: 404 });

  try {
    const asset = await getMediaAsset(match[1]);
    if (!asset) return new Response('Not found.', { status: 404 });
    return new Response(new Uint8Array(asset.data), {
      headers: {
        'content-type': asset.mimeType,
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response('Media unavailable.', { status: 503 });
  }
};
