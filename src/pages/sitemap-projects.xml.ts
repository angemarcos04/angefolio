import type { APIRoute } from 'astro';
import { site } from '../lib/data/site';
import {
  getPublicProjectCatalog,
  publicProjectUrl,
} from '../lib/server/publicProjects';

export const GET: APIRoute = async ({ site: configuredSite }) => {
  const origin = configuredSite ?? new URL(site.url);
  const urls = (await getPublicProjectCatalog())
    .map(publicProjectUrl)
    .filter((url): url is string => Boolean(url))
    .map((path) => `<url><loc>${new URL(path, origin).href}</loc></url>`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`;
  return new Response(xml, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
};
