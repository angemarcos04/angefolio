import type { APIRoute } from 'astro';
import { site } from '../lib/data/site';
import { getPublicLabCatalog } from '../lib/server/lab';

export const GET: APIRoute = async ({ site: configuredSite }) => {
  const origin = configuredSite ?? new URL(site.url);
  const urls = (await getPublicLabCatalog()).map((entry) => {
    const loc = new URL(`/lab/${encodeURIComponent(entry.slug)}`, origin).href;
    return `<url><loc>${loc}</loc>${entry.updatedAt ? `<lastmod>${entry.updatedAt.toISOString()}</lastmod>` : ''}</url>`;
  });
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`,
    { headers: { 'content-type': 'application/xml; charset=utf-8' } },
  );
};
