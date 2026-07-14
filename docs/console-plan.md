# Private Console Plan

## Purpose

`/console` is Angellie's private control panel for maintaining public portfolio content. Phase 12 extends the proven owner/auth/database architecture with **Projects Manager** while Astro remains the main framework.

## Phase 12 scope and non-goals

Implemented now:

- Standalone Astro Node SSR for request-time sessions and data
- Better Auth email/password authentication with public sign-up disabled
- Drizzle over a local SQLite database through libSQL
- One-time, single-owner command-line bootstrap
- Server-guarded `/console` overview and Now editor
- Origin-checked, authenticated Now Status mutation
- Database-backed homepage status with a static fallback
- Protected project list, create, edit, visibility/featured toggles, and archive
- Database-first public project cards with an explicit MDX fallback
- Safe detail linking only when an existing visible MDX slug matches

Still out of scope:

- Notes, Lab, stack, homepage-card, or settings editors
- Public registration, OAuth, multiple administrators, or email delivery
- File/MDX mutation, rich-text/MDX execution, media uploads, hard delete, or a general CMS
- Turso deployment, content migration, audit logging, automated backups, or recovery UI

## Console sections

| Section        | Phase 12 state | Intended responsibility                                        |
| -------------- | -------------- | -------------------------------------------------------------- |
| Overview       | Implemented    | Identify the signed-in owner and available modules.            |
| Now Status     | Implemented    | Edit focus, work, learning, tools, note, and publish state.    |
| Projects       | Implemented    | Manage metadata, visibility, priority, links, and archive.     |
| Notes          | Planned        | Draft, preview, publish, and revise writing.                   |
| Lab            | Planned        | Manage experiment status, visibility, observations, and links. |
| Stack          | Planned        | Maintain ordered tool groups.                                  |
| Homepage Cards | Planned        | Configure the existing bounded dashboard layout.               |
| Settings       | Planned        | Maintain allow-listed public settings only.                    |

The console should stay a compact terminal-minded control panel, not grow into a generic SaaS dashboard.

## Current data model

The committed Drizzle schema contains Better Auth's `user`, `session`, `account`, and `verification` tables plus `now_status` and `project_records`. The singleton Now row uses the stable ID `primary`; a `published` flag gates its public query. Project records use opaque IDs, unique slugs, validated JSON stack/link arrays, explicit visibility/featured/archive flags, and timestamps.

Project MDX remains a read-only public fallback and the only Phase 12 detail source. DB-only records appear as cards without broken local links; stored body text is not executed. Notes and Lab entries remain entirely MDX-backed Astro Content Collections. Model and migration boundaries are recorded in [data-model.md](./data-model.md).

## Authentication plan and current behavior

Better Auth owns password hashing and HTTP-only database sessions. Production enables secure cookies. Email/password sign-up is disabled in the web runtime, and login failures remain generic. The one-time bootstrap script temporarily enables the library's server-side sign-up API only after confirming that no other user exists.

`src/middleware.ts` resolves sessions only for console surfaces. It redirects unauthenticated private pages and returns `401` for private mutation endpoints. The login endpoint is same-origin, payload-limited, and protected by Better Auth's explicit rate limit. Logout invalidates the server session.

Phase 13 should add recovery and secret-rotation procedures, session/guard integration tests, and decide whether passkeys or a second factor are required.

## Route map

Current public content routes remain prerendered where practical. The homepage runs on demand because it reads the published Now row. Console and auth routes run only on the server. See [console-routes.md](./console-routes.md) for the complete access map.

## Migration from static to SSR

Phase 11 selected an integrated standalone Astro Node service:

1. `@astrojs/node` runs in standalone mode.
2. Project details, Notes/Lab collection pages, RSS, robots, search, and 404 continue to prerender; the public project index runs on demand.
3. Pagefind indexes `dist/client`, where the Node adapter serves static assets.
4. The homepage, console pages, and server endpoints render per request.
5. Docker runs Node and persists `/app/data` for Now and project records.

This choice is reversible at the content layer because projects, notes, and Lab were not migrated to the database.

## Security rules

- Never rely on an unlinked or secret route as access control.
- Enforce authentication at server entry points; client navigation is not a guard.
- Keep auth secrets, database URLs, password inputs, and session tokens out of client code and logs.
- Disable public registration and refuse a second bootstrap account.
- Use HTTP-only sessions, secure production cookies, same-origin mutation checks, conservative errors, and request-size limits.
- Exclude console pages from Pagefind and the sitemap and mark them `noindex`; treat those only as crawler controls.
- Keep unpublished status, hidden/archived database projects, and all MDX drafts out of public queries.
- Validate and normalize all input before persistence.
- Add append-only audit records and tested backup/restore before adding more editors.
- Never store application secrets in `site_settings` or content tables.

## Deployment implications

The application now requires a long-running Node process, runtime secret injection, persistent `/app/data`, migration execution, TLS termination, and health monitoring. Docker applies committed migrations at startup and runs as the unprivileged `node` user with a read-only root filesystem plus the database volume.

Production must provide a random `AUTH_SECRET`, `DATABASE_URL`, and a browser-visible `PUBLIC_SITE_URL`/`AUTH_TRUSTED_ORIGIN`. A static-only hosting provider is no longer sufficient. Back up the SQLite volume before depending on console edits.

## Phase 13 MVP recommendation

Harden this slice before expanding it:

1. Add integration tests for login, logout, redirect guards, unauthorized project APIs, origin rejection, validation, archive behavior, and both public fallbacks.
2. Add append-only `audit_log` entries for Now and project mutations.
3. Document and test SQLite backup and restore, including Docker volume recovery.
4. Document auth-secret rotation and owner account recovery.
5. Decide whether production remains volume-backed SQLite or moves to Turso/libSQL.
6. Add a health/readiness split that can report migration or database failure without leaking details.
7. Define import/conflict handling and archive recovery before treating database projects as the only source.
8. Keep every other content area file-backed until these controls are proven.

## Open questions

- Which host will provide persistent storage, TLS, secret management, and rollback support?
- Is volume-backed SQLite sufficient, or should production use Turso/libSQL?
- What backup retention and restore-test schedule is appropriate?
- Is password-only owner authentication sufficient, or should a second factor be required?
- Should future publishing query the database directly, generate MDX, or trigger a static rebuild?
- How will draft previews and future media remain authenticated, private, validated, and backed up?
