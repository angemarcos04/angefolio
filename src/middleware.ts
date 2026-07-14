import { defineMiddleware } from 'astro:middleware';
import { getAuth } from './lib/server/auth';
import { migrateDatabase } from './lib/server/db/client';

const publicConsolePaths = new Set(['/console/login', '/api/console/login']);

function isProtectedConsolePath(pathname: string): boolean {
  return (
    (pathname === '/console' || pathname.startsWith('/console/')) &&
    !publicConsolePaths.has(pathname)
  );
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const isConsoleApi = pathname.startsWith('/api/console/');
  const shouldResolveSession =
    pathname === '/console/login' ||
    isProtectedConsolePath(pathname) ||
    isConsoleApi;

  context.locals.user = null;
  context.locals.session = null;

  if (!shouldResolveSession) return next();

  try {
    await migrateDatabase();
    const result = await getAuth().api.getSession({
      headers: context.request.headers,
    });

    if (result) {
      context.locals.user = {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
      };
      context.locals.session = {
        id: result.session.id,
        userId: result.session.userId,
        expiresAt: result.session.expiresAt,
      };
    }
  } catch {
    if (isConsoleApi && pathname !== '/api/console/login') {
      return new Response(
        JSON.stringify({ error: 'Console services are unavailable.' }),
        { status: 503, headers: { 'content-type': 'application/json' } },
      );
    }

    if (isProtectedConsolePath(pathname)) {
      return context.redirect('/console/login?error=unavailable', 303);
    }
  }

  if (pathname === '/console/login' && context.locals.user) {
    return context.redirect('/console', 303);
  }

  if (
    (isProtectedConsolePath(pathname) ||
      (isConsoleApi && pathname !== '/api/console/login')) &&
    !context.locals.user
  ) {
    if (isConsoleApi) {
      return new Response(
        JSON.stringify({ error: 'Authentication required.' }),
        {
          status: 401,
          headers: { 'content-type': 'application/json' },
        },
      );
    }

    return context.redirect('/console/login', 303);
  }

  return next();
});
