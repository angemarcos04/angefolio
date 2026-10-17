import type { APIRoute } from 'astro';
import {
  getPublicProjectCatalog,
  publicProjectUrl,
} from '../../../lib/server/publicProjects';

export const GET: APIRoute = async ({ url }) => {
  const query = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  if (!query || query.length > 80) {
    return new Response(JSON.stringify([]), {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      },
    });
  }

  const matches = (await getPublicProjectCatalog())
    .filter((project) =>
      [project.title, project.description, project.body, ...project.stack]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
    .slice(0, 10)
    .map((project) => ({
      url: publicProjectUrl(project),
      title: project.title,
      excerpt: project.description,
    }));
  return new Response(JSON.stringify(matches), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
};
