import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPublishedNotes } from '../lib/content';
import { getNoteUrl } from '../lib/notes';
import { site } from '../lib/data/site';

export async function GET(context: APIContext) {
  const notes = await getPublishedNotes();

  return rss({
    title: 'angefolio notes',
    description:
      'Project logs, Linux fixes, web development notes, and thoughts from Angellie Marcos.',
    site: context.site ?? site.url,
    items: notes.map((note) => ({
      title: note.data.title,
      description: note.data.description,
      pubDate: note.data.createdAt,
      link: getNoteUrl(note),
    })),
    customData: '<language>en-us</language>',
  });
}
