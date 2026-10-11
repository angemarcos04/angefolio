export interface ProgressSection {
  id: string;
  label: string;
}

export const homeProgressSections: ProgressSection[] = [
  {
    id: 'introduction',
    label: 'Introduction',
  },
  {
    id: 'featured-projects',
    label: 'Featured projects',
  },
  {
    id: 'current-focus',
    label: 'Current focus and stack',
  },
  {
    id: 'github-activity',
    label: 'GitHub activity',
  },
  {
    id: 'latest-notes',
    label: 'Featured notes',
  },
  {
    id: 'featured-blog',
    label: 'Featured blog',
  },
  {
    id: 'featured-lab',
    label: 'Featured Lab',
  },
  {
    id: 'contact',
    label: 'Contact',
  },
];
