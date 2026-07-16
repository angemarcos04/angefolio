import type { Theme } from '../theme';

export interface TerminalProject {
  slug: string;
  title: string;
  description: string;
  status: string;
  category?: string;
  stack: string[];
  featured: boolean;
  url?: string;
  github?: string;
  demo?: string;
  updatedAt?: string;
}

export interface TerminalNote {
  slug: string;
  title: string;
  summary?: string;
  url: string;
  createdAt: string;
  updatedAt?: string;
}

export interface TerminalSocial {
  label: string;
  url: string;
}

export interface TerminalStackGroup {
  title: string;
  items: string[];
}

export interface TerminalUpdate {
  label: string;
  date?: string;
  url?: string;
}

export interface PortfolioTerminalData {
  name: string;
  username: string;
  hostname: string;
  email: string;
  github: string;
  repositoryUrl: string;
  about: string;
  nowItems: string[];
  projects: TerminalProject[];
  notes: TerminalNote[];
  socials: TerminalSocial[];
  stack: TerminalStackGroup[];
  routes: Record<string, string>;
  buildCommit?: string;
  buildBranch?: string;
  buildDate?: string;
  latestUpdate?: TerminalUpdate;
  portfolioSince: number;
}

export type TerminalLineKind =
  'normal' | 'muted' | 'accent' | 'error' | 'command';

export interface TerminalLink {
  label: string;
  url: string;
  external?: boolean;
}

export interface TerminalLine {
  text: string;
  kind?: TerminalLineKind;
  links?: TerminalLink[];
}

export interface TerminalResult {
  lines?: TerminalLine[];
  cwd?: string;
  clear?: boolean;
  close?: boolean;
  theme?: Theme;
  navigate?: TerminalLink;
  ok?: boolean;
}
