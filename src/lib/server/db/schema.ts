import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
    featured: integer('featured', { mode: 'boolean' }).default(false).notNull(),
    visible: integer('visible', { mode: 'boolean' }).default(false).notNull(),
    archived: integer('archived', { mode: 'boolean' }).default(false).notNull(),
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

export const schema = {
  user,
  session,
  account,
  verification,
  nowStatus,
  projectRecords,
};
