import { stackGroups } from './home';

export const homepageCardKeys = [
  'about',
  'projects',
  'now',
  'stack',
  'activity',
  'notes',
  'blog',
  'lab',
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
  blogLimit: number;
  labLimit: number;
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
    "I'm an Information Technology student at AMA Computer College – Santiago, building web applications and backend systems while exploring Linux and the tools around it.",
    'I like practical, personalized, and sometimes unconventional approaches to development. I prefer understanding how things work and building tools that give people more control.',
    "Lately, I've also been exploring cybersecurity in my free time.",
  ],
  aboutMetadata: [
    { label: 'domains', value: 'linux  backend  ai/data  digital gardens' },
    { label: 'focus', value: 'practical tools  privacy-first systems' },
  ],
  projectLimit: 4,
  noteLimit: 3,
  blogLimit: 3,
  labLimit: 3,
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
      description: '',
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
      eyebrow: 'Featured Notes',
      title: 'Things I am learning out loud',
      description: '',
    },
    blog: {
      visible: true,
      eyebrow: 'Featured Blog',
      title: 'Longer thoughts and technical writing',
      description: '',
    },
    lab: {
      visible: true,
      eyebrow: 'Featured Lab',
      title: 'Experiments worth sharing',
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
