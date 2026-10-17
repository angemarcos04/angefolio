# Private Console Plan

## Purpose

`/user` is the private workspace for maintaining public portfolio content. It is unlinked from the public site. Phase 14 adds project authoring and a controlled MDX cutover on the Phase 13 owner/auth/database foundation.

## Implemented scope and boundaries

Implemented now:

- Standalone Astro Node SSR for request-time sessions and data
- Better Auth email/password authentication with public sign-up disabled
- Drizzle over a local SQLite database through libSQL
- One-time, single-owner command-line bootstrap
- Server-guarded `/user` overview and Now editor
- Origin-checked, authenticated Now Status mutation
- Database-backed homepage status; the source fallback list is currently empty
- Protected project list, create, edit, visibility/featured toggles, and archive
- Per-slug public source selection between MDX and database projects
- Dynamic project details, sanitized Markdown, private preview, live search, and sitemap
- Dry-run project import with conflict refusal and a verified pre-import backup
- Transactional audit records for Now and project changes
- Recoverable project archive that restores to a private draft
- SQLite backup, verification, and restore-copy commands with an integration test
- Validated project image upload, automatic WebP conversion, cover selection, and public image delivery from SQLite
- Database backups include uploaded images, while project revisions preserve cover references

Still out of scope:

- Public registration, OAuth, multiple administrators, or email delivery
- File/MDX mutation, arbitrary MDX execution, general media library management, hard delete, or a general CMS
- A self-service account-recovery UI, multi-factor authentication, or public registration

## Console sections

| Section       | Current state | Intended responsibility                                               |
| ------------- | ------------- | --------------------------------------------------------------------- |
| Overview      | Implemented   | Identify the signed-in owner and available modules.                   |
| Now Status    | Implemented   | Edit focus, work, learning, tools, note, and publish state.           |
| Projects      | Implemented   | Edit case studies, source choice, visibility, and archive.            |
| Notes         | Implemented   | Draft, preview, publish, and select the source for each slug.         |
| Lab           | Implemented   | Manage experiment status, visibility, observations, and links.        |
| Project Media | Implemented   | Upload validated project cover images and select them in the editor.  |
| Homepage      | Implemented   | Edit copy, section visibility, preview counts, and stack groups.      |
| Settings      | Implemented   | Edit allow-listed public identity, SEO description, and contact data. |

The console should stay a compact terminal-minded control panel, not grow into a generic SaaS dashboard.

## Current data model

The Drizzle schema contains Better Auth's `user`, `session`, `account`, and `verification` tables plus `now_status`, content records, `homepage_settings`, `site_settings`, `media_assets`, `content_revisions`, `content_redirects`, and `audit_log`. The singleton Now and homepage settings rows use the stable ID `primary`; public status has a `published` gate. Project records use opaque IDs, unique slugs, validated JSON stack/link arrays, explicit visibility/featured/archive flags, and timestamps.

Project, Notes, and Lab MDX remain read-only rollback sources. Adopted database records render sanitized Markdown at the same public URL, while unmatched MDX entries remain live. See [project-publishing.md](./project-publishing.md), [note-publishing.md](./note-publishing.md), and [lab-publishing.md](./lab-publishing.md) for source selection and [data-model.md](./data-model.md) for fields.

## Authentication plan and current behavior

Better Auth owns password hashing and HTTP-only database sessions. Production enables secure cookies. Email/password sign-up is disabled in the web runtime, and login failures remain generic. The one-time bootstrap script temporarily enables the library's server-side sign-up API only after confirming that no other user exists.

`src/middleware.ts` resolves sessions only for workspace surfaces. It redirects unauthenticated private pages and returns `401` for private mutation endpoints. The login endpoint is same-origin, payload-limited, and protected by Better Auth's explicit rate limit. Logout invalidates the server session.

The route test now covers login, logout, private guards, origin and validation rejection, public fallback, archive recovery, and backup. [operations.md](./operations.md) records secret-rotation and account-recovery boundaries. A second factor remains a later product decision.

## Route map

Current public content routes remain prerendered where practical. The homepage, Search, and content pages run on demand so public site settings and database content update without rebuilding. The 404 page remains prerendered. Console and auth routes run only on the server. See [console-routes.md](./console-routes.md) for the complete access map.

## Migration from static to SSR

Phase 11 selected an integrated standalone Astro Node service:

1. `@astrojs/node` runs in standalone mode.
2. Robots and 404 continue to prerender; project, note, Lab, and search pages run on demand. RSS is generated at request time.
3. Pagefind indexes `dist/client` for static content; live project results use a public search endpoint.
4. The homepage, workspace pages, and server endpoints render per request.
5. Docker runs Node and persists `/app/data` for Now and project records.

Project, Note, and Lab source selection supports per-slug MDX/database cutover when matching MDX files exist. The original starter MDX files have been removed.

## Security rules

- Never rely on an unlinked or secret route as access control.
- Enforce authentication at server entry points; client navigation is not a guard.
- Keep auth secrets, database URLs, password inputs, and session tokens out of client code and logs.
- Disable public registration and refuse a second bootstrap account.
- Use HTTP-only sessions, secure production cookies, same-origin mutation checks, conservative errors, and request-size limits.
- Exclude workspace pages from Pagefind and the sitemap and mark them `noindex`; treat those only as crawler controls.
- Keep unpublished status, hidden/archived adopted projects, and all MDX drafts out of public queries.
- Validate and normalize all input before persistence.
- Keep audit records and tested backup/restore in place before adding more editors.
- Never store application secrets in `site_settings` or content tables.

## Deployment implications

The chosen setup is one long-running Node server with a persistent SQLite volume. It needs runtime secret injection, migration execution, TLS termination, and health monitoring. Docker applies committed migrations at startup and runs as the unprivileged `node` user with a read-only root filesystem plus the database volume.

Production must provide a random `AUTH_SECRET`, `DATABASE_URL`, and a browser-visible `PUBLIC_SITE_URL`/`AUTH_TRUSTED_ORIGIN`. Follow [operations.md](./operations.md) for backup and restore; schedule off-host copies before depending on console edits.

## Phase 13 baseline

This phase records the existing content and import boundaries in [content-inventory.md](./content-inventory.md), tests the private edit path, writes audit events with mutations, adds archive recovery, and provides backup/restore tooling for volume-backed SQLite. The next content area remains file-backed until its schema, preview, and cutover checks are designed.

The database-aware readiness endpoint and reviewed one-owner password recovery command are implemented in Phases 22 and 23. Phase 24 provides the encrypted off-host backup job and a daily systemd timer template; the host must still be configured with an rclone remote, an age recipient, and storage-side retention.

## Phase 14 project authoring

The workspace now lives at `/user`. Projects have full metadata and an optional Markdown case study, with formatting controls and a private preview. Visible database-only projects without a body render an overview; adding a body enables the full case study at the same canonical URL. The import refuses slug conflicts, backs up before writing, and keeps MDX files. Public project pages, search, and the project sitemap follow the chosen source at request time. Visible replacements for matching MDX still require a case-study body. See [project-publishing.md](./project-publishing.md).

## Phase 15 Notes authoring

Notes now have a protected editor, Markdown preview, draft/publish state, and explicit database source selection. Existing MDX entries can be imported with a verified backup and remain the active source until switched. Public archives, detail pages, search, RSS, and sitemap read only published notes. See [note-publishing.md](./note-publishing.md).

## Phase 16 Lab authoring

Lab entries now have a protected editor for status, visibility, experiment metadata, lessons, and Markdown body. The dry-run importer backs up before writing and keeps MDX selected until a deliberate source switch. Public archives, detail pages, search, and sitemap use the current visible catalog. See [lab-publishing.md](./lab-publishing.md).

## Phase 17 content revisions

Now, Projects, Notes, Lab, and homepage settings saves write full snapshots in their mutation transaction. The editors show the 50 most recent versions and can restore one as a new current version. Restore verifies the revision belongs to the requested record, checks slug uniqueness where relevant, and writes both revision and audit entries atomically. See [revision-history.md](./revision-history.md).

## Phase 18 project media

Project editors accept static JPEG, PNG, or WebP uploads up to 8 MB. The server validates decoded image format and pixel count, applies orientation, resizes to a 2000-pixel bound, converts to WebP, and stores files as BLOBs in SQLite (maximum 2 MB after conversion). Authenticated, same-origin upload requests create audit records; public delivery uses immutable, nosniff WebP responses. Project cards and detail pages render selected covers. Since images share the content database, the existing verified SQLite backup includes them. No media deletion is exposed, so revision history and old content cannot lose referenced files.

### Slug redirect policy

Edits to a published database-backed Project, Note, or Lab slug create a historical redirect in the same transaction as the content update. Public routes return a noncached HTTP 302 only while the recorded owner is present in that collection's public catalog at the stored canonical destination. Hidden, unpublished, archived, missing, or otherwise inactive owners receive a noncached 404; their redirect rows remain stored so an eligible alias works again after republication. Destinations are restricted to canonical local paths in the same collection. A source can have one destination; changing a slug flattens prior aliases to the newest URL, and checks prevent cycles and redirects owned by another record from being reclaimed. Redirected source URLs are omitted from public catalogs, search, feeds, and sitemaps. MDX entries remain read-only; changing a database record that replaces an MDX entry follows the explicit source-selection rules in each publishing guide. Older clients may retain previously cached permanent 308 responses until those client or intermediary caches expire or are cleared; the server cannot revoke redirects already cached by clients.

## Phase 19 homepage settings

`/user/homepage` edits the homepage introduction, portrait, About copy and focus labels, section copy and visibility, preview counts, and stack groups. GitHub activity loads from the configured public profile. The public page keeps its fixed bento layout and uses source defaults when the settings row is absent or SQLite is unavailable. Saves are validated, audited, revisioned, and restorable through the existing history panel.

## Open questions

- Which host will provide TLS, secret management, and rollback support for the persistent volume?
- What backup retention and restore-test schedule is appropriate?
- Is password-only owner authentication sufficient, or should a second factor be required?
- How will draft previews and future media remain authenticated, private, validated, and backed up?

## Phase 20 slug redirects

Published database-backed Projects, Notes, and Lab entries can change slugs safely. The content mutation, redirect update, revision, and audit event commit together. Public detail routes issue HTTP 308 redirects, aliases point directly to the current canonical URL, and redirected URLs are omitted from catalogs and generated indexes. Restore history applies the same redirect rules when a public slug changes. Drafts and source-controlled MDX entries do not create redirects.

## Phase 21 public site settings

`/user/settings` edits the public site name, author name, default SEO description, GitHub profile, and email link. Updates appear in shared page metadata, the homepage contact links, footer, Search page title, and RSS title on server-rendered routes. Prerendered 404 metadata remains a build-time snapshot. Saves are same-origin and authenticated, validated against explicit field rules, and write an audit entry and revision in one transaction. The 50 most recent settings revisions can be restored. The canonical domain, social image, authentication configuration, and database credentials remain deployment or source configuration.

Public archive and detail titles for Projects, Notes, and Lab use the configured author name, consistent with Blog, Search, and Credentials. The site name is used for shared social branding and RSS link labels; the author name remains the page-title suffix and public author metadata. Empty or whitespace-only legacy settings fall back to the source defaults. Biography, résumé filename and content, credentials, and authored content remain independently maintained rather than derived from these identity settings.

## Phase 22 database readiness

`/health/ready` returns 200 only when SQLite answers a probe and its latest applied Drizzle migration matches the migration journal shipped with the running build. It returns a generic 503 otherwise and never runs migrations or includes database details in its response. The Docker health check now uses this endpoint instead of the public homepage.

## Phase 23 one-owner password recovery

`pnpm console:recover` is an interactive, host-only command. It requires the exact email of the sole existing owner, takes the new password through a hidden terminal prompt, uses Better Auth password hashing and its internal adapter, revokes all current sessions, and writes an audit event. It exposes no public recovery route and refuses ambiguous or non-credential account state.

## Phase 24 encrypted off-host backups

The opt-in Compose `backup` profile creates a consistent, verified SQLite snapshot, encrypts it with `age`, uploads it with `rclone`, and checks the remote size. A daily systemd timer template invokes the one-shot container. Remote credentials are mounted only into this job. Host-specific setup, a public age recipient, a protected rclone config, storage-side retention, and periodic restore rehearsals are documented in [operations.md](./operations.md).

## Phase 25 Blog publishing

The Blog is a separate database-backed writing area for long-form articles. `/user/blog` supports Markdown drafting and preview, publish/unpublish, archive, saved-version restore, and safe slug redirects. Public posts appear in `/blog`, search, `/blog/rss.xml`, and `/sitemap-blog.xml`; drafts and archived posts are excluded. Notes remain the short-form learning archive and Lab remains the experiment journal. Details are in [blog-publishing.md](./blog-publishing.md).

# Authoring workflow

Project, Blog, Notes, and Lab editors keep essential identifying fields and the
Markdown body visible, with optional metadata grouped in native expandable
sections. The **Insert starter** action is explicit and asks before replacing
nonempty Markdown. **Preview Markdown** renders only the article body;
**Preview Page** renders current unsaved form values in a private dialog. The
page preview requires an authenticated owner session and trusted same-origin
request, does not persist content, and returns uncached sanitized Markdown.

Editors warn before leaving with unsaved changes. Saves still use the existing
authenticated publishing endpoints and server-side validators. With JavaScript
enabled, validation failures stay in the editor so entered text and media
references remain available; successful saves follow the server's existing
redirect and notice flow. Publication checkboxes retain each collection's
existing meaning.
