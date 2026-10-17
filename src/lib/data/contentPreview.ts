import { isSafeImageReference } from './mediaReference';
import { labRisks, labStatuses } from '../server/validation/lab';
import { projectStatuses } from '../server/validation/projects';

export type PreviewKind = 'project' | 'blog' | 'note' | 'lab';

export interface PreviewLink {
  label: string;
  href: string;
  external: boolean;
}

export interface PreviewScreenshot {
  src: string;
  alt: string;
  caption?: string;
}

export interface ContentPreviewData {
  kind: PreviewKind;
  title: string;
  description: string;
  category: string;
  status: string;
  summary: string;
  date: string;
  updatedAt: string;
  readingTime: string;
  featured: boolean;
  cover: string;
  role: string;
  problem: string;
  solution: string;
  stack: string[];
  highlights: string[];
  tags: string[];
  tools: string[];
  lessons: string[];
  risk: string;
  links: PreviewLink[];
  screenshots: PreviewScreenshot[];
}

const caps = {
  title: 120,
  description: 300,
  category: 80,
  summary: 500,
  cover: 2048,
  role: 200,
  problem: 1000,
  solution: 1000,
  body: 200000,
  tags: 20,
  stack: 20,
  highlights: 12,
  tools: 20,
  lessons: 20,
  links: 8,
  screenshots: 8,
} as const;

function value(form: URLSearchParams, key: string, max: number): string {
  return (form.get(key) ?? '').trim().slice(0, max);
}

function lines(form: URLSearchParams, key: string, maximum: number): string[] {
  return value(form, key, 10000)
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maximum);
}

function uniqueLines(
  form: URLSearchParams,
  key: string,
  maximum: number,
): string[] {
  return [
    ...new Set(
      value(form, key, 10000)
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ].slice(0, maximum);
}

function safeHttp(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function dateLabel(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    return '';
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function projectLinks(form: URLSearchParams): PreviewLink[] {
  const candidates: PreviewLink[] = [];
  const demo = value(form, 'demo', 2048);
  const github = value(form, 'github', 2048);
  if (demo && safeHttp(demo))
    candidates.push({ label: 'Live demo', href: demo, external: true });
  if (github && safeHttp(github))
    candidates.push({ label: 'GitHub', href: github, external: true });
  for (const row of lines(form, 'links', caps.links)) {
    const separator = row.indexOf('|');
    if (separator < 1) continue;
    const label = row.slice(0, separator).trim().slice(0, 80);
    const href = row
      .slice(separator + 1)
      .trim()
      .slice(0, 2048);
    if (label && safeHttp(href))
      candidates.push({ label, href, external: true });
  }
  const seen = new Set<string>();
  return candidates.filter((link) => {
    if (seen.has(link.href)) return false;
    seen.add(link.href);
    return true;
  });
}

function labLinks(form: URLSearchParams): PreviewLink[] {
  const links: PreviewLink[] = [];
  const demo = value(form, 'demo', 2048);
  const repo = value(form, 'repo', 2048);
  const related = value(form, 'relatedProject', 2048);
  if (demo && safeHttp(demo))
    links.push({ label: 'Open demo', href: demo, external: true });
  if (repo && safeHttp(repo))
    links.push({ label: 'Repository', href: repo, external: true });
  if (/^\/projects\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(related)) {
    links.push({ label: 'Related project', href: related, external: false });
  } else if (related && safeHttp(related)) {
    links.push({ label: 'Related project', href: related, external: true });
  }
  const seen = new Set<string>();
  return links.filter(
    (link) => !seen.has(link.href) && Boolean(seen.add(link.href)),
  );
}

function screenshots(form: URLSearchParams): PreviewScreenshot[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(form.get('screenshots') ?? '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const seen = new Set<string>();
  return parsed
    .slice(0, caps.screenshots)
    .flatMap((item): PreviewScreenshot[] => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
      const source = (item as Record<string, unknown>).src;
      const alt = (item as Record<string, unknown>).alt;
      const caption = (item as Record<string, unknown>).caption;
      if (
        typeof source !== 'string' ||
        !isSafeImageReference(source) ||
        typeof alt !== 'string' ||
        !alt.trim() ||
        alt.length > 300 ||
        (caption !== undefined &&
          (typeof caption !== 'string' || caption.length > 300)) ||
        seen.has(source)
      )
        return [];
      seen.add(source);
      return [
        {
          src: source,
          alt: alt.trim(),
          ...(typeof caption === 'string' && caption.trim()
            ? { caption: caption.trim() }
            : {}),
        },
      ];
    });
}

/** Normalize incomplete owner form state into the bounded display model used by private previews. */
export function normalizeContentPreview(
  kind: PreviewKind,
  form: URLSearchParams,
): ContentPreviewData {
  const rawDate =
    kind === 'project'
      ? value(form, 'projectDate', 10)
      : kind === 'lab'
        ? value(form, 'date', 10)
        : value(form, 'createdAt', 10);
  const relatedDate = value(form, 'updatedAt', 10);
  const seenStack = new Set<string>();
  const stack = lines(form, 'stack', 100)
    .map((item) => item.slice(0, 40))
    .filter((item) => {
      const normalized = item.toLowerCase();
      if (seenStack.has(normalized)) return false;
      seenStack.add(normalized);
      return true;
    })
    .slice(0, caps.stack);
  const highlights = lines(form, 'highlights', caps.highlights).map((item) =>
    item.slice(0, 160),
  );
  const rawTags =
    kind === 'lab'
      ? uniqueLines(form, 'tags', 100)
      : lines(form, 'tags', caps.tags);
  const rawTools = uniqueLines(form, 'tools', 100);
  const rawLessons = uniqueLines(form, 'lessons', 100);
  const tags = rawTags.slice(0, caps.tags).map((item) => item.slice(0, 40));
  const tools = rawTools.slice(0, caps.tools).map((item) => item.slice(0, 60));
  const lessons = rawLessons
    .slice(0, caps.lessons)
    .map((item) => item.slice(0, 500));
  const coverValue = value(form, 'cover', caps.cover);
  const cover =
    coverValue && isSafeImageReference(coverValue) ? coverValue : '';
  const statusValue = value(form, 'status', 40);
  const status =
    (kind === 'project' &&
      projectStatuses.includes(
        statusValue as (typeof projectStatuses)[number],
      )) ||
    (kind === 'lab' &&
      labStatuses.includes(statusValue as (typeof labStatuses)[number]))
      ? statusValue
      : '';
  const riskValue = value(form, 'risk', 20);
  return {
    kind,
    title: value(form, 'title', caps.title) || 'Untitled',
    description: value(form, 'description', caps.description),
    category: value(form, 'category', caps.category),
    status,
    summary: value(form, 'summary', caps.summary),
    date: dateLabel(rawDate),
    updatedAt: dateLabel(relatedDate),
    readingTime: `${Math.max(1, Math.ceil((form.get('body') ?? '').trim().split(/\s+/).filter(Boolean).length / 200))} min read`,
    featured: form.get('featured') === 'on',
    cover,
    role: value(form, 'role', caps.role),
    problem: value(form, 'problem', caps.problem),
    solution: value(form, 'solution', caps.solution),
    stack,
    highlights,
    tags,
    tools,
    lessons,
    risk: labRisks.includes(riskValue as (typeof labRisks)[number])
      ? riskValue
      : '',
    links:
      kind === 'project'
        ? projectLinks(form)
        : kind === 'lab'
          ? labLinks(form)
          : [],
    screenshots: kind === 'project' ? screenshots(form) : [],
  };
}

export function previewBodyLimit(kind: PreviewKind): number {
  return kind === 'project' ? 30000 : caps.body;
}
