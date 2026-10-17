/** Astro collection IDs preserve the source filename and optional extension. */
export function mdxSlugFromId(id: string): string {
  return id.replace(/\.(?:md|mdx)$/i, '');
}

/** Compare against every source entry, regardless of its publication metadata. */
export function hasMdxSlug(slugs: readonly string[], slug: string): boolean {
  return slugs.some((candidate) => candidate === slug);
}

/**
 * A source entry reserves its slug unless this record is explicitly replacing
 * that entry. Keeping the current slug is an ordinary edit to an existing
 * record and does not create a new ownership claim.
 */
export function isMdxSlugClaimConflict(
  slugs: readonly string[],
  slug: string,
  options: { replacesMdx: boolean; currentSlug?: string },
): boolean {
  return (
    hasMdxSlug(slugs, slug) &&
    slug !== options.currentSlug &&
    !options.replacesMdx
  );
}
