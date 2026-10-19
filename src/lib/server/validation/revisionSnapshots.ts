import { defaultHomepageConfig, homepageCardKeys } from '../../data/homepage';
import { isSafeHttpUrl } from '../../data/contentConstraints';
import { isSafeImageReference } from '../../data/mediaReference';
import {
  isSafeProjectExternalHref,
  isSafeProjectInternalHref,
} from '../../data/projectLinks';
import { labRisks, labStatuses } from './lab';
import { projectStatuses } from './projects';
import type { RevisionEntityType } from '../revisions';

type Row = Record<string, unknown>;
export type SnapshotValidationResult =
  { success: true; data: Row } | { success: false; reason: string };

const row = (value: unknown): value is Row =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const onlyKeys = (value: Row, allowed: readonly string[]): boolean =>
  Object.keys(value).every((key) => allowed.includes(key));
const text = (value: unknown, max: number, required = false): value is string =>
  typeof value === 'string' &&
  value.length <= max &&
  (!required || !!value.trim());
const optionalText = (value: unknown, max: number): boolean =>
  value === null || value === undefined || text(value, max);
const bool = (value: unknown): value is boolean => typeof value === 'boolean';
const optionalBool = (value: unknown): boolean =>
  value === undefined || bool(value);
const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= min &&
  value <= max;
const list = (
  value: unknown,
  max: number,
  item: (value: unknown) => boolean,
  min = 0,
): boolean =>
  Array.isArray(value) &&
  value.length >= min &&
  value.length <= max &&
  value.every(item);
const words = (
  value: unknown,
  count: number,
  length: number,
  min = 0,
): boolean => list(value, count, (item) => text(item, length, true), min);
const slug = (value: unknown): value is string =>
  text(value, 80, true) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const optionalUrl = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (text(value, 2048) && (!value || isSafeHttpUrl(value)));
const optionalImage = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (text(value, 2048) && (!value || isSafeImageReference(value)));
const localImage = (value: unknown): boolean =>
  text(value, 2048, true) &&
  value.startsWith('/') &&
  !value.startsWith('//') &&
  !value.includes('..') &&
  !/[?#\\\s]/.test(value);
const https = (value: unknown): boolean => {
  if (!text(value, 2048, true)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
};
const optionalHttps = (value: unknown): boolean =>
  value === null || value === undefined || value === '' || https(value);
const date = (value: unknown): boolean => {
  if (value instanceof Date) return Number.isFinite(value.getTime());
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return false;
    value = value < 100000000000 ? value * 1000 : value;
  }
  if (typeof value !== 'number' && typeof value !== 'string') return false;
  if (typeof value === 'string') {
    if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return false;
    const day = value.slice(0, 10);
    const calendarDate = new Date(`${day}T00:00:00.000Z`);
    if (
      !Number.isFinite(calendarDate.getTime()) ||
      calendarDate.toISOString().slice(0, 10) !== day
    )
      return false;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime());
};
const optionalDate = (value: unknown): boolean => value === null || date(value);
const snapshotBase = (s: Row, id: string): boolean => s.id === id;
const contentBase = (s: Row, id: string): boolean =>
  snapshotBase(s, id) &&
  slug(s.slug) &&
  text(s.title, 120, true) &&
  text(s.description, 300, true);

function projectLinks(value: unknown): boolean {
  return list(value, 8, (item) => {
    if (
      !row(item) ||
      Object.keys(item).some(
        (key) => !['label', 'href', 'external'].includes(key),
      )
    )
      return false;
    if (
      !text(item.label, 80, true) ||
      !text(item.href, 2048, true) ||
      !bool(item.external)
    )
      return false;
    if (item.external) return isSafeProjectExternalHref(item.href);
    // Legacy internal links and misclassified absolute HTTP(S) URLs remain
    // restorable when the shared Project display policy accepts them.
    return (
      isSafeProjectInternalHref(item.href) ||
      isSafeProjectExternalHref(item.href)
    );
  });
}

function screenshots(value: unknown): boolean {
  if (value === undefined) return true; // predates screenshot support
  if (
    !list(
      value,
      8,
      (item) =>
        row(item) &&
        Object.keys(item).every((key) =>
          ['src', 'alt', 'caption'].includes(key),
        ) &&
        text(item.src, 2048, true) &&
        isSafeImageReference(item.src) &&
        text(item.alt, 300, true) &&
        (item.caption === undefined || text(item.caption, 200)),
    )
  )
    return false;
  const sources = (value as Row[]).map((item) => item.src);
  return new Set(sources).size === sources.length;
}

function project(s: Row, id: string): boolean {
  return (
    contentBase(s, id) &&
    projectStatuses.includes(s.status as never) &&
    optionalText(s.category, 80) &&
    optionalText(s.role, 200) &&
    optionalText(s.problem, 1000) &&
    optionalText(s.solution, 1000) &&
    optionalText(s.caseStudyBody, 30000) &&
    words(s.stack, 20, 40) &&
    words(s.highlights, 12, 160) &&
    projectLinks(s.links) &&
    screenshots(s.screenshots) &&
    optionalUrl(s.github) &&
    optionalUrl(s.demo) &&
    optionalImage(s.cover) &&
    optionalDate(s.projectDate) &&
    date(s.createdAt) &&
    bool(s.visible) &&
    bool(s.featured) &&
    bool(s.archived) &&
    optionalBool(s.replacesMdx) &&
    (s.statusBeforeArchive === null ||
      s.statusBeforeArchive === undefined ||
      projectStatuses.includes(s.statusBeforeArchive as never)) &&
    (s.orderIndex === null ||
      s.orderIndex === undefined ||
      integer(s.orderIndex, -10000, 10000)) &&
    !(
      s.replacesMdx === true &&
      s.visible === true &&
      !(typeof s.caseStudyBody === 'string' && s.caseStudyBody.trim())
    )
  );
}

function blogOrNote(s: Row, id: string, type: 'blog' | 'note'): boolean {
  return (
    contentBase(s, id) &&
    optionalText(s.summary, 500) &&
    text(s.category, 80, true) &&
    words(s.tags, 20, 40) &&
    text(s.body, 200000) &&
    bool(s.published) &&
    bool(s.featured) &&
    (type === 'blog'
      ? bool(s.archived) && optionalImage(s.cover)
      : optionalBool(s.replacesMdx)) &&
    date(s.createdAt) &&
    !(s.published && !s.body.trim())
  );
}

function lab(s: Row, id: string): boolean {
  return (
    contentBase(s, id) &&
    labStatuses.includes(s.status as never) &&
    optionalText(s.category, 80) &&
    words(s.tags, 20, 40) &&
    words(s.tools, 20, 60) &&
    words(s.lessons, 20, 500) &&
    text(s.body, 200000) &&
    bool(s.visible) &&
    bool(s.featured) &&
    optionalBool(s.replacesMdx) &&
    optionalUrl(s.repo) &&
    optionalUrl(s.demo) &&
    (s.relatedProject === null ||
      s.relatedProject === undefined ||
      (text(s.relatedProject, 2048) &&
        (!s.relatedProject ||
          /^\/projects\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.relatedProject) ||
          isSafeHttpUrl(s.relatedProject)))) &&
    (s.risk === null ||
      s.risk === undefined ||
      labRisks.includes(s.risk as never)) &&
    date(s.date) &&
    optionalDate(s.updatedAt) &&
    !(s.visible && !s.body.trim())
  );
}

function credentialDate(value: unknown): boolean {
  if (value === null || value === '') return true;
  if (typeof value !== 'string') return false;
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split('-').map(Number);
    return month >= 1 && month <= 12 && year >= 1;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && date(value);
}

function credential(value: unknown): boolean {
  if (!row(value)) return false;
  return (
    onlyKeys(value, [
      'id',
      'title',
      'issuer',
      'type',
      'image',
      'verificationUrl',
      'credentialId',
      'source',
      'sourceUrl',
      'issuedAt',
      'expiresAt',
      'featured',
      'visible',
      'order',
    ]) &&
    text(value.id, 80, true) &&
    /^[A-Za-z0-9_-]+$/.test(value.id) &&
    text(value.title, 160, true) &&
    text(value.issuer, 120, true) &&
    [
      'certification',
      'digital_badge',
      'course',
      'training',
      'license',
    ].includes(value.type as string) &&
    ['credly', 'linkedin', 'issuer', 'manual'].includes(
      value.source as string,
    ) &&
    (value.image === null || localImage(value.image)) &&
    value.verificationUrl !== undefined &&
    optionalHttps(value.verificationUrl) &&
    value.sourceUrl !== undefined &&
    optionalHttps(value.sourceUrl) &&
    optionalText(value.credentialId, 200) &&
    credentialDate(value.issuedAt) &&
    credentialDate(value.expiresAt) &&
    bool(value.featured) &&
    bool(value.visible) &&
    integer(value.order, 0, 999)
  );
}

function homepage(s: Row, id: string): boolean {
  if (!snapshotBase(s, id) || id !== 'primary') return false;
  const cards = s.cards;
  const affiliations =
    s.affiliations === undefined
      ? defaultHomepageConfig.affiliations
      : s.affiliations;
  const credentials =
    s.credentials === undefined
      ? defaultHomepageConfig.credentials
      : s.credentials;
  return (
    text(s.heroName, 100, true) &&
    words(s.heroRoles, 6, 80, 1) &&
    text(s.portrait, 2048, true) &&
    (localImage(s.portrait) || https(s.portrait)) &&
    words(s.aboutParagraphs, 4, 500, 1) &&
    list(
      s.aboutMetadata,
      6,
      (item) =>
        row(item) &&
        onlyKeys(item, ['label', 'value']) &&
        text(item.label, 40, true) &&
        text(item.value, 180, true),
    ) &&
    list(
      affiliations,
      6,
      (item) =>
        row(item) &&
        onlyKeys(item, ['name', 'relationship', 'logo', 'url']) &&
        text(item.name, 120, true) &&
        text(item.relationship, 100, true) &&
        localImage(item.logo) &&
        (item.url === undefined || https(item.url)),
    ) &&
    list(credentials, 100, credential) &&
    new Set((credentials as Row[]).map((item) => item.id)).size ===
      (credentials as Row[]).length &&
    integer(s.projectLimit, 0, 8) &&
    integer(s.noteLimit, 0, 6) &&
    integer(s.blogLimit, 0, 6) &&
    integer(s.labLimit, 0, 6) &&
    text(s.activityStatus, 100, true) &&
    list(
      s.stackGroups,
      8,
      (item) =>
        row(item) &&
        onlyKeys(item, ['title', 'items']) &&
        text(item.title, 40, true) &&
        words(item.items, 20, 40, 1),
      1,
    ) &&
    row(cards) &&
    onlyKeys(cards, homepageCardKeys) &&
    homepageCardKeys.every((key) => {
      const card = cards[key];
      return (
        row(card) &&
        onlyKeys(card, ['visible', 'eyebrow', 'title', 'description']) &&
        bool(card.visible) &&
        text(card.eyebrow, 60, true) &&
        text(card.title, 160, true) &&
        text(card.description, 300)
      );
    })
  );
}

function site(s: Row, id: string): boolean {
  if (!snapshotBase(s, id) || id !== 'primary') return false;
  if (
    !text(s.siteName, 50, true) ||
    !text(s.name, 100, true) ||
    !text(s.seoDescription, 320, true) ||
    !text(s.email, 254, true) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email) ||
    !text(s.github, 2048, true)
  )
    return false;
  try {
    const url = new URL(s.github);
    return (
      url.protocol === 'https:' &&
      url.hostname.toLowerCase() === 'github.com' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      /^\/[A-Za-z0-9-]+\/?$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function now(s: Row, id: string): boolean {
  return (
    snapshotBase(s, id) &&
    id === 'primary' &&
    text(s.currentFocus, 160, true) &&
    words(s.workingOn, 12, 160) &&
    words(s.learning, 12, 160) &&
    words(s.using, 12, 160) &&
    optionalText(s.statusNote, 280) &&
    bool(s.published)
  );
}

/** Validate the decoded JSON stored in content_revisions, before any restore write. */
export function validateRevisionSnapshot(
  type: RevisionEntityType,
  value: unknown,
  entityId: string,
  legacySqlBackfill = false,
): SnapshotValidationResult {
  if (!row(value))
    return { success: false, reason: 'Snapshot is not an object.' };
  // Migration 0006 used SQLite json_object(), producing integer 0/1 for
  // boolean columns. Authored revisions use JSON booleans. Normalize only
  // migration-shaped rows; never accept truthy strings or other numbers.
  const migrated =
    legacySqlBackfill &&
    (type === 'project' ||
      type === 'note' ||
      type === 'lab' ||
      type === 'now_status') &&
    (type === 'lab'
      ? typeof value.date === 'number'
      : type === 'now_status'
        ? typeof value.updatedAt === 'number'
        : typeof value.createdAt === 'number');
  let snapshot: Row = value;
  if (migrated) {
    snapshot = { ...value };
    const flags =
      type === 'project'
        ? ['replacesMdx', 'featured', 'visible', 'archived']
        : type === 'note'
          ? ['published', 'featured', 'replacesMdx']
          : type === 'lab'
            ? ['visible', 'featured', 'replacesMdx']
            : ['published'];
    for (const flag of flags) {
      if (snapshot[flag] === 0 || snapshot[flag] === 1)
        snapshot[flag] = snapshot[flag] === 1;
    }
  }
  const valid =
    type === 'project'
      ? project(snapshot, entityId)
      : type === 'blog'
        ? blogOrNote(snapshot, entityId, 'blog')
        : type === 'note'
          ? blogOrNote(snapshot, entityId, 'note')
          : type === 'lab'
            ? lab(snapshot, entityId)
            : type === 'homepage_settings'
              ? homepage(snapshot, entityId)
              : type === 'site_settings'
                ? site(snapshot, entityId)
                : now(snapshot, entityId);
  if (!valid)
    return { success: false, reason: `Invalid ${type} revision snapshot.` };
  if (type === 'homepage_settings') {
    return {
      success: true,
      data: {
        ...snapshot,
        affiliations:
          snapshot.affiliations === undefined
            ? defaultHomepageConfig.affiliations
            : snapshot.affiliations,
        credentials:
          snapshot.credentials === undefined
            ? defaultHomepageConfig.credentials
            : snapshot.credentials,
      },
    };
  }
  return { success: true, data: snapshot };
}
