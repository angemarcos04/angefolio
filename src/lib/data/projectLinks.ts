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

const validationOrigin = 'https://project-links.invalid';
const unsafeCharacters = /[\\\u0000-\u001f\u007f]/;

function hasValidEscapes(value: string): boolean {
  if (/%(?![0-9a-f]{2})|%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(value)) return false;
  try {
    decodeURIComponent(value);
    return true;
  } catch {
    return false;
  }
}

/** Internal paths and fragments retain their original, same-origin form. */
export function isSafeProjectInternalHref(value: string): boolean {
  if (
    !value ||
    value.length > 2048 ||
    unsafeCharacters.test(value) ||
    !hasValidEscapes(value)
  )
    return false;
  const path = value.split(/[?#]/, 1)[0];
  if (value.startsWith('/')) {
    if (value.startsWith('//')) return false;
    // Encoded separators and dot segments can change meaning after an
    // intermediary decodes the path, even though URL() keeps them same-origin.
    if (/%(?:2f|5c|2e|25(?:2f|5c|2e))/i.test(path)) return false;
  } else if (!value.startsWith('#')) return false;
  try {
    return new URL(value, validationOrigin).origin === validationOrigin;
  } catch {
    return false;
  }
}

/** Match the browser's HTTP(S) parsing, without credentials or ambiguous syntax. */
export function isSafeProjectExternalHref(value: string): boolean {
  if (unsafeCharacters.test(value) || value.length > 2048) return false;
  const destination = value.trim();
  if (!/^https?:\/\//i.test(destination) || !hasValidEscapes(destination))
    return false;
  try {
    const url = new URL(destination);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      !!url.hostname &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function safeProjectHref(
  href: string,
  declaredExternal: boolean,
): { href: string; external: boolean } | undefined {
  if (unsafeCharacters.test(href)) return undefined;
  const value = href.trim();
  if (!declaredExternal && isSafeProjectInternalHref(value))
    return { href: value, external: false };
  // Legacy MDX may mark an absolute destination as internal. Keep its URL,
  // while displaying it with accurate external navigation metadata.
  if (isSafeProjectExternalHref(value)) return { href: value, external: true };
  return undefined;
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
    if (
      !link ||
      typeof link.label !== 'string' ||
      typeof link.href !== 'string' ||
      (link.external !== undefined && typeof link.external !== 'boolean')
    )
      continue;
    const safe = safeProjectHref(link.href, link.external ?? false);
    if (!safe || seen.has(safe.href)) continue;
    seen.add(safe.href);
    normalized.push({ label: link.label, ...safe });
  }

  return normalized;
}
