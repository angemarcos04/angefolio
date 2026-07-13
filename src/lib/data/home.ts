export interface StackGroup {
  title: string;
  items: string[];
}

export interface ContactLink {
  label: string;
  href: string;
  external?: boolean;
}

export const aboutTags = [
  'IT Student',
  'Full-stack',
  'Linux',
  'Backend',
  'AI/Data',
  'Digital Garden',
];

export const nowItems = [
  'Building this portfolio in Astro + Svelte.',
  'Working on CSPAMS and Aulert.',
  'Learning cleaner UI architecture, backend systems, and AI-assisted workflows.',
  'Daily driver: Gentoo Linux + Neovim.',
];

export const stackGroups: StackGroup[] = [
  {
    title: 'Frontend',
    items: ['Astro', 'Svelte', 'TypeScript', 'Tailwind CSS'],
  },
  { title: 'Backend', items: ['Laravel', 'FastAPI', 'PostgreSQL'] },
  {
    title: 'Systems',
    items: ['Gentoo Linux', 'Bash/Zsh', 'Neovim', 'Git', 'Podman/Docker'],
  },
  { title: 'Exploring', items: ['Rust', 'AI tools', 'Data workflows'] },
];

export const contactLinks: ContactLink[] = [
  { label: 'Email', href: 'mailto:angellie.marcos0104@protonmail.me' },
  { label: 'GitHub', href: 'https://github.com/angemarcos04', external: true },
  { label: 'Resume / CV', href: '/resume.pdf' },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/angellie-marcos-6a904917a/',
    external: true,
  },
];

export const activityLevels = [
  0, 0, 1, 0, 2, 0, 0, 1, 0, 3, 0, 1, 0, 0, 1, 2, 0, 0, 3, 1, 0, 2, 0, 0, 1, 4,
  0, 1, 0, 1, 3, 0, 2, 0, 4, 1, 0, 2, 0, 0, 3, 1, 2, 0, 1, 4, 0, 2, 1, 0, 3, 0,
  1, 2, 0, 4, 0, 2, 1, 3, 0, 1, 4, 2, 0, 3, 1, 0, 2, 4,
];
