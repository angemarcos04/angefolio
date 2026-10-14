import type { APIRoute } from 'astro';
import { site as siteData } from '../lib/data/site';

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL('/sitemap-index.xml', site ?? siteData.url).href;
  const projectSitemap = new URL('/sitemap-projects.xml', site ?? siteData.url)
    .href;
  const noteSitemap = new URL('/sitemap-notes.xml', site ?? siteData.url).href;
  const blogSitemap = new URL('/sitemap-blog.xml', site ?? siteData.url).href;
  const labSitemap = new URL('/sitemap-lab.xml', site ?? siteData.url).href;
  const credentialSitemap = new URL(
    '/sitemap-credentials.xml',
    site ?? siteData.url,
  ).href;

  return new Response(
    `User-agent: *\nAllow: /\nSitemap: ${sitemap}\nSitemap: ${projectSitemap}\nSitemap: ${noteSitemap}\nSitemap: ${blogSitemap}\nSitemap: ${labSitemap}\nSitemap: ${credentialSitemap}\n`,
    {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    },
  );
};
