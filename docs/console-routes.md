# Console Route Map

Phase 12 extends the authenticated server boundary with project record management. Routes marked prerendered are emitted into `dist/client`; routes marked server run through the standalone Astro Node process.

## Current public routes

| Route                | Rendering            | Access                                                |
| -------------------- | -------------------- | ----------------------------------------------------- |
| `/`                  | Server               | Public; published database Now row or static fallback |
| `/projects`          | Server               | Public DB records or visible MDX fallback             |
| `/projects/[slug]`   | Prerendered          | Existing visible MDX detail pages only                |
| `/notes`             | Prerendered          | Published notes only                                  |
| `/notes/[slug]`      | Prerendered          | Published note entries only                           |
| `/lab`               | Prerendered          | Public visible Lab entries only                       |
| `/lab/[slug]`        | Prerendered          | Public visible Lab entries only                       |
| `/search`            | Prerendered + island | Public Pagefind index only                            |
| `/rss.xml`           | Prerendered endpoint | Published notes only                                  |
| `/robots.txt`        | Prerendered endpoint | Public crawler policy                                 |
| `/sitemap-index.xml` | Build-generated      | Public route discovery; console excluded              |
| `/404.html`          | Prerendered          | Public recovery page                                  |

## Implemented console and auth routes

| Method | Route                                        | Access               | Purpose                                                     |
| ------ | -------------------------------------------- | -------------------- | ----------------------------------------------------------- |
| GET    | `/console/login`                             | Public               | Owner login form; redirects an active session to `/console` |
| GET    | `/console`                                   | Private              | Minimal overview and signed-in identity                     |
| GET    | `/console/now`                               | Private              | Load the singleton Now Status editor                        |
| POST   | `/console/logout`                            | Private              | Invalidate the Better Auth session and redirect to login    |
| ALL    | `/api/auth/[...all]`                         | Better Auth policy   | Session API; email sign-up is disabled in runtime config    |
| POST   | `/api/console/login`                         | Public, same-origin  | Form bridge to Better Auth email sign-in                    |
| POST   | `/api/console/now`                           | Private, same-origin | Validate and upsert Now Status                              |
| GET    | `/console/projects`                          | Private              | List DB project records and safe quick actions              |
| GET    | `/console/projects/new`                      | Private              | Create-project form                                         |
| GET    | `/console/projects/[id]`                     | Private              | Edit/archive form for one project                           |
| POST   | `/api/console/projects/create`               | Private, same-origin | Validate and create a project row                           |
| POST   | `/api/console/projects/[id]/update`          | Private, same-origin | Validate and update project metadata                        |
| POST   | `/api/console/projects/[id]/archive`         | Private, same-origin | Archive, hide, and unfeature a project                      |
| POST   | `/api/console/projects/[id]/toggle-visible`  | Private, same-origin | Toggle visibility when active                               |
| POST   | `/api/console/projects/[id]/toggle-featured` | Private, same-origin | Toggle ordering priority when active                        |

Only `/console/login` is a public console page. Auth endpoints necessarily accept unauthenticated sign-in/session requests, but Better Auth rejects sign-up and middleware guards every console mutation.

## Planned private routes

These routes are not implemented:

- `/console/overview`
- `/console/notes`, `/console/notes/new`, `/console/notes/[id]`
- `/console/lab`, `/console/lab/new`, `/console/lab/[id]`
- `/console/stack`
- `/console/homepage`
- `/console/settings`

Note, Lab, homepage, and settings write endpoints remain future work. Project hard delete and unarchive are not implemented; archive recovery, auditing, and backups must be designed first.

## Guard and response rules

- Middleware guards every `/console` path except login and every `/api/console/*` route except the login bridge.
- Private pages redirect missing sessions to `/console/login`; private APIs return `401`.
- Console infrastructure failures return a conservative `503` or login notice without SQL/configuration details.
- Mutation endpoints repeat the authentication check, reject untrusted origins and oversized forms, and validate every field.
- Login failures do not reveal whether an account exists.
- Console HTML is `noindex`, Pagefind-excluded, absent from public navigation, and filtered from the sitemap.
- Authenticated HTML and private API responses must not be placed in public caches.
