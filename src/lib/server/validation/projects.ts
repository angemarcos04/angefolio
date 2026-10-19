import { isSafeImageReference } from '../../data/mediaReference';
import { isSafeProjectExternalHref } from '../../data/projectLinks';
import {
  PROJECT_SCREENSHOT_CAPTION_MAX_LENGTH,
  PROJECT_SCREENSHOT_COUNT_MAX,
  PROJECT_SCREENSHOT_ALT_MAX_LENGTH,
} from '../../data/contentConstraints';

export const projectStatuses = [
  'Planning',
  'Prototype',
  'In Progress',
  'Live',
  'Archived',
] as const;

export type ProjectStatus = (typeof projectStatuses)[number];

export interface ProjectLink {
  label: string;
  href: string;
  external: boolean;
}

export interface ProjectScreenshot {
  src: string;
  alt: string;
  caption?: string;
}

export interface ProjectRecordInput {
  slug: string;
  title: string;
  description: string;
  status: ProjectStatus;
  category: string | null;
  role: string | null;
  problem: string | null;
  solution: string | null;
  stack: string[];
  links: ProjectLink[];
  github: string | null;
  demo: string | null;
  caseStudyBody: string | null;
  projectDate: Date | null;
  highlights: string[];
  cover: string | null;
  screenshots: ProjectScreenshot[];
  replacesMdx: boolean;
  featured: boolean;
  visible: boolean;
  orderIndex: number | null;
}

export interface ProjectFormValues {
  slug: string;
  title: string;
  description: string;
  status: string;
  category: string;
  role: string;
  problem: string;
  solution: string;
  stack: string;
  links: string;
  github: string;
  demo: string;
  caseStudyBody: string;
  projectDate: string;
  highlights: string;
  cover: string;
  screenshots: string;
  replacesMdx: boolean;
  featured: boolean;
  visible: boolean;
  orderIndex: string;
}

export type ProjectValidationResult =
  | { success: true; data: ProjectRecordInput; values: ProjectFormValues }
  | {
      success: false;
      errors: Record<string, string>;
      values: ProjectFormValues;
    };

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function optionalValue(value: string): string | null {
  return value.length > 0 ? value : null;
}

function isHttpUrl(value: string): boolean {
  return isSafeProjectExternalHref(value);
}

function readValues(form: URLSearchParams): ProjectFormValues {
  const get = (name: string) => form.get(name)?.trim() ?? '';

  return {
    slug: get('slug').toLowerCase(),
    title: get('title'),
    description: get('description'),
    status: get('status'),
    category: get('category'),
    role: get('role'),
    problem: get('problem'),
    solution: get('solution'),
    stack: get('stack'),
    links: get('links'),
    github: get('github'),
    demo: get('demo'),
    caseStudyBody: get('caseStudyBody'),
    projectDate: get('projectDate'),
    highlights: get('highlights'),
    cover: get('cover'),
    screenshots: form.get('screenshots')?.trim() ?? '[]',
    replacesMdx: form.get('replacesMdx') === 'on',
    featured: form.get('featured') === 'on',
    visible: form.get('visible') === 'on',
    orderIndex: get('orderIndex'),
  };
}

function parseStack(value: string, errors: Record<string, string>): string[] {
  const items = value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (items.length > 20) errors.stack = 'Use no more than 20 stack items.';
  if (items.some((item) => item.length > 40)) {
    errors.stack = 'Each stack item must contain 40 characters or fewer.';
  }

  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseLinks(
  value: string,
  errors: Record<string, string>,
): ProjectLink[] {
  const rows = value
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);

  if (rows.length > 8) {
    errors.links = 'Use no more than 8 additional links.';
    return [];
  }

  const links: ProjectLink[] = [];
  for (const row of rows) {
    const separator = row.indexOf('|');
    if (separator < 1) {
      errors.links =
        'Use one link per line in the format Label | https://example.com.';
      return [];
    }

    const label = row.slice(0, separator).trim();
    const href = row.slice(separator + 1).trim();
    if (!label || label.length > 80 || href.length > 2048 || !isHttpUrl(href)) {
      errors.links =
        'Each link needs a label of at most 80 characters and a valid HTTP(S) URL.';
      return [];
    }

    links.push({ label, href, external: true });
  }

  return links;
}

export function validateProjectForm(
  form: URLSearchParams,
  options: { allowArchivedStatus?: boolean } = {},
): ProjectValidationResult {
  const values = readValues(form);
  const errors: Record<string, string> = {};

  if (!values.title) errors.title = 'Title is required.';
  else if (values.title.length > 120)
    errors.title = 'Title must contain 120 characters or fewer.';

  if (!values.slug) errors.slug = 'Slug is required.';
  else if (values.slug.length > 80 || !slugPattern.test(values.slug)) {
    errors.slug =
      'Use up to 80 lowercase letters, numbers, and single hyphens.';
  }

  if (!values.description) errors.description = 'Description is required.';
  else if (values.description.length > 300) {
    errors.description = 'Description must contain 300 characters or fewer.';
  }

  const statusAllowed = projectStatuses.includes(
    values.status as ProjectStatus,
  );
  if (
    !statusAllowed ||
    (values.status === 'Archived' && !options.allowArchivedStatus)
  ) {
    errors.status = 'Choose an available project status.';
  }

  const limits: Array<[keyof ProjectFormValues, number, string]> = [
    ['category', 80, 'Category'],
    ['role', 200, 'Role'],
    ['problem', 1000, 'Problem'],
    ['solution', 1000, 'Solution'],
    ['caseStudyBody', 30000, 'Case study body'],
  ];
  for (const [key, maximum, label] of limits) {
    const value = values[key];
    if (typeof value === 'string' && value.length > maximum) {
      errors[key] = `${label} must contain ${maximum} characters or fewer.`;
    }
  }

  for (const key of ['github', 'demo'] as const) {
    const value = values[key];
    if (value && (value.length > 2048 || !isHttpUrl(value))) {
      errors[key] = 'Enter a valid HTTP(S) URL.';
    }
  }

  const stack = parseStack(values.stack, errors);
  const links = parseLinks(values.links, errors);
  const highlights = values.highlights
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (highlights.length > 12 || highlights.some((item) => item.length > 160)) {
    errors.highlights = 'Use up to 12 highlights of 160 characters each.';
  }

  let projectDate: Date | null = null;
  if (values.projectDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.projectDate)) {
      errors.projectDate = 'Use a valid date.';
    } else {
      projectDate = new Date(`${values.projectDate}T00:00:00.000Z`);
      if (
        Number.isNaN(projectDate.getTime()) ||
        projectDate.toISOString().slice(0, 10) !== values.projectDate
      ) {
        errors.projectDate = 'Use a valid date.';
      }
    }
  }

  if (values.cover && !isSafeImageReference(values.cover)) {
    errors.cover = 'Use an uploaded image, site image, or HTTPS image URL.';
  }
  let screenshots: ProjectScreenshot[] = [];
  try {
    const parsed: unknown = JSON.parse(values.screenshots);
    if (!Array.isArray(parsed) || parsed.length > PROJECT_SCREENSHOT_COUNT_MAX)
      throw new Error();
    const seen = new Set<string>();
    for (const item of parsed) {
      if (!item || typeof item !== 'object' || Array.isArray(item))
        throw new Error();
      const row = item as Record<string, unknown>;
      if (
        Object.keys(row).some((key) => !['src', 'alt', 'caption'].includes(key))
      )
        throw new Error();
      if (
        typeof row.src !== 'string' ||
        !isSafeImageReference(row.src) ||
        seen.has(row.src)
      )
        throw new Error();
      if (
        typeof row.alt !== 'string' ||
        !row.alt.trim() ||
        row.alt.length > PROJECT_SCREENSHOT_ALT_MAX_LENGTH
      )
        throw new Error();
      if (
        row.caption !== undefined &&
        (typeof row.caption !== 'string' ||
          row.caption.length > PROJECT_SCREENSHOT_CAPTION_MAX_LENGTH)
      )
        throw new Error();
      seen.add(row.src);
      screenshots.push({
        src: row.src,
        alt: row.alt.trim(),
        ...(typeof row.caption === 'string' && row.caption.trim()
          ? { caption: row.caption.trim() }
          : {}),
      });
    }
  } catch {
    errors.screenshots =
      'Use up to 8 valid, unique screenshots with alternative text.';
  }
  if (values.replacesMdx && values.visible && !values.caseStudyBody) {
    errors.caseStudyBody = 'A public replacement needs a case study.';
  }

  let orderIndex: number | null = null;
  if (values.orderIndex) {
    orderIndex = Number(values.orderIndex);
    if (
      !Number.isInteger(orderIndex) ||
      orderIndex < -10000 ||
      orderIndex > 10000
    ) {
      errors.orderIndex =
        'Order index must be a whole number between -10000 and 10000.';
    }
  }

  if (Object.keys(errors).length > 0) return { success: false, errors, values };

  return {
    success: true,
    values,
    data: {
      slug: values.slug,
      title: values.title,
      description: values.description,
      status: values.status as ProjectStatus,
      category: optionalValue(values.category),
      role: optionalValue(values.role),
      problem: optionalValue(values.problem),
      solution: optionalValue(values.solution),
      stack,
      links,
      github: optionalValue(values.github),
      demo: optionalValue(values.demo),
      caseStudyBody: optionalValue(values.caseStudyBody),
      projectDate,
      highlights,
      cover: optionalValue(values.cover),
      screenshots,
      replacesMdx: values.replacesMdx,
      featured: values.featured,
      visible: values.visible,
      orderIndex,
    },
  };
}
