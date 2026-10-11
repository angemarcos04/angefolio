export interface PublicRoute {
  key: 'home' | 'projects' | 'notes' | 'blog' | 'lab' | 'search';
  href: string;
  label: string;
  matches: (pathname: string) => boolean;
}

export const normalizePathname = (pathname: string) => {
  if (pathname === '/') return '/';

  const normalized = pathname.replace(/\/+$/, '');
  return normalized === '' ? '/' : normalized;
};

export const primaryPublicRoutes: PublicRoute[] = [
  {
    key: 'home',
    href: '/',
    label: 'Home',
    matches: (pathname) => pathname === '/',
  },
  {
    key: 'projects',
    href: '/projects',
    label: 'Projects',
    matches: (pathname) =>
      pathname === '/projects' || pathname.startsWith('/projects/'),
  },
  {
    key: 'notes',
    href: '/notes',
    label: 'Notes',
    matches: (pathname) =>
      pathname === '/notes' || pathname.startsWith('/notes/'),
  },
  {
    key: 'blog',
    href: '/blog',
    label: 'Blog',
    matches: (pathname) =>
      pathname === '/blog' || pathname.startsWith('/blog/'),
  },
  {
    key: 'lab',
    href: '/lab',
    label: 'Lab',
    matches: (pathname) => pathname === '/lab' || pathname.startsWith('/lab/'),
  },
  {
    key: 'search',
    href: '/search',
    label: 'Search',
    matches: (pathname) => pathname === '/search',
  },
];

export const collectionNavigationRoutes = primaryPublicRoutes.filter(
  (route) => route.key !== 'home',
);
