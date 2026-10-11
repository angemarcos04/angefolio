import type { APIRoute } from 'astro';
import { site } from '../lib/data/site';
import { getPublicBlogCatalog } from '../lib/server/blog';

export const GET: APIRoute = async ({ site: configuredSite }) => {
  const origin = configuredSite ?? new URL(site.url);
  const urls = (await getPublicBlogCatalog()).map((post) => {
    const loc = new URL(`/blog/${encodeURIComponent(post.slug)}`, origin).href;
    return `<url><loc>${loc}</loc><lastmod>${post.updatedAt.toISOString()}</lastmod></url>`;
  });
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`,
    { headers: { 'content-type': 'application/xml; charset=utf-8' } },
  );
};
