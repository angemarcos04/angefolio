/**
 * Future-facing console contracts only.
 *
 * These shared planning contracts are not the database schema or a public API
 * contract. Server persistence and validation stay under src/lib/server.
 */

export type ConsoleSection =
  | 'overview'
  | 'now'
  | 'projects'
  | 'notes'
  | 'lab'
  | 'stack'
  | 'homepage'
  | 'settings';

export type ConsoleStatus =
  'planned' | 'scaffolded' | 'read-only' | 'operational';

export type VisibilityState = 'visible' | 'hidden' | 'draft' | 'archived';

export type ProjectStatus =
  'Planning' | 'Prototype' | 'In Progress' | 'Live' | 'Archived';

export type LabStatus =
  'Idea' | 'Prototype' | 'Testing' | 'Paused' | 'Archived';

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface NowStatusDraft {
  id?: string;
  currentFocus: string;
  workingOn: string[];
  learning: string[];
  using: string[];
  status?: string;
  updatedAt?: string;
}

export interface EditableProjectDraft {
  id?: string;
  slug: string;
  title: string;
  description: string;
  status: ProjectStatus;
  featured: boolean;
  visible: boolean;
  stack: string[];
  category?: string;
  role?: string;
  problem?: string;
  solution?: string;
  github?: string;
  demo?: string;
  links?: Array<{ label: string; href: string; external: boolean }>;
  caseStudyBody: string;
  archived?: boolean;
  orderIndex?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface EditableNoteDraft {
  id?: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  category: string;
  tags: string[];
  published: boolean;
  featured: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface EditableLabDraft {
  id?: string;
  slug: string;
  title: string;
  description: string;
  status: LabStatus;
  category?: string;
  tags: string[];
  visible: boolean;
  body: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StackGroupDraft {
  id?: string;
  title: string;
  items: string[];
  enabled: boolean;
  sortOrder: number;
  updatedAt?: string;
}

export interface HomepageCardConfig {
  id?: string;
  key: string;
  title: string;
  enabled: boolean;
  sortOrder: number;
  config: Record<string, JsonValue>;
}

export interface SiteSetting {
  key: string;
  value: JsonValue;
  updatedAt?: string;
}
