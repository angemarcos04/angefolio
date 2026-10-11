import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPublicNoteCatalog } from '../lib/server/notes';
import { site } from '../lib/data/site';
import { getPublicSiteSettings } from '../lib/server/siteSettings';

export const prerender = false;

export async function GET(context: APIContext) {
  const [notes, settings] = await Promise.all([
    getPublicNoteCatalog(),
    getPublicSiteSettings(),
  ]);

  return rss({
    title: `${settings.siteName} notes`,
    description: settings.seoDescription,
    site: context.site ?? site.url,
    items: notes.map((note) => ({
      title: note.title,
      description: note.description,
      pubDate: note.createdAt,
      link: `/notes/${note.slug}`,
    })),
    customData: '<language>en-us</language>',
  });
}
