# Private Console Plan

## Purpose

`/console` is planned as Angellie's private control panel for maintaining the public portfolio: current status, featured work, writing drafts, Lab entries, stack/tool groups, homepage card visibility, and site settings. The console should keep Astro as the main framework and use small Svelte islands only when focused browser interaction is useful.

Phase 10 records the intended boundaries before the project adopts a server runtime or stores private data. The public site remains a statically generated Astro application, and its content remains source-controlled MDX and TypeScript data.

## Non-goals for Phase 10

- No real login, session, cookie, or route guard
- No database, ORM, migration, or database connection
- No CMS editor or content-editing form
- No file or database mutation
- No API write route, server action, or webhook
- No Better Auth or Drizzle installation
- No Astro Node adapter or SSR migration
- No claim that the static `/console` placeholder is private or secure

## Future console sections

| Section        | Intended responsibility                                                                       |
| -------------- | --------------------------------------------------------------------------------------------- |
| Overview       | Show publishing state, recent changes, and system health without exposing secrets.            |
| Now Status     | Maintain current focus, active work, learning, tools, and an optional short status.           |
| Projects       | Create drafts and manage project metadata, case-study bodies, visibility, and featured state. |
| Notes          | Draft, preview, publish, and revise technical notes.                                          |
| Lab            | Maintain experiment entries, status, visibility, observations, and links.                     |
| Stack          | Maintain ordered tool groups used by the homepage.                                            |
| Homepage Cards | Enable, disable, order, and configure the existing eight dashboard cards.                     |
| Settings       | Maintain explicitly supported public site metadata and publishing settings.                   |

The eventual UI should feel like a compact terminal-minded control panel, not a generic SaaS administration template. The first useful version does not need dashboards full of invented metrics.

## Future data model

The first database-backed design is expected to include:

- `now_status`
- `projects`
- `notes`
- `lab_entries`
- `stack_groups`
- `homepage_cards`
- `site_settings`
- `audit_log`

SQLite is the preferred local starting point, with Drizzle as the typed schema/query layer. Turso/libSQL is a possible later production target if its operational model fits the chosen host. The schema sketches and file-to-database migration concerns are documented in [data-model.md](./data-model.md).

Current Phase 10 content is still file-based. Database records must not become a second source of truth until Phase 11 defines and tests a deliberate migration or synchronization boundary.

## Future authentication plan

Better Auth is the planned candidate, not an installed dependency. Phase 11 should validate its current Astro integration and deployment requirements before adoption.

The minimum authentication design should include:

1. A single explicitly provisioned owner account; no public registration.
2. Password hashing and account/session storage managed through the chosen server-side auth integration.
3. Secure, `HttpOnly`, `SameSite` session cookies with `Secure` enabled in production.
4. Server-side guards on every `/console` page and every mutation endpoint.
5. CSRF protection for state-changing requests and origin validation where appropriate.
6. Login throttling and generic failure messages that do not reveal account existence.
7. Session invalidation, secret rotation, and a documented account-recovery process.

The login route is not the security boundary. Authorization must be checked again at every server entry point that reads drafts or changes content.

## Future route map

The public route set stays static. Future private routes live under `/console`, with future mutations under `/api/console` or an equivalently guarded server-action boundary. The detailed inventory, methods, and access expectations are in [console-routes.md](./console-routes.md).

Phase 10 implements only a static `/console` planning notice. It provides no login, private data, or mutation capability.

## Future migration from static to SSR

The migration should be a separate, reversible phase:

1. Confirm hosting support, backup requirements, auth integration, and the SQLite versus Turso/libSQL decision.
2. Add the Astro Node adapter and server output only after those decisions are recorded.
3. Keep public pages prerendered where practical so the portfolio retains static performance and failure isolation.
4. Make `/console` and its authenticated server endpoints request-time rendered.
5. Replace the Nginx-only runtime with a Node application runtime, optionally keeping Nginx or the hosting platform in front for TLS and static assets.
6. Add health checks that cover the Node process and, separately, database readiness.
7. Migrate content in a tested one-way import or explicitly designed synchronization workflow; never silently merge two sources of truth.

An alternative worth evaluating is a separate private console service that publishes validated content for the static public site. That would keep the public runtime simpler, but it introduces a deployment and publishing boundary that must be secured and backed up.

## Security rules

- Never rely on an unlinked or secret route as access control.
- Require real authentication and authorization.
- Enforce route guards on the server, not only in client-side navigation.
- Use secure session cookies and short, intentional session lifetimes.
- Keep auth secrets and database URLs in server environment variables.
- Never expose auth secrets, database credentials, or privileged data in client bundles.
- Exclude drafts, hidden entries, and private settings from every public query by default.
- Validate and normalize all input on the server before persistence.
- Protect state-changing requests against CSRF and unauthorized replay.
- Record meaningful mutations in `audit_log` without logging secrets or full sensitive payloads.
- Add tested backups and restore instructions before console-based editing is enabled.
- Escape or sanitize authored output according to its rendering context.
- Return conservative errors; do not expose stack traces, SQL, or configuration in production.

## Deployment implications

Phase 10 does not change deployment: Astro builds static files and Nginx serves them. The commented future environment names in `.env.example` are unused.

A real console will require a long-running server runtime, persistent storage, secret injection, TLS, database migrations, backups, monitoring, and a deployment process that can roll back application and schema changes safely. The current read-only Nginx container cannot host authentication or database-backed routes and should not be made writable as a shortcut.

## Phase 11 MVP recommendation

Build one authenticated, end-to-end vertical slice for **Now Status** before attempting a full CMS:

1. Write an architecture decision record for integrated SSR versus a separate console service.
2. Add the Node adapter and a development SQLite database in that isolated phase.
3. Integrate Better Auth for one owner account with server-side guards.
4. Define `now_status` and `audit_log` with Drizzle migrations.
5. Implement read, validate, update, and audit behavior for Now Status only.
6. Keep projects, notes, Lab, stack, homepage cards, and settings file-backed.
7. Add authorization, CSRF, backup/restore, migration, and end-to-end tests before deployment.

This slice is small enough to test the runtime and security model without prematurely migrating all public content.

## Open questions

- Should the private console share the public Astro deployment or run as a separate service?
- Which host will provide persistent storage, TLS, secret management, and rollback support?
- Is local SQLite with a production Turso/libSQL replica the right operational tradeoff?
- Should console publishing update database-backed public queries, generate MDX, or trigger a static rebuild?
- How will image and other media uploads be stored, validated, and backed up?
- What is the backup retention and restore-testing schedule?
- Is password-only owner authentication sufficient, or should the MVP require passkeys or another second factor?
- Which settings are safe to expose to the public build, and which must remain server-only?
- How will draft previews remain authenticated and excluded from search, RSS, sitemap, and caches?
