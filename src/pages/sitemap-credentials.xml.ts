import type { APIRoute } from 'astro';
import { site } from '../lib/data/site';

export const GET: APIRoute = ({ site: configuredSite }) => {
  const origin = configuredSite ?? new URL(site.url);
  const location = new URL('/credentials', origin).href;
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${location}</loc></url></urlset>`;
  return new Response(xml, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
};
