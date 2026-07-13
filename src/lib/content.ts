import { getCollection, type CollectionEntry } from 'astro:content';

export function sortByDateDesc<T>(
  entries: T[],
  dateSelector: (entry: T) => Date,
): T[] {
  return [...entries].sort(
    (a, b) => dateSelector(b).getTime() - dateSelector(a).getTime(),
  );
}

export function getProjectSlug(project: CollectionEntry<'projects'>): string {
  return project.id.replace(/\.(md|mdx)$/, '');
}

export function getProjectUrl(project: CollectionEntry<'projects'>): string {
  return `/projects/${getProjectSlug(project)}`;
}

export function sortProjects(
  projects: CollectionEntry<'projects'>[],
): CollectionEntry<'projects'>[] {
  return [...projects].sort((a, b) => {
    const featuredDifference =
      Number(b.data.featured) - Number(a.data.featured);

    if (featuredDifference !== 0) return featuredDifference;

    const aHasOrder = a.data.order !== undefined;
    const bHasOrder = b.data.order !== undefined;

    if (aHasOrder || bHasOrder) {
      if (!aHasOrder) return 1;
      if (!bHasOrder) return -1;

      const orderDifference = a.data.order! - b.data.order!;
      if (orderDifference !== 0) return orderDifference;
    }

    return b.data.date.getTime() - a.data.date.getTime();
  });
}

export async function getVisibleProjects(): Promise<
  CollectionEntry<'projects'>[]
> {
  const projects = await getCollection(
    'projects',
    ({ data }) => data.visible === true,
  );

  return sortProjects(projects);
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
