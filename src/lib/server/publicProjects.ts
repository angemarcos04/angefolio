import type { CollectionEntry } from 'astro:content';
import { getProjectSlug, getVisibleProjects } from '../content';
import { isSafeImageReference } from '../data/mediaReference';
import { getDatabase, migrateDatabase } from './db/client';
import { projectRecords } from './db/schema';
import type { ProjectRecord } from './projects';
import { getRedirectSourcePaths } from './redirects';

export interface PublicProject {
  source: 'mdx' | 'database';
  /** Present for database records; kept server-side for redirect ownership. */
  id?: string;
  slug: string;
  title: string;
  description: string;
  status: string;
  category: string | null;
  role: string | null;
  problem: string | null;
  solution: string | null;
  stack: string[];
  links: Array<{ label: string; href: string; external: boolean }>;
  github: string | null;
  demo: string | null;
  featured: boolean;
  date: Date;
  dateLabel: 'Date' | 'Added';
  updatedAt: Date;
  highlights: string[];
  cover: string | null;
  screenshots: Array<{ src: string; alt: string; caption?: string }>;
  body: string;
  orderIndex: number | null;
  entry?: CollectionEntry<'projects'>;
}

function fromMdx(entry: CollectionEntry<'projects'>): PublicProject {
  return {
    source: 'mdx',
    slug: getProjectSlug(entry),
    title: entry.data.title,
    description: entry.data.description,
    status: entry.data.status,
    category: entry.data.category ?? null,
    role: entry.data.role ?? null,
    problem: entry.data.problem ?? null,
    solution: entry.data.solution ?? null,
    stack: entry.data.stack,
    links: (entry.data.links ?? []).map((link) => ({
      ...link,
      external: link.external ?? true,
    })),
    github: entry.data.github ?? null,
    demo: entry.data.demo ?? null,
    featured: entry.data.featured,
    date: entry.data.date,
    dateLabel: 'Date',
    updatedAt: entry.data.date,
    highlights: entry.data.highlights ?? [],
    cover:
      entry.data.cover && isSafeImageReference(entry.data.cover)
        ? entry.data.cover
        : null,
    screenshots: [],
    body: 'body' in entry && typeof entry.body === 'string' ? entry.body : '',
    orderIndex: entry.data.order ?? null,
    entry,
  };
}

function fromDatabase(record: ProjectRecord): PublicProject {
  return {
    source: 'database',
    id: record.id,
    slug: record.slug,
    title: record.title,
    description: record.description,
    status: record.status,
    category: record.category,
    role: record.role,
    problem: record.problem,
    solution: record.solution,
    stack: Array.isArray(record.stack) ? record.stack : [],
    links: Array.isArray(record.links) ? record.links : [],
    github: record.github,
    demo: record.demo,
    featured: record.featured,
    date: record.projectDate ?? record.createdAt,
    dateLabel: record.projectDate ? 'Date' : 'Added',
    updatedAt: record.updatedAt,
    highlights: Array.isArray(record.highlights) ? record.highlights : [],
    // Older records may predate the shared cover policy. Keep their stored
    // value intact, but never pass an unsafe reference into public markup.
    cover:
      record.cover && isSafeImageReference(record.cover) ? record.cover : null,
    screenshots: Array.isArray(record.screenshots) ? record.screenshots : [],
    body: record.caseStudyBody ?? '',
    orderIndex: record.orderIndex,
  };
}

export async function getPublicProjectCatalog(): Promise<PublicProject[]> {
  const mdx = await getVisibleProjects();
  let records: ProjectRecord[];
  let redirectSources: Set<string>;
  try {
    await migrateDatabase();
    records = await getDatabase().select().from(projectRecords);
    redirectSources = await getRedirectSourcePaths('project');
  } catch {
    // Imported MDX can be hidden in the database. Without that state, fail closed.
    return [];
  }

  const bySlug = new Map(records.map((record) => [record.slug, record]));
  const mdxSlugs = new Set(mdx.map(getProjectSlug));
  const combined: PublicProject[] = [];

  for (const entry of mdx) {
    if (redirectSources.has(`/projects/${getProjectSlug(entry)}`)) continue;
    const record = bySlug.get(getProjectSlug(entry));
    if (!record?.replacesMdx) {
      combined.push(fromMdx(entry));
    } else if (record.visible && !record.archived) {
      combined.push(fromDatabase(record));
    }
  }

  for (const record of records) {
    if (
      !mdxSlugs.has(record.slug) &&
      !redirectSources.has(`/projects/${record.slug}`) &&
      record.visible &&
      !record.archived
    ) {
      combined.push(fromDatabase(record));
    }
  }

  return combined.sort((left, right) => {
    if (left.featured !== right.featured) return left.featured ? -1 : 1;
    if (left.orderIndex !== right.orderIndex) {
      if (left.orderIndex === null) return 1;
      if (right.orderIndex === null) return -1;
      return left.orderIndex - right.orderIndex;
    }
    return right.date.getTime() - left.date.getTime();
  });
}

export function publicProjectUrl(project: PublicProject): string {
  // Callers use this helper with records from the authorized public catalog.
  // Visibility, archive state, replacement selection, and redirect aliases
  // are enforced by getPublicProjectCatalog(), not by this URL formatter.
  return `/projects/${project.slug}`;
}
