import { isSafeImageReference } from './mediaReference';
import {
  isSafeHttpUrl,
  PROJECT_SCREENSHOT_ALT_MAX_LENGTH,
  PROJECT_SCREENSHOT_CAPTION_MAX_LENGTH,
  PROJECT_SCREENSHOT_COUNT_MAX,
} from './contentConstraints';
import { labRisks, labStatuses } from '../server/validation/lab';
import { projectStatuses } from '../server/validation/projects';
import {
  isSafeProjectExternalHref,
  normalizeProjectDisplayLinks,
} from './projectLinks';

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
  warnings: string[];
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
  return value.length <= 2048 && isSafeHttpUrl(value);
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
  const demo = (form.get('demo') ?? '').trim();
  const github = (form.get('github') ?? '').trim();
  if (demo && isSafeProjectExternalHref(demo))
    candidates.push({ label: 'Live demo', href: demo, external: true });
  if (github && isSafeProjectExternalHref(github))
    candidates.push({ label: 'GitHub', href: github, external: true });
  for (const row of lines(form, 'links', caps.links)) {
    const separator = row.indexOf('|');
    if (separator < 1) continue;
    const label = row.slice(0, separator).trim().slice(0, 80);
    const href = row.slice(separator + 1).trim();
    if (label && isSafeProjectExternalHref(href))
      candidates.push({ label, href, external: true });
  }
  return normalizeProjectDisplayLinks(candidates);
}

function labLinks(form: URLSearchParams): PreviewLink[] {
  const links: PreviewLink[] = [];
  const demo = (form.get('demo') ?? '').trim();
  const repo = (form.get('repo') ?? '').trim();
  const related = (form.get('relatedProject') ?? '').trim();
  if (demo && safeHttp(demo))
    links.push({ label: 'Open demo', href: demo, external: true });
  if (repo && safeHttp(repo))
    links.push({ label: 'Repository', href: repo, external: true });
  if (/^\/projects\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(related)) {
    links.push({ label: 'Related project', href: related, external: false });
  } else if (related && safeHttp(related)) {
    links.push({ label: 'Related project', href: related, external: true });
  }
  return links;
}

function screenshots(
  form: URLSearchParams,
  warnings: string[],
): PreviewScreenshot[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(form.get('screenshots') ?? '[]');
  } catch {
    warnings.push(
      'Screenshot data is malformed and cannot be shown. Your form value is unchanged.',
    );
    return [];
  }
  if (!Array.isArray(parsed)) {
    warnings.push(
      'Screenshot data must be a list to save. Your form value is unchanged.',
    );
    return [];
  }
  if (parsed.length > PROJECT_SCREENSHOT_COUNT_MAX) {
    warnings.push(
      `Only the first ${PROJECT_SCREENSHOT_COUNT_MAX} screenshots are shown; save accepts up to ${PROJECT_SCREENSHOT_COUNT_MAX}. Your form value is unchanged.`,
    );
  }
  const seen = new Set<string>();
  return parsed
    .slice(0, PROJECT_SCREENSHOT_COUNT_MAX)
    .flatMap((item): PreviewScreenshot[] => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        warnings.push(
          'An invalid screenshot entry is omitted from this preview; correct its image and alternative text before saving.',
        );
        return [];
      }
      const source = (item as Record<string, unknown>).src;
      const alt = (item as Record<string, unknown>).alt;
      const caption = (item as Record<string, unknown>).caption;
      const extraKeys = Object.keys(item).some(
        (key) => !['src', 'alt', 'caption'].includes(key),
      );
      if (
        typeof caption === 'string' &&
        caption.length > PROJECT_SCREENSHOT_CAPTION_MAX_LENGTH
      ) {
        warnings.push(
          `A screenshot caption exceeds the ${PROJECT_SCREENSHOT_CAPTION_MAX_LENGTH}-character save limit. The preview shows the current caption and leaves your form value unchanged.`,
        );
      }
      if (
        extraKeys ||
        typeof source !== 'string' ||
        !isSafeImageReference(source) ||
        typeof alt !== 'string' ||
        !alt.trim() ||
        alt.length > PROJECT_SCREENSHOT_ALT_MAX_LENGTH ||
        (caption !== undefined && typeof caption !== 'string') ||
        seen.has(source)
      ) {
        warnings.push(
          'An invalid screenshot entry is omitted from this preview; check its image, alternative text, caption, and duplicates.',
        );
        return [];
      }
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

function previewWarnings(kind: PreviewKind, form: URLSearchParams): string[] {
  const warnings = new Set<string>();
  const add = (field: string, issue = 'exceeds the save limit') =>
    warnings.add(
      `${field} ${issue}. The preview is bounded and your form value is unchanged.`,
    );
  const raw = (field: string) => form.get(field) ?? '';
  const trimmed = (field: string) => raw(field).trim();
  const checkLength = (field: string, maximum: number) => {
    if (trimmed(field).length > maximum) add(field);
  };
  const list = (field: string) =>
    trimmed(field)
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  const checkList = (
    field: string,
    count: number,
    itemLength: number,
    deduplicate = false,
  ) => {
    const items = list(field);
    const effective = deduplicate ? [...new Set(items)] : items;
    if (effective.length > count) add(field, `has more than ${count} entries`);
    if (effective.some((item) => item.length > itemLength))
      add(field, `contains an entry longer than ${itemLength} characters`);
  };

  checkLength('title', caps.title);
  checkLength('description', caps.description);
  checkLength('category', caps.category);
  checkLength('summary', caps.summary);
  if (kind === 'project') {
    checkLength('role', caps.role);
    checkLength('problem', caps.problem);
    checkLength('solution', caps.solution);
    checkLength('github', 2048);
    checkLength('demo', 2048);
    checkLength('cover', caps.cover);
    for (const field of ['github', 'demo'] as const) {
      if (trimmed(field) && !isSafeProjectExternalHref(trimmed(field)))
        add(field, 'must be a safe HTTP(S) URL');
    }
    checkList('stack', caps.stack, 40);
    checkList('highlights', caps.highlights, 160);
    const links = list('links');
    if (links.length > caps.links)
      add('links', `has more than ${caps.links} entries`);
    if (
      links.some((row) => {
        const separator = row.indexOf('|');
        if (separator < 1) return true;
        const label = row.slice(0, separator).trim();
        const href = row.slice(separator + 1).trim();
        return (
          label.length > 80 ||
          href.length > 2048 ||
          !isSafeProjectExternalHref(href)
        );
      })
    )
      add('links', 'contains an invalid label or destination');
    const body = raw('caseStudyBody');
    if (body.length > 30000)
      add('case-study body', 'exceeds 30,000 characters');
    if (
      form.get('replacesMdx') === 'on' &&
      form.get('visible') === 'on' &&
      !body.trim()
    )
      add('case-study body', 'is required for a visible MDX replacement');
  } else if (kind === 'blog' || kind === 'note') {
    checkList('tags', caps.tags, 40);
    if (raw('body').length > caps.body)
      add('body', 'exceeds 200,000 characters');
    if (form.get('published') === 'on' && !raw('body').trim())
      add('body', 'is required before publishing');
    checkLength('cover', caps.cover);
  } else {
    checkList('tags', caps.tags, 40, true);
    checkList('tools', caps.tools, 60, true);
    checkList('lessons', caps.lessons, 500, true);
    checkLength('repo', 2048);
    checkLength('demo', 2048);
    checkLength('relatedProject', 2048);
    for (const field of ['repo', 'demo'] as const) {
      if (trimmed(field) && !safeHttp(trimmed(field)))
        add(field, 'must be a safe HTTP(S) URL');
    }
    const relatedProject = trimmed('relatedProject');
    if (
      relatedProject &&
      !/^\/projects\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(relatedProject) &&
      !safeHttp(relatedProject)
    )
      add('relatedProject', 'must be a project path or safe HTTP(S) URL');
    if (raw('body').length > caps.body)
      add('body', 'exceeds 200,000 characters');
    if (form.get('visible') === 'on' && !raw('body').trim())
      add('body', 'is required for a visible entry');
  }

  for (const [field, required] of [
    [
      kind === 'project'
        ? 'projectDate'
        : kind === 'lab'
          ? 'date'
          : 'createdAt',
      kind !== 'project',
    ],
    ['updatedAt', false],
  ] as const) {
    const dateText = trimmed(field);
    if (dateText && !dateLabel(dateText))
      add(field, 'is not a valid calendar date');
    else if (required && !dateText) add(field, 'is required before saving');
  }
  return [...warnings];
}

/** Normalize incomplete owner form state into the bounded display model used by private previews. */
export function normalizeContentPreview(
  kind: PreviewKind,
  form: URLSearchParams,
): ContentPreviewData {
  const warnings = previewWarnings(kind, form);
  const dateField =
    kind === 'project' ? 'projectDate' : kind === 'lab' ? 'date' : 'createdAt';
  const rawDate = (form.get(dateField) ?? '').trim();
  const relatedDate = (form.get('updatedAt') ?? '').trim();
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
  const coverValue = (form.get('cover') ?? '').trim();
  const cover =
    coverValue && isSafeImageReference(coverValue) ? coverValue : '';
  if (coverValue && !cover)
    warnings.push(
      'Cover reference is not a supported safe image and is omitted from the preview.',
    );
  const statusValue = (form.get('status') ?? '').trim();
  const status =
    (kind === 'project' &&
      projectStatuses.includes(
        statusValue as (typeof projectStatuses)[number],
      )) ||
    (kind === 'lab' &&
      labStatuses.includes(statusValue as (typeof labStatuses)[number]))
      ? statusValue
      : '';
  const riskValue = (form.get('risk') ?? '').trim();
  if (statusValue && !status)
    warnings.push(
      'Status is not an available value and is omitted from the preview.',
    );
  const risk = labRisks.includes(riskValue as (typeof labRisks)[number])
    ? riskValue
    : '';
  if (riskValue && !risk)
    warnings.push(
      'Risk is not an available value and is omitted from the preview.',
    );
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
    risk,
    links:
      kind === 'project'
        ? projectLinks(form)
        : kind === 'lab'
          ? labLinks(form)
          : [],
    screenshots: kind === 'project' ? screenshots(form, warnings) : [],
    warnings,
  };
}

export function previewBodyLimit(kind: PreviewKind): number {
  return kind === 'project' ? 30000 : caps.body;
}
