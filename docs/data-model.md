# Console Data Model

Better Auth core tables, `now_status`, `project_records`, `note_records`, `blog_records`, `lab_records`, `homepage_settings`, `media_assets`, `content_revisions`, `content_redirects`, and `audit_log` live in SQLite through Drizzle/libSQL. Project, Note, and Lab MDX remain on disk for deliberate rollback.

Deployment targets one server with a persistent SQLite volume. SQLite has no native array type, so early `stack` fields use validated JSON text; join tables can replace them if querying individual values becomes important.

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

Phase 11 deliberately uses one stable row rather than inventing status history. Each JSON list is normalized to non-empty lines, limited to 12 items, and limited to 160 characters per item before persistence. The static `nowItems` list is now empty; when the row is missing, unpublished, or unavailable, the homepage hides Now.

## `project_records` (implemented)

| Field                   | Planned shape           | Notes                                                       |
| ----------------------- | ----------------------- | ----------------------------------------------------------- |
| `id`                    | text primary key        | Stable opaque identifier.                                   |
| `slug`                  | text unique             | Public route segment.                                       |
| `title`                 | text                    | Project title.                                              |
| `description`           | text                    | Public card/SEO summary.                                    |
| `status`                | text                    | Planning, Prototype, In Progress, Live, or Archived.        |
| `featured`              | boolean                 | Homepage prominence; does not imply visibility.             |
| `visible`               | boolean                 | Public-query gate. Defaults false for new drafts.           |
| `archived`              | boolean                 | Archive gate; archived rows are always hidden/unfeatured.   |
| `status_before_archive` | text, nullable          | Original status for private-draft restore.                  |
| `stack_json`            | JSON text               | Validated ordered string array.                             |
| `links_json`            | JSON text               | Up to eight validated HTTP(S) links.                        |
| `category`              | text, nullable          | Public grouping label.                                      |
| `role`                  | text, nullable          | Optional owner role.                                        |
| `problem`               | text, nullable          | Optional problem summary.                                   |
| `solution`              | text, nullable          | Optional solution/direction summary.                        |
| `github`                | text, nullable          | Validated HTTP(S) URL.                                      |
| `demo`                  | text, nullable          | Validated HTTP(S) URL.                                      |
| `case_study_body`       | text, nullable          | Authored Markdown; sanitized before public rendering.       |
| `project_date`          | UTC timestamp, nullable | Date shown on the case study.                               |
| `highlights_json`       | JSON text               | Ordered highlights, up to 12 items.                         |
| `cover`                 | text, nullable          | Validated site path or HTTP(S) image URL rendered publicly. |
| `replaces_mdx`          | boolean                 | Explicit public source choice for a matching MDX slug.      |
| `order_index`           | integer, null           | Optional stable public ordering.                            |
| `created_at`            | UTC timestamp           | Creation time.                                              |
| `updated_at`            | UTC timestamp           | Last successful mutation.                                   |

Application validation limits titles, slugs, descriptions, summaries, stack items, links, URLs, body size, and ordering before writes. Only visible, non-archived rows reach public helpers. Archive saves the prior status, sets status to `Archived`, hides, and unfeatures. Restore returns the prior status as a hidden, unfeatured draft; older archived rows without a saved status return to `Planning`. There is no hard delete.

The public catalog merges visible MDX and database records by slug. A record with `replaces_mdx` takes over its matching MDX card and detail page; hiding or archiving it suppresses both. Other MDX entries stay public. Every visible, non-archived database-only record has a request-time project page: an empty case-study body renders an overview, and a meaningful body renders the full case study at the same URL. Visible replacements for matching MDX retain the validator requirement for a nonempty case-study body. A database outage fails closed for projects because falling back to old MDX could reveal an adopted page that was later hidden. Import and rollback procedures are in [project-publishing.md](./project-publishing.md).

## `note_records` (Phase 15)

| Field          | Planned shape    | Notes                                           |
| -------------- | ---------------- | ----------------------------------------------- |
| `id`           | text primary key | Stable opaque identifier.                       |
| `slug`         | text unique      | Public route segment.                           |
| `title`        | text             | Note title.                                     |
| `description`  | text             | Public summary and SEO description.             |
| `body`         | text             | Markdown/MDX source.                            |
| `category`     | text             | Broad archive grouping.                         |
| `tags`         | JSON text        | Validated string array initially.               |
| `published`    | boolean          | Public-query and feed gate; defaults false.     |
| `featured`     | boolean          | Homepage prominence.                            |
| `replaces_mdx` | boolean          | Explicit source choice for a matching MDX slug. |
| `created_at`   | UTC timestamp    | Published date displayed on the note.           |
| `updated_at`   | UTC timestamp    | Last successful mutation.                       |

`replaces_mdx` is separate from `published`, so an imported record can be edited without changing the public page. Notes have revision history but no scheduled publication.

## `blog_records` (Phase 25)

| Field         | Shape            | Notes                                                  |
| ------------- | ---------------- | ------------------------------------------------------ |
| `id`          | text primary key | Stable opaque identifier.                              |
| `slug`        | text unique      | Public `/blog/[slug]` route segment.                   |
| `title`       | text             | Article title.                                         |
| `description` | text             | Public archive summary and SEO description.            |
| `summary`     | text, nullable   | Optional short opening or preview.                     |
| `category`    | text             | Broad topic grouping.                                  |
| `tags`        | JSON text        | Validated string array.                                |
| `body`        | text             | Markdown source; sanitized before public rendering.    |
| `published`   | boolean          | Public-query and feed gate; defaults false.            |
| `featured`    | boolean          | Visual emphasis; does not publish a post.              |
| `archived`    | boolean          | Removes a post from public routes while preserving it. |
| `created_at`  | UTC timestamp    | Publication date displayed on the article.             |
| `updated_at`  | UTC timestamp    | Last successful mutation.                              |

Blog is database-first and separate from Notes; it has no MDX imports. Only published, unarchived rows appear in `/blog`, search, the dedicated RSS feed, and sitemap. Slug redirects, audits, and saved revisions are written with the content update.

## `lab_records` (Phase 16)

| Field             | Planned shape    | Notes                                          |
| ----------------- | ---------------- | ---------------------------------------------- |
| `id`              | text primary key | Stable opaque identifier.                      |
| `slug`            | text unique      | Public route segment.                          |
| `title`           | text             | Experiment title.                              |
| `description`     | text             | Public archive summary.                        |
| `status`          | text             | Idea, Prototype, Testing, Paused, or Archived. |
| `category`        | text, nullable   | Workshop grouping.                             |
| `tags`            | JSON text        | Validated string array initially.              |
| `visible`         | boolean          | Public-query gate; defaults false.             |
| `body`            | text             | Markdown/MDX source.                           |
| `featured`        | boolean          | Visual emphasis; does not change visibility.   |
| `repo`            | text, nullable   | Validated HTTP(S) repository URL.              |
| `demo`            | text, nullable   | Validated HTTP(S) demo URL.                    |
| `related_project` | text, nullable   | Validated project path or HTTP(S) URL.         |
| `tools_json`      | JSON text        | Ordered tool list.                             |
| `lessons_json`    | JSON text        | Ordered lesson list.                           |
| `risk`            | text, nullable   | Low, Medium, or High.                          |
| `replaces_mdx`    | boolean          | Explicit source choice for a matching slug.    |
| `date`            | UTC timestamp    | Logged date shown on the entry.                |
| `updated_at`      | UTC timestamp    | Optional authored update date.                 |

All current Lab fields are modeled. The public catalog reads visible entries only and fails closed when database state is unavailable.

## `homepage_settings` (Phase 19)

| Field           | Shape            | Notes                                            |
| --------------- | ---------------- | ------------------------------------------------ |
| `id`            | text primary key | Singleton key `primary`.                         |
| `settings_json` | JSON text        | Validated homepage settings and bounded content. |
| `updated_at`    | UTC timestamp    | Last successful edit.                            |

The JSON contains the hero and portrait, About copy and labels, section copy and visibility flags, Project/Note/Blog/Lab featured preview counts, stack groups, and a legacy activity caption retained for compatibility. A preview count of 0 shows all featured entries. GitHub activity itself is loaded from the public profile URL in site settings. The bento layout remains fixed. Saves write audit and revision records atomically; missing or unavailable settings use source defaults.

### Stack groups (nested in `homepage_settings`)

Each group contains a `title` and an ordered `items` array. The editor accepts 1–8 groups, with 1–20 items per group and 40 characters per item.

### Homepage cards (nested in `homepage_settings`)

Each bounded card stores `visible`, `eyebrow`, `title`, and `description`. The section keys and order are allow-listed in source; custom HTML and arbitrary layout are not accepted.

The editor preserves the deliberate card order and responsive spans instead of exposing an unrestricted page builder.

## `site_settings` (Phase 21)

| Field           | Shape            | Notes                                                                    |
| --------------- | ---------------- | ------------------------------------------------------------------------ |
| `id`            | text primary key | Singleton key `primary`.                                                 |
| `settings_json` | JSON text        | Allow-listed public name, site name, SEO description, GitHub, and email. |
| `updated_at`    | UTC timestamp    | Last successful mutation.                                                |

Server-rendered pages, homepage contacts, footer, Search page title, and RSS title read these values at request time and fall back to source defaults if the database is unavailable. Prerendered 404 metadata remains a build-time snapshot. Saves write an audit event and revision atomically; revision restore revalidates every field. The canonical URL, social image, authentication configuration, database credentials, and other secrets are not editable here.

## `audit_log`

| Field           | Shape            | Notes                                                                              |
| --------------- | ---------------- | ---------------------------------------------------------------------------------- |
| `id`            | text primary key | Stable event identifier.                                                           |
| `actor_user_id` | text, nullable   | Owner ID; set null if the account is removed.                                      |
| `action`        | text             | Concise action such as `now.update` or `project.archive`.                          |
| `entity_type`   | text             | Logical model name.                                                                |
| `entity_id`     | text, nullable   | Affected record when applicable.                                                   |
| `metadata_json` | JSON text        | Redacted change metadata; never passwords, cookies, tokens, or full secret values. |
| `created_at`    | UTC timestamp    | Immutable event time.                                                              |

Now and project mutations insert an audit entry in the same transaction as the content change. Metadata holds only small non-secret facts, not authored bodies. The current interface has no audit viewer or retention policy.

## `content_revisions` (Phase 17)

| Field              | Shape            | Notes                                                        |
| ------------------ | ---------------- | ------------------------------------------------------------ |
| `id`               | text primary key | Stable revision identifier.                                  |
| `entity_type`      | text             | `now_status`, `project`, `note`, `blog`, `lab`, or settings. |
| `entity_id`        | text             | ID of the row represented by the snapshot.                   |
| `snapshot_json`    | JSON text        | Full validated record at that save, including Markdown body. |
| `actor_user_id`    | text, nullable   | Owner who caused the change; null for migration/import.      |
| `restored_from_id` | text, nullable   | Revision restored to create this current version.            |
| `created_at`       | UTC timestamp    | Snapshot time.                                               |

Each successful create, edit, visibility change, archive/restore action, and content restore writes a snapshot in the same transaction as the mutation. The editor keeps the 50 most recent snapshots per record. Restoring a snapshot validates its entity and ID, checks slug conflicts, updates the content row, writes a new snapshot, and records an audit event atomically.

## `media_assets` (Phase 18)

| Field        | Shape            | Notes                                                  |
| ------------ | ---------------- | ------------------------------------------------------ |
| `id`         | text primary key | Random UUID used in the public media path.             |
| `mime_type`  | text             | Always `image/webp` after server-side conversion.      |
| `data`       | BLOB             | Resized image bytes; limited to 2 MB per stored asset. |
| `created_at` | UTC timestamp    | Upload time.                                           |

Only authenticated same-origin uploads are accepted. JPEG, PNG, and WebP inputs are decoded and checked, bounded to 40 megapixels, resized within 2000×2000, then converted to WebP. Asset delivery looks up UUIDs and sends fixed MIME, immutable cache, and `nosniff` headers. Assets are not deletable so revision snapshots retain working cover references. SQLite backups contain the media bytes with the rest of the database.

## File-to-database migration boundary

Before importing current content:

1. Map every existing collection field, including optional fields omitted from the minimal table sketches.
2. Write repeatable import validation with duplicate-slug and broken-link reporting.
3. Back up the source files and database.
4. Choose one source of truth and make the other read-only during cutover.
5. Compare generated public routes, RSS, sitemap, and Pagefind results before and after migration.
6. Keep drafts and hidden entries out of all public queries by default.

## `content_redirects` (Phase 20)

| Field         | Shape            | Notes                                                   |
| ------------- | ---------------- | ------------------------------------------------------- |
| `from_path`   | text primary key | Internal source path such as `/projects/old-slug`.      |
| `to_path`     | text             | Current canonical path in the same content collection.  |
| `entity_type` | text             | `project`, `note`, or `lab`.                            |
| `entity_id`   | text             | Stable ID of the content record that owns the redirect. |
| `created_at`  | UTC timestamp    | Time the redirect was created or updated.               |

Only published database-backed content creates redirects when its slug changes. The content update, redirect changes, revision, and audit event share one transaction. Previous aliases are flattened to the latest path; source-path collisions are rejected. Public detail routes issue HTTP 308 responses, and redirect sources are excluded from public catalogs, search, feeds, and sitemaps. Revision restore uses the same ownership and collision checks.

Phase 3 adds an optional Blog cover reference and an ordered JSON screenshot-reference array to projects. Screenshot entries contain `src`, required alternative text, and an optional caption; media bytes are stored once in `media_assets`. Existing revision snapshots without these fields restore as `cover = null` and `screenshots = []`.
