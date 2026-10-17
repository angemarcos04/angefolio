import { isSafeHttpUrl } from '../../data/contentConstraints';

export const labStatuses = [
  'Idea',
  'Prototype',
  'Testing',
  'Paused',
  'Archived',
] as const;
export const labRisks = ['Low', 'Medium', 'High'] as const;

export interface LabRecordInput {
  slug: string;
  title: string;
  description: string;
  status: (typeof labStatuses)[number];
  category: string | null;
  tags: string[];
  visible: boolean;
  featured: boolean;
  repo: string | null;
  demo: string | null;
  relatedProject: string | null;
  tools: string[];
  lessons: string[];
  risk: (typeof labRisks)[number] | null;
  body: string;
  replacesMdx: boolean;
  date: Date;
  updatedAt: Date | null;
}

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const httpUrl = (value: string) => {
  return isSafeHttpUrl(value);
};

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? date
    : null;
}

function lines(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

export function validateLabForm(
  form: URLSearchParams,
):
  | { success: true; data: LabRecordInput }
  | { success: false; errors: Record<string, string> } {
  const get = (key: string) => form.get(key)?.trim() ?? '';
  const slug = get('slug').toLowerCase();
  const title = get('title');
  const description = get('description');
  const category = get('category');
  const tags = lines(get('tags'));
  const tools = lines(get('tools'));
  const lessons = lines(get('lessons'));
  const status = get('status');
  const risk = get('risk');
  const repo = get('repo');
  const demo = get('demo');
  const relatedProject = get('relatedProject');
  const body = form.get('body') ?? '';
  const date = parseDate(get('date'));
  const updatedAtText = get('updatedAt');
  const updatedAt = updatedAtText ? parseDate(updatedAtText) : null;
  const visible = get('visible') === 'on';
  const replacesMdx = get('replacesMdx') === 'on';
  const errors: Record<string, string> = {};

  if (!title || title.length > 120)
    errors.title = 'Use a title of 1 to 120 characters.';
  if (!slug || slug.length > 80 || !slugPattern.test(slug))
    errors.slug = 'Use lowercase letters, numbers, and single hyphens.';
  if (!description || description.length > 300)
    errors.description = 'Use a description of 1 to 300 characters.';
  if (!labStatuses.includes(status as (typeof labStatuses)[number]))
    errors.status = 'Choose a valid experiment status.';
  if (category.length > 80)
    errors.category = 'Category must be 80 characters or fewer.';
  if (tags.length > 20 || tags.some((item) => item.length > 40))
    errors.tags = 'Use up to 20 tags, each 40 characters or fewer.';
  if (tools.length > 20 || tools.some((item) => item.length > 60))
    errors.tools = 'Use up to 20 tools, each 60 characters or fewer.';
  if (lessons.length > 20 || lessons.some((item) => item.length > 500))
    errors.lessons = 'Use up to 20 lessons, each 500 characters or fewer.';
  if (body.length > 200000)
    errors.body = 'Lab body must be 200,000 characters or fewer.';
  if ((visible || (replacesMdx && visible)) && !body.trim())
    errors.body = 'A visible entry needs a body.';
  if (!date) errors.date = 'Use a valid logged date.';
  if (updatedAtText && !updatedAt)
    errors.updatedAt = 'Use a valid updated date.';
  if (risk && !labRisks.includes(risk as (typeof labRisks)[number]))
    errors.risk = 'Choose Low, Medium, or High.';
  for (const [key, value] of [
    ['repo', repo],
    ['demo', demo],
  ] as const) {
    if (value && (value.length > 2048 || !httpUrl(value)))
      errors[key] = 'Enter a valid HTTP(S) URL.';
  }
  if (relatedProject && relatedProject.length > 2048)
    errors.relatedProject = 'Related project link is too long.';
  else if (
    relatedProject &&
    !/^\/projects\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(relatedProject) &&
    !httpUrl(relatedProject)
  )
    errors.relatedProject = 'Use a project path or HTTP(S) URL.';

  if (Object.keys(errors).length) return { success: false, errors };
  return {
    success: true,
    data: {
      slug,
      title,
      description,
      status: status as LabRecordInput['status'],
      category: category || null,
      tags,
      visible,
      featured: get('featured') === 'on',
      repo: repo || null,
      demo: demo || null,
      relatedProject: relatedProject || null,
      tools,
      lessons,
      risk: (risk || null) as LabRecordInput['risk'],
      body,
      replacesMdx,
      date: date!,
      updatedAt,
    },
  };
}
