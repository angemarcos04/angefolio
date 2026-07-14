# Private Console Plan

## Purpose

`/console` is Angellie's private control panel for maintaining public portfolio content. Phase 11 proves the architecture with one owner account and one editable **Now Status** while Astro remains the main framework.

## Phase 11 scope and non-goals

Implemented now:

- Standalone Astro Node SSR for request-time sessions and data
- Better Auth email/password authentication with public sign-up disabled
- Drizzle over a local SQLite database through libSQL
- One-time, single-owner command-line bootstrap
- Server-guarded `/console` overview and Now editor
- Origin-checked, authenticated Now Status mutation
- Database-backed homepage status with a static fallback

Still out of scope:

- Projects, notes, Lab, stack, homepage-card, or settings editors
- Public registration, OAuth, multiple administrators, or email delivery
- File/MDX mutation, media uploads, delete endpoints, or a general CMS
- Turso deployment, content migration, audit logging, automated backups, or recovery UI

## Console sections

| Section        | Phase 11 state | Intended responsibility                                        |
| -------------- | -------------- | -------------------------------------------------------------- |
| Overview       | Implemented    | Identify the signed-in owner and available module.             |
| Now Status     | Implemented    | Edit focus, work, learning, tools, note, and publish state.    |
| Projects       | Planned        | Manage project drafts, metadata, visibility, and case studies. |
| Notes          | Planned        | Draft, preview, publish, and revise writing.                   |
| Lab            | Planned        | Manage experiment status, visibility, observations, and links. |
| Stack          | Planned        | Maintain ordered tool groups.                                  |
| Homepage Cards | Planned        | Configure the existing bounded dashboard layout.               |
| Settings       | Planned        | Maintain allow-listed public settings only.                    |

The console should stay a compact terminal-minded control panel, not grow into a generic SaaS dashboard.

## Current data model

The committed Drizzle schema contains only Better Auth's `user`, `session`, `account`, and `verification` tables plus `now_status`. The singleton Now row uses the stable ID `primary`; list fields are validated arrays stored as SQLite JSON text. A `published` flag gates the public query.

Projects, notes, and Lab entries remain MDX-backed Astro Content Collections. Future table sketches and migration boundaries are recorded in [data-model.md](./data-model.md).

## Authentication plan and current behavior

Better Auth owns password hashing and HTTP-only database sessions. Production enables secure cookies. Email/password sign-up is disabled in the web runtime, and login failures remain generic. The one-time bootstrap script temporarily enables the library's server-side sign-up API only after confirming that no other user exists.

`src/middleware.ts` resolves sessions only for console surfaces. It redirects unauthenticated private pages and returns `401` for private mutation endpoints. The login endpoint is same-origin, payload-limited, and protected by Better Auth's explicit rate limit. Logout invalidates the server session.

Phase 12 should add recovery and secret-rotation procedures, session/guard integration tests, and decide whether passkeys or a second factor are required.

## Route map

Current public content routes remain prerendered where practical. The homepage runs on demand because it reads the published Now row. Console and auth routes run only on the server. See [console-routes.md](./console-routes.md) for the complete access map.

## Migration from static to SSR

Phase 11 selected an integrated standalone Astro Node service:

1. `@astrojs/node` runs in standalone mode.
2. Public collection/detail pages, RSS, robots, search, and 404 continue to prerender.
3. Pagefind indexes `dist/client`, where the Node adapter serves static assets.
4. The homepage, console pages, and server endpoints render per request.
5. Docker now runs Node and persists `/app/data` instead of serving all output from Nginx.

This choice is reversible at the content layer because projects, notes, and Lab were not migrated to the database.

## Security rules

- Never rely on an unlinked or secret route as access control.
- Enforce authentication at server entry points; client navigation is not a guard.
- Keep auth secrets, database URLs, password inputs, and session tokens out of client code and logs.
- Disable public registration and refuse a second bootstrap account.
- Use HTTP-only sessions, secure production cookies, same-origin mutation checks, conservative errors, and request-size limits.
- Exclude console pages from Pagefind and the sitemap and mark them `noindex`; treat those only as crawler controls.
- Keep unpublished database status and all MDX drafts out of public queries.
- Validate and normalize all input before persistence.
- Add append-only audit records and tested backup/restore before adding more editors.
- Never store application secrets in `site_settings` or content tables.

## Deployment implications

The application now requires a long-running Node process, runtime secret injection, persistent `/app/data`, migration execution, TLS termination, and health monitoring. Docker applies committed migrations at startup and runs as the unprivileged `node` user with a read-only root filesystem plus the database volume.

Production must provide a random `AUTH_SECRET`, `DATABASE_URL`, and a browser-visible `PUBLIC_SITE_URL`/`AUTH_TRUSTED_ORIGIN`. A static-only hosting provider is no longer sufficient. Back up the SQLite volume before depending on console edits.

## Phase 12 MVP recommendation

Harden this slice before expanding it:

1. Add integration tests for login, logout, redirect guards, unauthorized API access, origin rejection, validation, and homepage fallback.
2. Add append-only `audit_log` entries for Now mutations.
3. Document and test SQLite backup and restore, including Docker volume recovery.
4. Document auth-secret rotation and owner account recovery.
5. Decide whether production remains volume-backed SQLite or moves to Turso/libSQL.
6. Add a health/readiness split that can report migration or database failure without leaking details.
7. Keep every other content area file-backed until these controls are proven.

## Open questions

- Which host will provide persistent storage, TLS, secret management, and rollback support?
- Is volume-backed SQLite sufficient, or should production use Turso/libSQL?
- What backup retention and restore-test schedule is appropriate?
- Is password-only owner authentication sufficient, or should a second factor be required?
- Should future publishing query the database directly, generate MDX, or trigger a static rebuild?
- How will draft previews and future media remain authenticated, private, validated, and backed up?
