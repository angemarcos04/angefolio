import { normalizeProjectDisplayLinks } from './projectLinks';

export interface ProjectActionSource {
  href?: string;
  github?: string;
  demo?: string;
  caseStudy?: string;
  links?: Array<{ label: string; href: string; external: boolean }>;
}

export interface ProjectAction {
  href: string;
  label: string;
  external: boolean;
  variant: 'primary' | 'secondary' | 'ghost';
}

export function getVisibleItems<T>(items: T[], limit?: number) {
  const count = Math.max(0, limit ?? items.length);
  const visible = items.slice(0, count);
  return { visible, hidden: items.slice(visible.length) };
}

export function getProjectActions({
  href,
  github,
  demo,
  caseStudy,
  links = [],
}: ProjectActionSource): ProjectAction[] {
  const candidates: ProjectAction[] = [];
  if (href) {
    candidates.push({
      href,
      label: 'Explore project',
      external: false,
      variant: 'primary',
    });
  } else if (caseStudy) {
    candidates.push({
      href: caseStudy,
      label: 'Case study',
      external: /^https?:\/\//i.test(caseStudy),
      variant: 'primary',
    });
  }
  if (demo)
    candidates.push({
      href: demo,
      label: 'Live demo',
      external: true,
      variant: candidates.length ? 'secondary' : 'primary',
    });
  if (github)
    candidates.push({
      href: github,
      label: 'GitHub',
      external: true,
      variant: candidates.length ? 'secondary' : 'primary',
    });
  if (caseStudy && href && caseStudy !== href)
    candidates.push({
      href: caseStudy,
      label: 'Case study',
      external: /^https?:\/\//i.test(caseStudy),
      variant: 'ghost',
    });
  for (const link of links) {
    if (
      !link ||
      typeof link.label !== 'string' ||
      typeof link.href !== 'string'
    )
      continue;
    candidates.push({
      href: link.href,
      label: link.label,
      external: link.external,
      variant: candidates.length ? 'ghost' : 'primary',
    });
  }

  const safeCandidates = candidates.map((candidate) => ({
    candidate,
    safe: normalizeProjectDisplayLinks([candidate])[0],
  }));
  return normalizeProjectDisplayLinks(candidates).map((link) => ({
    ...link,
    variant:
      safeCandidates.find(
        ({ safe }) =>
          safe?.href === link.href && safe.external === link.external,
      )?.candidate.variant ?? 'ghost',
  }));
}
