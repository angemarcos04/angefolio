import type { APIRoute } from 'astro';
import { getPublicBlogCatalog } from '../../../lib/server/blog';

export const GET: APIRoute = async ({ url }) => {
  const query = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  const matches =
    query && query.length <= 80
      ? (await getPublicBlogCatalog())
          .filter((post) =>
            [
              post.title,
              post.description,
              post.summary ?? '',
              post.body,
              post.category,
              ...post.tags,
            ]
              .join(' ')
              .toLowerCase()
              .includes(query),
          )
          .slice(0, 10)
          .map((post) => ({
            url: `/blog/${post.slug}`,
            title: post.title,
            excerpt: post.description,
          }))
      : [];
  return new Response(JSON.stringify(matches), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
};
