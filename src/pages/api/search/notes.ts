import type { APIRoute } from 'astro';
import { getPublicNoteCatalog } from '../../../lib/server/notes';

export const GET: APIRoute = async ({ url }) => {
  const query = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  const matches =
    query && query.length <= 80
      ? (await getPublicNoteCatalog())
          .filter((note) =>
            [
              note.title,
              note.description,
              note.summary ?? '',
              note.body,
              note.category,
              ...note.tags,
            ]
              .join(' ')
              .toLowerCase()
              .includes(query),
          )
          .slice(0, 10)
          .map((note) => ({
            url: `/notes/${note.slug}`,
            title: note.title,
            excerpt: note.description,
          }))
      : [];
  return new Response(JSON.stringify(matches), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
};
