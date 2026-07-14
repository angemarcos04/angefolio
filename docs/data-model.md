# Console Data Model

Phase 11 creates the first database boundary: Better Auth core tables and one `now_status` table in SQLite through Drizzle/libSQL. Projects, notes, and Lab entries remain TypeScript/MDX loaded through Astro Content Collections; their sections below are future sketches, not implemented schema.

The local development candidate is SQLite through Drizzle ORM. Turso/libSQL may later provide hosted persistence. SQLite has no native array type, so early `stack` and `tags` fields can use validated JSON text; join tables can replace them if querying individual values becomes important.

## Conventions

- Prefer generated opaque IDs; never treat editable slugs as primary keys.
- Store timestamps in UTC and expose them as ISO 8601 values at application boundaries.
- Enforce unique slugs for routable content and unique keys for settings/cards.
- Validate enum-like values in both the application schema and database constraints where supported.
- Default public visibility flags to false during creation.
- Keep authored bodies separate from rendered HTML.
- Record mutations in `audit_log` in the same transaction where practical.

## Better Auth core tables

The generated migration includes Better Auth's required `user`, `session`, `account`, and `verification` tables. Password hashes live only in credential account records; session tokens live only in the server database and HTTP-only cookies. Public registration is disabled by application configuration.

Do not hand-edit auth data. Use Better Auth APIs and versioned migrations so hashing, account links, session expiry, and cleanup retain library semantics.

## `now_status` (implemented)

| Field           | Planned shape    | Notes                                               |
| --------------- | ---------------- | --------------------------------------------------- |
| `id`            | text primary key | Phase 11 singleton key: `primary`.                  |
| `current_focus` | text             | Short public summary.                               |
| `working_on`    | JSON text        | Ordered list of active work.                        |
| `learning`      | JSON text        | Ordered list of current learning topics.            |
| `using`         | JSON text        | Current environment or tools.                       |
| `status_note`   | text, nullable   | Optional public context, limited to 280 characters. |
| `published`     | boolean          | Public-query gate; defaults false.                  |
| `updated_at`    | UTC timestamp    | Set on every successful update.                     |

Phase 11 deliberately uses one stable row rather than inventing status history. Each JSON list is normalized to non-empty lines, limited to 12 items, and limited to 160 characters per item before persistence. The homepage returns the original static `nowItems` when this row is missing, unpublished, or unavailable.

## `projects`

| Field             | Planned shape    | Notes                                                     |
| ----------------- | ---------------- | --------------------------------------------------------- |
| `id`              | text primary key | Stable opaque identifier.                                 |
| `slug`            | text unique      | Public route segment.                                     |
| `title`           | text             | Project title.                                            |
| `description`     | text             | Public card/SEO summary.                                  |
| `status`          | text             | Planning, Prototype, In Progress, Live, or Archived.      |
| `featured`        | boolean          | Homepage prominence; does not imply visibility.           |
| `visible`         | boolean          | Public-query gate. Defaults false for new drafts.         |
| `stack`           | JSON text        | Validated ordered string array initially.                 |
| `category`        | text, nullable   | Public grouping label.                                    |
| `github`          | text, nullable   | Validated HTTPS URL.                                      |
| `demo`            | text, nullable   | Validated HTTPS URL.                                      |
| `case_study_body` | text             | Markdown/MDX source subject to a future rendering policy. |
| `created_at`      | UTC timestamp    | Creation time.                                            |
| `updated_at`      | UTC timestamp    | Last successful mutation.                                 |

Current project frontmatter also contains optional role, problem, solution, highlights, links, cover, and order fields. Phase 11 must decide whether to preserve them as columns, validated JSON, or a related table before importing project content.

## `notes`

| Field         | Planned shape    | Notes                                                                        |
| ------------- | ---------------- | ---------------------------------------------------------------------------- |
| `id`          | text primary key | Stable opaque identifier.                                                    |
| `slug`        | text unique      | Public route segment.                                                        |
| `title`       | text             | Note title.                                                                  |
| `description` | text             | Public summary and SEO description.                                          |
| `body`        | text             | Markdown/MDX source.                                                         |
| `category`    | text             | Broad archive grouping.                                                      |
| `tags`        | JSON text        | Validated string array initially.                                            |
| `published`   | boolean          | Public-query and feed gate; defaults false.                                  |
| `featured`    | boolean          | Homepage prominence.                                                         |
| `created_at`  | UTC timestamp    | Draft creation or intended publication timestamp; semantics must be decided. |
| `updated_at`  | UTC timestamp    | Last successful mutation.                                                    |

If publication scheduling is needed, add an explicit `published_at` instead of overloading `created_at`.

## `lab_entries`

| Field         | Planned shape    | Notes                                          |
| ------------- | ---------------- | ---------------------------------------------- |
| `id`          | text primary key | Stable opaque identifier.                      |
| `slug`        | text unique      | Public route segment.                          |
| `title`       | text             | Experiment title.                              |
| `description` | text             | Public archive summary.                        |
| `status`      | text             | Idea, Prototype, Testing, Paused, or Archived. |
| `category`    | text, nullable   | Workshop grouping.                             |
| `tags`        | JSON text        | Validated string array initially.              |
| `visible`     | boolean          | Public-query gate; defaults false.             |
| `body`        | text             | Markdown/MDX source.                           |
| `created_at`  | UTC timestamp    | Creation/logged time.                          |
| `updated_at`  | UTC timestamp    | Last successful mutation.                      |

Existing optional tools, featured, links, lessons, and risk metadata need an explicit migration decision before Lab import.

## `stack_groups`

| Field        | Planned shape    | Notes                                                |
| ------------ | ---------------- | ---------------------------------------------------- |
| `id`         | text primary key | Stable opaque identifier.                            |
| `title`      | text             | Frontend, Backend, Systems, or another public label. |
| `items`      | JSON text        | Ordered validated string array initially.            |
| `sort_order` | integer          | Stable display order.                                |
| `enabled`    | boolean          | Public-query gate.                                   |
| `updated_at` | UTC timestamp    | Last successful mutation.                            |

## `homepage_cards`

| Field         | Planned shape    | Notes                                                                    |
| ------------- | ---------------- | ------------------------------------------------------------------------ |
| `id`          | text primary key | Stable opaque identifier.                                                |
| `key`         | text unique      | Stable card key such as `hero`, `projects`, or `now`.                    |
| `title`       | text             | Console-facing label; public rendering may use card-specific content.    |
| `enabled`     | boolean          | Whether the card appears publicly.                                       |
| `sort_order`  | integer          | Stable dashboard order.                                                  |
| `config_json` | JSON text        | Card-specific validated configuration; never unvalidated arbitrary HTML. |

The public homepage currently has eight deliberate cards. Phase 11 should preserve layout constraints instead of turning the page into an unrestricted page builder.

## `site_settings`

| Field        | Planned shape    | Notes                                  |
| ------------ | ---------------- | -------------------------------------- |
| `key`        | text primary key | Namespaced setting key.                |
| `value_json` | JSON text        | Validated value with a per-key schema. |
| `updated_at` | UTC timestamp    | Last successful mutation.              |

Allow-list supported keys. Authentication configuration, database credentials, and other secrets must never be stored here or returned to public clients.

## `audit_log`

| Field           | Planned shape    | Notes                                                                              |
| --------------- | ---------------- | ---------------------------------------------------------------------------------- |
| `id`            | text primary key | Stable event identifier.                                                           |
| `action`        | text             | Concise action such as `now_status.update`.                                        |
| `entity_type`   | text             | Logical model name.                                                                |
| `entity_id`     | text, nullable   | Affected record when applicable.                                                   |
| `metadata_json` | JSON text        | Redacted change metadata; never passwords, cookies, tokens, or full secret values. |
| `created_at`    | UTC timestamp    | Immutable event time.                                                              |

A future `actor_user_id` should reference the authenticated owner account once the auth storage model is selected. Audit entries should be append-only from application code.

## File-to-database migration boundary

Before importing current content:

1. Map every existing collection field, including optional fields omitted from the minimal table sketches.
2. Write repeatable import validation with duplicate-slug and broken-link reporting.
3. Back up the source files and database.
4. Choose one source of truth and make the other read-only during cutover.
5. Compare generated public routes, RSS, sitemap, and Pagefind results before and after migration.
6. Keep drafts and hidden entries out of all public queries by default.
