import type { APIRoute } from 'astro';
import { getPublicLabCatalog } from '../../../lib/server/lab';

export const GET: APIRoute = async ({ url }) => {
  const query = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  const matches =
    query && query.length <= 80
      ? (await getPublicLabCatalog())
          .filter((entry) =>
            [
              entry.title,
              entry.description,
              entry.body,
              entry.status,
              entry.category ?? '',
              ...entry.tags,
              ...entry.tools,
              ...entry.lessons,
            ]
              .join(' ')
              .toLowerCase()
              .includes(query),
          )
          .slice(0, 10)
          .map((entry) => ({
            url: `/lab/${entry.slug}`,
            title: entry.title,
            excerpt: entry.description,
          }))
      : [];
  return new Response(JSON.stringify(matches), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
};
