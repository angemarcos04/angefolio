import {
  defaultHomepageConfig,
  homepageCardKeys,
  type HomepageAffiliation,
  type HomepageCardKey,
  type HomepageCredential,
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

function parseAffiliations(value: string, errors: string[]) {
  const entries: HomepageAffiliation[] = [];
  for (const line of lines(value)) {
    const [name, relationship, logo, url, ...extra] = line
      .split('|')
      .map((part) => part.trim());
    if (
      !name ||
      !relationship ||
      !logo ||
      extra.length ||
      (url && !validHttpsUrl(url))
    ) {
      errors.push(
        'Use organization | relationship | site logo path | optional HTTPS link on each affiliation line.',
      );
      continue;
    }
    entries.push({ name, relationship, logo, ...(url ? { url } : {}) });
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

function validHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function validCredentialDate(value: unknown): value is string | null {
  if (value === null || value === '') return true;
  if (typeof value !== 'string') return false;
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, 1));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function validLocalCredentialImage(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' &&
      value.length <= 2048 &&
      value.startsWith('/') &&
      !value.startsWith('//') &&
      !value.includes('..') &&
      !/[?#\\\s]/.test(value))
  );
}

function parseCredentials(
  value: string,
  errors: string[],
): HomepageCredential[] {
  if (!value) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    errors.push('Credential records could not be read.');
    return [];
  }
  if (!Array.isArray(parsed) || parsed.length > 100) {
    errors.push('Use no more than 100 credential records.');
    return [];
  }

  const entries: HomepageCredential[] = [];
  const ids = new Set<string>();
  const types = new Set([
    'certification',
    'digital_badge',
    'course',
    'training',
    'license',
  ]);
  const sources = new Set(['credly', 'linkedin', 'issuer', 'manual']);
  for (const raw of parsed) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push('Each credential must be a record.');
      continue;
    }
    const item = raw as Record<string, unknown>;
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const issuer = typeof item.issuer === 'string' ? item.issuer.trim() : '';
    const type = item.type;
    const source = item.source;
    const verificationUrl =
      item.verificationUrl === '' ? null : item.verificationUrl;
    const credentialId =
      typeof item.credentialId === 'string' && item.credentialId.trim()
        ? item.credentialId.trim()
        : null;
    const sourceUrl = item.sourceUrl === '' ? null : item.sourceUrl;
    const issuedAt = item.issuedAt === '' ? null : item.issuedAt;
    const expiresAt = item.expiresAt === '' ? null : item.expiresAt;
    const order = item.order;
    if (
      !/^[A-Za-z0-9_-]{1,80}$/.test(id) ||
      ids.has(id) ||
      !title ||
      title.length > 160 ||
      !issuer ||
      issuer.length > 120 ||
      typeof type !== 'string' ||
      !types.has(type) ||
      typeof source !== 'string' ||
      !sources.has(source) ||
      !validLocalCredentialImage(item.image) ||
      (verificationUrl !== null &&
        (typeof verificationUrl !== 'string' ||
          verificationUrl.length > 2048 ||
          !validHttpsUrl(verificationUrl))) ||
      (credentialId !== null && credentialId.length > 200) ||
      (sourceUrl !== null &&
        (typeof sourceUrl !== 'string' ||
          sourceUrl.length > 2048 ||
          !validHttpsUrl(sourceUrl))) ||
      !validCredentialDate(issuedAt) ||
      !validCredentialDate(expiresAt) ||
      typeof item.featured !== 'boolean' ||
      typeof item.visible !== 'boolean' ||
      !Number.isInteger(order) ||
      (order as number) < 0 ||
      (order as number) > 999
    ) {
      errors.push(
        'Check credential titles, types, HTTPS links, local image paths, dates, and display order.',
      );
      continue;
    }
    ids.add(id);
    entries.push({
      id,
      title,
      issuer,
      type: type as HomepageCredential['type'],
      image: item.image,
      verificationUrl,
      credentialId,
      source: source as HomepageCredential['source'],
      sourceUrl,
      issuedAt,
      expiresAt,
      featured: item.featured,
      visible: item.visible,
      order: order as number,
    });
  }
  return entries;
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
  const affiliations = form.has('affiliations')
    ? parseAffiliations(text(form, 'affiliations'), errors)
    : defaultHomepageConfig.affiliations;
  const credentials = form.has('credentials')
    ? parseCredentials(text(form, 'credentials'), errors)
    : defaultHomepageConfig.credentials;

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
  if (
    affiliations.length > 6 ||
    affiliations.some(
      (item) =>
        item.name.length > 120 ||
        item.relationship.length > 100 ||
        !item.logo.startsWith('/') ||
        item.logo.startsWith('//') ||
        item.logo.includes('..') ||
        /[?#\\\s]/.test(item.logo) ||
        item.logo.length > 2048 ||
        (item.url !== undefined &&
          (item.url.length > 2048 || !validHttpsUrl(item.url))),
    )
  ) {
    errors.push(
      'Use up to 6 affiliations with a name (120 characters maximum), relationship (100 maximum), and a local image path.',
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
      affiliations,
      credentials,
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
