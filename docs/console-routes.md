# Future Console Route Map

This document is a plan, not an implemented API contract. In Phase 10 the application remains static. The only `/console` output is a noindex planning placeholder; no login, private page, API mutation route, or server action exists.

## Current public routes

| Route                | Rendering                   | Access                              |
| -------------------- | --------------------------- | ----------------------------------- |
| `/`                  | Static                      | Public                              |
| `/projects`          | Static                      | Public visible projects only        |
| `/projects/[slug]`   | Static                      | Public visible project entries only |
| `/notes`             | Static                      | Published notes only                |
| `/notes/[slug]`      | Static                      | Published note entries only         |
| `/lab`               | Static                      | Public visible Lab entries only     |
| `/lab/[slug]`        | Static                      | Public visible Lab entries only     |
| `/search`            | Static plus Pagefind island | Public indexed content only         |
| `/rss.xml`           | Static endpoint             | Published notes only                |
| `/robots.txt`        | Static endpoint             | Public crawler policy               |
| `/sitemap-index.xml` | Build-generated             | Public route discovery              |
| `/404.html`          | Static                      | Public recovery page                |

The static `/console` placeholder is intentionally excluded from Pagefind and the sitemap and carries `noindex, nofollow`. Those measures are crawler controls, not access controls.

## Future private page routes

Every route in this table is future work and must be guarded on the server before it reads private data.

| Route                    | Purpose                                                                      |
| ------------------------ | ---------------------------------------------------------------------------- |
| `/console`               | Authenticated entry point; redirect to login or overview as appropriate.     |
| `/console/login`         | Owner login. No public registration.                                         |
| `/console/overview`      | Publishing state, recent audited changes, and operational notices.           |
| `/console/now`           | Edit current status data.                                                    |
| `/console/projects`      | List project drafts and public entries.                                      |
| `/console/projects/new`  | Create an unpublished project draft.                                         |
| `/console/projects/[id]` | Edit one project by stable ID.                                               |
| `/console/notes`         | List note drafts and published notes.                                        |
| `/console/notes/new`     | Create an unpublished note draft.                                            |
| `/console/notes/[id]`    | Edit one note by stable ID.                                                  |
| `/console/lab`           | List hidden and visible Lab entries.                                         |
| `/console/lab/new`       | Create a hidden Lab draft.                                                   |
| `/console/lab/[id]`      | Edit one Lab entry by stable ID.                                             |
| `/console/stack`         | Maintain ordered stack/tool groups.                                          |
| `/console/homepage`      | Maintain enabled state, order, and bounded configuration for homepage cards. |
| `/console/settings`      | Maintain allow-listed public site settings.                                  |

Use opaque IDs for console edit routes. Slugs remain editable public identifiers and should not be treated as stable database keys.

## Future API or server-action routes

These endpoints are **not implemented in Phase 10**. The final architecture may use equivalent Astro server actions, but the same authorization, validation, CSRF, transaction, and audit requirements apply.

| Method and route                   | Intended operation                          |
| ---------------------------------- | ------------------------------------------- |
| `POST /api/console/now`            | Validate and update the current Now Status. |
| `POST /api/console/projects`       | Create a non-visible project draft.         |
| `PATCH /api/console/projects/[id]` | Update an existing project.                 |
| `POST /api/console/notes`          | Create an unpublished note draft.           |
| `PATCH /api/console/notes/[id]`    | Update an existing note.                    |
| `POST /api/console/lab`            | Create a hidden Lab draft.                  |
| `PATCH /api/console/lab/[id]`      | Update an existing Lab entry.               |
| `POST /api/console/homepage`       | Update bounded homepage card configuration. |
| `POST /api/console/settings`       | Update allow-listed public site settings.   |

Deletion is intentionally absent from the first route plan. Archive/visibility transitions and backup behavior should be proven before destructive operations are designed.

## Guard and response rules

- Guard every `/console` route except the future login route on the server.
- Guard every `/api/console/*` endpoint independently; a hidden button or client redirect is not authorization.
- Return `401` when authentication is missing and `403` when an authenticated actor lacks permission.
- Validate route parameters and request bodies before database access.
- Use transactions for content mutation plus audit logging where possible.
- Protect state-changing requests against CSRF and validate request origin as appropriate.
- Default new projects and Lab entries to hidden and new notes to unpublished.
- Never return drafts or private settings from public endpoints or static collection queries.
- Apply request size limits and a separate, explicit policy before accepting media uploads.
- Do not cache authenticated HTML or private API responses in public/CDN caches.
