export interface NoteRecordInput {
  slug: string;
  title: string;
  description: string;
  summary: string | null;
  category: string;
  tags: string[];
  body: string;
  published: boolean;
  featured: boolean;
  replacesMdx: boolean;
  createdAt: Date;
}

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateNoteForm(
  form: URLSearchParams,
):
  | { success: true; data: NoteRecordInput }
  | { success: false; errors: Record<string, string> } {
  const get = (key: string) => form.get(key)?.trim() ?? '';
  const slug = get('slug').toLowerCase();
  const title = get('title');
  const description = get('description');
  const summary = get('summary');
  const category = get('category');
  const body = form.get('body') ?? '';
  const tags = get('tags')
    .split(/\r?\n/)
    .map((tag) => tag.trim())
    .filter(Boolean);
  const dateText = get('createdAt');
  const errors: Record<string, string> = {};

  if (!title || title.length > 120)
    errors.title = 'Use a title of 1 to 120 characters.';
  if (!slug || slug.length > 80 || !slugPattern.test(slug))
    errors.slug = 'Use lowercase letters, numbers, and single hyphens.';
  if (!description || description.length > 300)
    errors.description = 'Use a description of 1 to 300 characters.';
  if (summary.length > 500)
    errors.summary = 'Summary must be 500 characters or fewer.';
  if (!category || category.length > 80)
    errors.category = 'Use a category of 1 to 80 characters.';
  if (tags.length > 20 || tags.some((tag) => tag.length > 40))
    errors.tags = 'Use up to 20 tags, each 40 characters or fewer.';
  if (body.length > 200000)
    errors.body = 'Note body must be 200,000 characters or fewer.';
  if (get('published') === 'on' && !body.trim())
    errors.body = 'Add a body before publishing.';
  const createdAt = /^\d{4}-\d{2}-\d{2}$/.test(dateText)
    ? new Date(`${dateText}T00:00:00.000Z`)
    : new Date('invalid');
  if (
    Number.isNaN(createdAt.getTime()) ||
    createdAt.toISOString().slice(0, 10) !== dateText
  )
    errors.createdAt = 'Use a valid date.';
  if (get('replacesMdx') === 'on' && get('published') === 'on' && !body.trim())
    errors.body = 'A public replacement needs a body.';

  if (Object.keys(errors).length) return { success: false, errors };
  return {
    success: true,
    data: {
      slug,
      title,
      description,
      summary: summary || null,
      category,
      tags,
      body,
      published: get('published') === 'on',
      featured: get('featured') === 'on',
      replacesMdx: get('replacesMdx') === 'on',
      createdAt,
    },
  };
}
