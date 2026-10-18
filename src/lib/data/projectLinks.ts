export interface ProjectDisplayLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface NormalizedProjectDisplayLink {
  label: string;
  href: string;
  external: boolean;
}

/** Match the safety rules used by public Project detail pages. */
function safeProjectHref(href: string, external: boolean): string | undefined {
  const value = href.trim();
  if (!value) return undefined;
  if (!external && value.startsWith('/') && !value.startsWith('//')) {
    return value;
  }
  if (!external && value.startsWith('#')) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Normalize display-only Project actions. Candidate order is meaningful:
 * callers provide Live Demo, GitHub, then additional links. The first safe
 * occurrence of an exact destination wins, without mutating source data.
 */
export function normalizeProjectDisplayLinks(
  links: readonly ProjectDisplayLink[],
): NormalizedProjectDisplayLink[] {
  const seen = new Set<string>();
  const normalized: NormalizedProjectDisplayLink[] = [];

  for (const link of links) {
    const external = link.external ?? false;
    const href = safeProjectHref(link.href, external);
    if (!href || seen.has(href)) continue;
    seen.add(href);
    normalized.push({ label: link.label, href, external });
  }

  return normalized;
}
