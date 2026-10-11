import {
  defaultHomepageConfig,
  homepageCardKeys,
  type HomepageCardKey,
  type HomepageConfig,
} from '../../data/homepage';

export interface HomepageValidationResult {
  success: boolean;
  data?: HomepageConfig;
  errors: string[];
}

const text = (form: URLSearchParams, key: string) =>
  (form.get(key) ?? '').trim();

function lines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parsePairs(value: string, label: string, errors: string[]) {
  const entries: Array<{ label: string; value: string }> = [];
  for (const line of lines(value)) {
    const separator = line.indexOf('|');
    if (separator < 1) {
      errors.push(`Use “${label} | value” on each line.`);
      continue;
    }
    entries.push({
      label: line.slice(0, separator).trim(),
      value: line.slice(separator + 1).trim(),
    });
  }
  return entries;
}

function validImageReference(value: string): boolean {
  if (!value || value.length > 2048) return false;
  if (value.startsWith('/') && !value.startsWith('//')) {
    return !value.includes('..') && !/[?#\\\s]/.test(value);
  }
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateHomepageForm(
  form: URLSearchParams,
): HomepageValidationResult {
  const errors: string[] = [];
  const heroName = text(form, 'heroName');
  const heroRoles = lines(text(form, 'heroRoles'));
  const portrait = text(form, 'portrait');
  const aboutTitle = text(form, 'card_title_about');
  const aboutParagraphs = lines(text(form, 'aboutParagraphs'));
  const aboutMetadata = parsePairs(
    text(form, 'aboutMetadata'),
    'label',
    errors,
  );

  if (!heroName || heroName.length > 100)
    errors.push('Name is required (100 characters maximum).');
  if (
    heroRoles.length < 1 ||
    heroRoles.length > 6 ||
    heroRoles.some((role) => role.length > 80)
  ) {
    errors.push('Add 1–6 short role lines, up to 80 characters each.');
  }
  if (!validImageReference(portrait))
    errors.push('Portrait must be a site image path or an HTTPS image URL.');
  if (!aboutTitle || aboutTitle.length > 160)
    errors.push('About heading is required (160 characters maximum).');
  if (
    aboutParagraphs.length < 1 ||
    aboutParagraphs.length > 4 ||
    aboutParagraphs.some((paragraph) => paragraph.length > 500)
  ) {
    errors.push('Add 1–4 About paragraphs, up to 500 characters each.');
  }
  if (
    aboutMetadata.length > 6 ||
    aboutMetadata.some(
      (item) =>
        !item.label ||
        item.label.length > 40 ||
        !item.value ||
        item.value.length > 180,
    )
  ) {
    errors.push(
      'Use up to 6 About details with labels up to 40 and values up to 180 characters.',
    );
  }

  const cards = structuredClone(defaultHomepageConfig.cards);
  for (const key of homepageCardKeys) {
    const eyebrow = text(form, `card_eyebrow_${key}`);
    const title = text(form, `card_title_${key}`);
    const description = text(form, `card_description_${key}`);
    if (!eyebrow || eyebrow.length > 60)
      errors.push(`${key}: eyebrow is required (60 characters maximum).`);
    if (!title || title.length > 160)
      errors.push(`${key}: heading is required (160 characters maximum).`);
    if (description.length > 300)
      errors.push(`${key}: description must be 300 characters or fewer.`);
    cards[key] = {
      visible: form.get(`card_visible_${key}`) === 'on',
      eyebrow,
      title,
      description,
    };
  }

  const projectLimit = Number(text(form, 'projectLimit'));
  const noteLimit = Number(text(form, 'noteLimit'));
  const blogLimit = Number(text(form, 'blogLimit'));
  const labLimit = Number(text(form, 'labLimit'));
  if (
    text(form, 'projectLimit') === '' ||
    !Number.isInteger(projectLimit) ||
    projectLimit < 0 ||
    projectLimit > 8
  ) {
    errors.push('Project preview count must be 0 (all) or between 1 and 8.');
  }
  if (
    text(form, 'noteLimit') === '' ||
    !Number.isInteger(noteLimit) ||
    noteLimit < 0 ||
    noteLimit > 6
  ) {
    errors.push('Note preview count must be 0 (all) or between 1 and 6.');
  }
  if (
    text(form, 'blogLimit') === '' ||
    !Number.isInteger(blogLimit) ||
    blogLimit < 0 ||
    blogLimit > 6
  ) {
    errors.push('Blog preview count must be 0 (all) or between 1 and 6.');
  }
  if (
    text(form, 'labLimit') === '' ||
    !Number.isInteger(labLimit) ||
    labLimit < 0 ||
    labLimit > 6
  ) {
    errors.push('Lab preview count must be 0 (all) or between 1 and 6.');
  }

  const stackGroups: HomepageConfig['stackGroups'] = [];
  for (const line of lines(text(form, 'stackGroups'))) {
    const separator = line.indexOf('|');
    if (separator < 1) {
      errors.push('Use “Group title | item, item” for each stack group.');
      continue;
    }
    const title = line.slice(0, separator).trim();
    const items = line
      .slice(separator + 1)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (
      !title ||
      title.length > 40 ||
      items.length < 1 ||
      items.length > 20 ||
      items.some((item) => item.length > 40)
    ) {
      errors.push(
        'Stack groups need a title (40 characters) and 1–20 items (40 characters each).',
      );
      continue;
    }
    stackGroups.push({ title, items });
  }
  if (stackGroups.length < 1 || stackGroups.length > 8) {
    errors.push('Use between 1 and 8 stack groups.');
  }

  const activityStatus = text(form, 'activityStatus');
  if (!activityStatus || activityStatus.length > 100)
    errors.push('GitHub status is required (100 characters maximum).');

  if (errors.length) return { success: false, errors };
  return {
    success: true,
    errors,
    data: {
      heroName,
      heroRoles,
      portrait,
      aboutParagraphs,
      aboutMetadata,
      projectLimit,
      noteLimit,
      blogLimit,
      labLimit,
      activityStatus,
      stackGroups,
      cards: cards as Record<HomepageCardKey, (typeof cards)[HomepageCardKey]>,
    },
  };
}
