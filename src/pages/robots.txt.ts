import type { APIRoute } from 'astro';
import { site as siteData } from '../lib/data/site';

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL('/sitemap-index.xml', site ?? siteData.url).href;

  return new Response(`User-agent: *\nAllow: /\nSitemap: ${sitemap}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
