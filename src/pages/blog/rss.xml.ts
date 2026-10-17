import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { site } from '../../lib/data/site';
import { getPublicBlogCatalog } from '../../lib/server/blog';
import { getPublicSiteSettings } from '../../lib/server/siteSettings';

export const prerender = false;

export async function GET(context: APIContext) {
  const [posts, settings] = await Promise.all([
    getPublicBlogCatalog(),
    getPublicSiteSettings(),
  ]);
  return rss({
    title: `${settings.siteName} blog`,
    description: `Long-form articles and writing by ${settings.name}.`,
    site: context.site ?? site.url,
    items: posts.map((post) => ({
      title: post.title,
      description: post.description,
      pubDate: post.createdAt,
      link: `/blog/${post.slug}`,
    })),
    customData: '<language>en-us</language>',
  });
}
