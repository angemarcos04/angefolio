import { stackGroups } from './home';

export const homepageCardKeys = [
  'about',
  'projects',
  'now',
  'stack',
  'activity',
  'notes',
  'contact',
] as const;

export type HomepageCardKey = (typeof homepageCardKeys)[number];

export interface HomepageCardConfig {
  visible: boolean;
  eyebrow: string;
  title: string;
  description: string;
}

export interface HomepageConfig {
  heroName: string;
  heroRoles: string[];
  portrait: string;
  aboutParagraphs: string[];
  aboutMetadata: Array<{ label: string; value: string }>;
  projectLimit: number;
  noteLimit: number;
  activityStatus: string;
  stackGroups: Array<{ title: string; items: string[] }>;
  cards: Record<HomepageCardKey, HomepageCardConfig>;
}

export const defaultHomepageConfig: HomepageConfig = {
  heroName: 'Angellie D. Marcos',
  heroRoles: [
    'Full-stack developer.',
    'Backend systems builder.',
    'Linux workflow tinkerer.',
    'Privacy-first toolmaker.',
  ],
  portrait: '/91889584.jpeg',
  aboutParagraphs: [
    'She studies information technology at AMA Computer College and builds web and backend systems through Linux-oriented workflows.',
    'Her working style favors pragmatic, personalized, and sometimes unconventional tools that keep the person using them in control.',
  ],
  aboutMetadata: [
    { label: 'domains', value: 'linux  backend  ai/data  digital gardens' },
    { label: 'focus', value: 'practical tools  privacy-first systems' },
  ],
  projectLimit: 4,
  noteLimit: 3,
  activityStatus: 'active learner / project builder',
  stackGroups,
  cards: {
    about: {
      visible: true,
      eyebrow: 'About',
      title: 'Coding, tinkering, and convincing computers to do my bidding.',
      description: '',
    },
    projects: {
      visible: true,
      eyebrow: 'Featured Projects',
      title: 'Systems and ideas I am taking seriously.',
      description:
        'A mix of active school systems, prototypes, and planned personal tools.',
    },
    now: {
      visible: true,
      eyebrow: 'Now',
      title: 'Current focus',
      description: '',
    },
    stack: {
      visible: true,
      eyebrow: 'Stack',
      title: 'Tools I build with',
      description: '',
    },
    activity: {
      visible: true,
      eyebrow: 'GitHub Activity',
      title: 'Building in public',
      description: 'Public work, experiments, and project commits live here.',
    },
    notes: {
      visible: true,
      eyebrow: 'Latest Notes',
      title: 'Things I am learning out loud',
      description: '',
    },
    contact: {
      visible: true,
      eyebrow: 'Contact',
      title: 'Let us make something useful.',
      description: 'Want to talk, collaborate, or check my work?',
    },
  },
};
