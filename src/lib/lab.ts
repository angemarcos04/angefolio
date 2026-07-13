import type { CollectionEntry } from 'astro:content';

export const LAB_STATUS_ORDER = [
  'Prototype',
  'Testing',
  'Idea',
  'Paused',
  'Archived',
] as const;

export function getLabSlug(entry: CollectionEntry<'lab'>): string {
  return entry.id.replace(/\.(md|mdx)$/, '');
}

export function getLabUrl(entry: CollectionEntry<'lab'>): string {
  return `/lab/${getLabSlug(entry)}`;
}

export function sortLabByDateDesc(
  entries: CollectionEntry<'lab'>[],
): CollectionEntry<'lab'>[] {
  return [...entries].sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  );
}

export function groupLabByStatus(entries: CollectionEntry<'lab'>[]) {
  const sortedEntries = sortLabByDateDesc(entries);

  return LAB_STATUS_ORDER.map((status) => ({
    status,
    entries: sortedEntries.filter(({ data }) => data.status === status),
  })).filter((group) => group.entries.length > 0);
}

export function getAllLabTags(entries: CollectionEntry<'lab'>[]): string[] {
  return [
    ...new Set(
      entries.flatMap(({ data }) => data.tags.map((tag) => tag.trim())),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

export function getAllLabCategories(
  entries: CollectionEntry<'lab'>[],
): string[] {
  return [
    ...new Set(
      entries.flatMap(({ data }) =>
        data.category ? [data.category.trim()] : [],
      ),
    ),
  ].sort((a, b) => a.localeCompare(b));
}
