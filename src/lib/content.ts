import { getCollection, type CollectionEntry } from 'astro:content';

export function sortByDateDesc<T>(
  entries: T[],
  dateSelector: (entry: T) => Date,
): T[] {
  return [...entries].sort(
    (a, b) => dateSelector(b).getTime() - dateSelector(a).getTime(),
  );
}

export async function getVisibleProjects(): Promise<
  CollectionEntry<'projects'>[]
> {
  const projects = await getCollection(
    'projects',
    ({ data }) => data.visible === true,
  );

  return sortByDateDesc(projects, ({ data }) => data.date);
}

export async function getFeaturedProjects(): Promise<
  CollectionEntry<'projects'>[]
> {
  return (await getVisibleProjects()).filter(({ data }) => data.featured);
}

export async function getPublishedNotes(): Promise<CollectionEntry<'notes'>[]> {
  const notes = await getCollection(
    'notes',
    ({ data }) => data.published === true,
  );

  return sortByDateDesc(notes, ({ data }) => data.createdAt);
}

export async function getVisibleLabEntries(): Promise<
  CollectionEntry<'lab'>[]
> {
  const entries = await getCollection(
    'lab',
    ({ data }) => data.visible === true,
  );

  return sortByDateDesc(entries, ({ data }) => data.date);
}
