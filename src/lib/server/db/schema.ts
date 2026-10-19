import {
  blob,
  index,
  integer,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

// Better Auth core tables. Public sign-up remains disabled by the runtime config.
export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' })
    .default(false)
    .notNull(),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_user_id_idx').on(table.userId)],
);

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', {
      mode: 'timestamp',
    }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', {
      mode: 'timestamp',
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [index('account_user_id_idx').on(table.userId)],
);

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

// Phase 11 deliberately adds only the singleton public Now Status model.
export const nowStatus = sqliteTable('now_status', {
  id: text('id').primaryKey(),
  currentFocus: text('current_focus').notNull(),
  workingOn: text('working_on', { mode: 'json' }).$type<string[]>().notNull(),
  learning: text('learning', { mode: 'json' }).$type<string[]>().notNull(),
  using: text('using', { mode: 'json' }).$type<string[]>().notNull(),
  statusNote: text('status_note'),
  published: integer('published', { mode: 'boolean' }).default(false).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Phase 12 project records coexist with the source-controlled MDX collection.
// Public queries apply the visibility and archive boundary in server helpers.
export const projectRecords = sqliteTable(
  'project_records',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    status: text('status').notNull(),
    category: text('category'),
    role: text('role'),
    problem: text('problem'),
    solution: text('solution'),
    stack: text('stack_json', { mode: 'json' }).$type<string[]>().notNull(),
    links: text('links_json', { mode: 'json' })
      .$type<Array<{ label: string; href: string; external: boolean }>>()
      .notNull(),
    github: text('github'),
    demo: text('demo'),
    caseStudyBody: text('case_study_body'),
    projectDate: integer('project_date', { mode: 'timestamp' }),
    highlights: text('highlights_json', { mode: 'json' })
      .$type<string[]>()
      .default([])
      .notNull(),
    cover: text('cover'),
    screenshots: text('screenshots_json', { mode: 'json' })
      .$type<Array<{ src: string; alt: string; caption?: string }>>()
      .default([])
      .notNull(),
    replacesMdx: integer('replaces_mdx', { mode: 'boolean' })
      .default(false)
      .notNull(),
    featured: integer('featured', { mode: 'boolean' }).default(false).notNull(),
    visible: integer('visible', { mode: 'boolean' }).default(false).notNull(),
    archived: integer('archived', { mode: 'boolean' }).default(false).notNull(),
    statusBeforeArchive: text('status_before_archive'),
    orderIndex: integer('order_index'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('project_records_public_idx').on(
      table.visible,
      table.archived,
      table.featured,
    ),
  ],
);

export const noteRecords = sqliteTable(
  'note_records',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    summary: text('summary'),
    category: text('category').notNull(),
    tags: text('tags_json', { mode: 'json' }).$type<string[]>().notNull(),
    body: text('body').notNull(),
    published: integer('published', { mode: 'boolean' })
      .default(false)
      .notNull(),
    featured: integer('featured', { mode: 'boolean' }).default(false).notNull(),
    replacesMdx: integer('replaces_mdx', { mode: 'boolean' })
      .default(false)
      .notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('note_records_public_idx').on(table.published, table.featured),
  ],
);

export const blogRecords = sqliteTable(
  'blog_records',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    summary: text('summary'),
    category: text('category').notNull(),
    tags: text('tags_json', { mode: 'json' }).$type<string[]>().notNull(),
    cover: text('cover'),
    body: text('body').notNull(),
    published: integer('published', { mode: 'boolean' })
      .default(false)
      .notNull(),
    featured: integer('featured', { mode: 'boolean' }).default(false).notNull(),
    archived: integer('archived', { mode: 'boolean' }).default(false).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('blog_records_public_idx').on(
      table.published,
      table.archived,
      table.featured,
    ),
  ],
);

export const labRecords = sqliteTable(
  'lab_records',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    status: text('status').notNull(),
    category: text('category'),
    tags: text('tags_json', { mode: 'json' }).$type<string[]>().notNull(),
    visible: integer('visible', { mode: 'boolean' }).default(false).notNull(),
    featured: integer('featured', { mode: 'boolean' }).default(false).notNull(),
    repo: text('repo'),
    demo: text('demo'),
    relatedProject: text('related_project'),
    tools: text('tools_json', { mode: 'json' }).$type<string[]>().notNull(),
    lessons: text('lessons_json', { mode: 'json' }).$type<string[]>().notNull(),
    risk: text('risk'),
    body: text('body').notNull(),
    replacesMdx: integer('replaces_mdx', { mode: 'boolean' })
      .default(false)
      .notNull(),
    date: integer('date', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }),
  },
  (table) => [
    index('lab_records_public_idx').on(table.visible, table.featured),
  ],
);

export const contentRevisions = sqliteTable(
  'content_revisions',
  {
    id: text('id').primaryKey(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    snapshot: text('snapshot_json', { mode: 'json' })
      .$type<Record<string, unknown>>()
      .notNull(),
    actorUserId: text('actor_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    restoredFromId: text('restored_from_id'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('content_revisions_entity_idx').on(
      table.entityType,
      table.entityId,
      table.createdAt,
    ),
  ],
);

// Phase 18 keeps uploaded media in SQLite so existing database backups also
// capture the files referenced by content and revision snapshots.
export const mediaAssets = sqliteTable('media_assets', {
  id: text('id').primaryKey(),
  mimeType: text('mime_type').notNull(),
  data: blob('data', { mode: 'buffer' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const homepageSettings = sqliteTable('homepage_settings', {
  id: text('id').primaryKey(),
  settings: text('settings_json', { mode: 'json' })
    .$type<Record<string, unknown>>()
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const siteSettings = sqliteTable('site_settings', {
  id: text('id').primaryKey(),
  settings: text('settings_json', { mode: 'json' })
    .$type<Record<string, unknown>>()
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const contentRedirects = sqliteTable('content_redirects', {
  fromPath: text('from_path').primaryKey(),
  toPath: text('to_path').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

/** Canonical database URLs observed while the owning record was public. */
export const contentPublicSlugs = sqliteTable(
  'content_public_slugs',
  {
    path: text('path').primaryKey(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    firstObservedAt: integer('first_observed_at', {
      mode: 'timestamp',
    }).notNull(),
  },
  (table) => [
    index('content_public_slugs_entity_idx').on(
      table.entityType,
      table.entityId,
    ),
  ],
);

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    actorUserId: text('actor_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    metadata: text('metadata_json', { mode: 'json' })
      .$type<Record<string, string | number | boolean | null>>()
      .notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('audit_log_entity_idx').on(table.entityType, table.entityId),
    index('audit_log_created_at_idx').on(table.createdAt),
  ],
);

export const schema = {
  user,
  session,
  account,
  verification,
  nowStatus,
  projectRecords,
  noteRecords,
  blogRecords,
  labRecords,
  contentRevisions,
  mediaAssets,
  homepageSettings,
  siteSettings,
  contentRedirects,
  contentPublicSlugs,
  auditLog,
};
