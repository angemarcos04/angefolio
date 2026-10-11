import type { APIRoute } from 'astro';
import { site } from '../lib/data/site';
import { getPublicNoteCatalog } from '../lib/server/notes';

export const GET: APIRoute = async ({ site: configuredSite }) => {
  const origin = configuredSite ?? new URL(site.url);
  const urls = (await getPublicNoteCatalog()).map((note) => {
    const loc = new URL(`/notes/${encodeURIComponent(note.slug)}`, origin).href;
    return `<url><loc>${loc}</loc><lastmod>${(note.updatedAt ?? note.createdAt).toISOString()}</lastmod></url>`;
  });
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`,
    {
      headers: { 'content-type': 'application/xml; charset=utf-8' },
    },
  );
};
