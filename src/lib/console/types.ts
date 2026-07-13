/**
 * Future-facing console contracts only.
 *
 * Phase 10 has no console runtime, persistence, authentication, or mutation
 * code. These types document intended boundaries without becoming a database
 * schema or a public API contract.
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
  github?: string;
  demo?: string;
  caseStudyBody: string;
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
