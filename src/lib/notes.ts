import type { CollectionEntry } from 'astro:content';

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(date));
}

export function getNoteSlug(note: CollectionEntry<'notes'>): string {
  return note.id.replace(/\.(md|mdx)$/, '');
}

export function getNoteUrl(note: CollectionEntry<'notes'>): string {
  return `/notes/${getNoteSlug(note)}`;
}

export function sortNotesByDateDesc(
  notes: CollectionEntry<'notes'>[],
): CollectionEntry<'notes'>[] {
  return [...notes].sort(
    (a, b) => b.data.createdAt.getTime() - a.data.createdAt.getTime(),
  );
}

export function getNoteReadingTime(text: string): string {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(wordCount / 200));

  return `${minutes} min read`;
}

export function getAllTags(notes: CollectionEntry<'notes'>[]): string[] {
  return [
    ...new Set(notes.flatMap(({ data }) => data.tags.map((tag) => tag.trim()))),
  ].sort((a, b) => a.localeCompare(b));
}

export function getAllCategories(notes: CollectionEntry<'notes'>[]): string[] {
  return [...new Set(notes.map(({ data }) => data.category.trim()))].sort(
    (a, b) => a.localeCompare(b),
  );
}
