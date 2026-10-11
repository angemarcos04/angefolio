# Console Route Map

The private workspace uses `/user`. Routes marked prerendered are emitted into `dist/client`; routes marked server run through the standalone Astro Node process.

## Current public routes

| Route                   | Rendering            | Access                                                             |
| ----------------------- | -------------------- | ------------------------------------------------------------------ |
| `/`                     | Server               | Public; published database Now row when available                  |
| `/projects`             | Server               | Public DB records or visible MDX fallback                          |
| `/projects/[slug]`      | Server               | Adopted database Markdown, visible MDX, or HTTP 308 slug redirect  |
| `/notes`                | Server               | Published MDX and selected database notes                          |
| `/notes/[slug]`         | Server               | Published note, selected source, or HTTP 308 redirect              |
| `/blog`                 | Server               | Published, unarchived database posts                               |
| `/blog/[slug]`          | Server               | Published post or HTTP 308 slug redirect                           |
| `/lab`                  | Server               | Visible MDX and selected database entries                          |
| `/lab/[slug]`           | Server               | Visible entry, selected source, or HTTP 308 redirect               |
| `/search`               | Server + island      | Public Pagefind index; settings title read at request time         |
| `/rss.xml`              | Server endpoint      | Published notes only                                               |
| `/blog/rss.xml`         | Server endpoint      | Published, unarchived blog posts                                   |
| `/robots.txt`           | Prerendered endpoint | Public crawler policy                                              |
| `/sitemap-index.xml`    | Build-generated      | Static public routes; workspace excluded                           |
| `/sitemap-projects.xml` | Server               | Current public project detail URLs                                 |
| `/sitemap-blog.xml`     | Server               | Current published blog detail URLs                                 |
| `/api/search/projects`  | Server               | Current public project search results                              |
| `/api/search/notes`     | Server               | Current public note search results                                 |
| `/api/search/blog`      | Server               | Current public blog search results                                 |
| `/api/search/lab`       | Server               | Current public Lab search results                                  |
| `/sitemap-notes.xml`    | Server               | Current published note detail URLs                                 |
| `/sitemap-lab.xml`      | Server               | Current visible Lab detail URLs                                    |
| `/404.html`             | Prerendered          | Public recovery page                                               |
| `/health/ready`         | Server endpoint      | Database and latest-migration readiness, no internal error details |

## Implemented console and auth routes

| Method           | Route                                        | Access                                                 | Purpose                                                  |
| ---------------- | -------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------- |
| GET              | `/user/login`                                | Public                                                 | Owner login form; redirects an active session to `/user` |
| GET              | `/user`                                      | Private                                                | Workspace overview                                       |
| GET              | `/user/now`                                  | Private                                                | Load the Now editor                                      |
| GET              | `/user/homepage`                             | Private                                                | Edit homepage copy, visibility, counts, and stack groups |
| `/user/settings` | Private                                      | Edit allow-listed public identity and contact settings |
| POST             | `/user/logout`                               | Private                                                | Invalidate the Better Auth session                       |
| ALL              | `/api/auth/[...all]`                         | Better Auth policy                                     | Session API; email sign-up is disabled in runtime config |
| POST             | `/api/console/login`                         | Public, same-origin                                    | Form bridge to Better Auth email sign-in                 |
| POST             | `/api/console/now`                           | Private, same-origin                                   | Validate and upsert Now Status                           |
| POST             | `/api/console/homepage`                      | Private, same-origin                                   | Save, audit, and revision homepage settings              |
| POST             | `/api/console/settings`                      | Private, same-origin                                   | Validate and save public site settings                   |
| GET              | `/user/projects`                             | Private                                                | List project records and actions                         |
| GET              | `/user/projects/new`                         | Private                                                | Create-project form                                      |
| GET              | `/user/projects/[id]`                        | Private                                                | Edit, preview, archive, or restore a project             |
| GET              | `/user/notes`                                | Private                                                | List database notes and publication state                |
| GET              | `/user/notes/new`                            | Private                                                | Create a note                                            |
| GET              | `/user/notes/[id]`                           | Private                                                | Edit, preview, publish, or select a note source          |
| GET              | `/user/blog`                                 | Private                                                | List blog posts and publication state                    |
| GET              | `/user/blog/new`                             | Private                                                | Create a blog post                                       |
| GET              | `/user/blog/[id]`                            | Private                                                | Edit, preview, publish, archive, or restore a post       |
| GET              | `/user/lab`                                  | Private                                                | List Lab records and visibility state                    |
| GET              | `/user/lab/new`                              | Private                                                | Create a Lab entry                                       |
| GET              | `/user/lab/[id]`                             | Private                                                | Edit writing, metadata, visibility, or source choice     |
| POST             | `/api/console/markdown-preview`              | Private, same-origin                                   | Render sanitized Markdown preview                        |
| POST             | `/api/console/projects/create`               | Private, same-origin                                   | Validate and create a project row                        |
| POST             | `/api/console/notes/save`                    | Private, same-origin                                   | Validate and create/update a note record                 |
| POST             | `/api/console/blog/save`                     | Private, same-origin                                   | Validate and create/update a blog post                   |
| POST             | `/api/console/lab/save`                      | Private, same-origin                                   | Validate and create/update a Lab record                  |
| POST             | `/api/console/revisions/restore`             | Private, same-origin                                   | Restore a prior saved content version                    |
| POST             | `/api/console/projects/[id]/update`          | Private, same-origin                                   | Validate and update project metadata                     |
| POST             | `/api/console/projects/[id]/archive`         | Private, same-origin                                   | Archive, hide, and unfeature a project                   |
| POST             | `/api/console/projects/[id]/restore`         | Private, same-origin                                   | Restore an archive as a private draft                    |
| POST             | `/api/console/projects/[id]/toggle-visible`  | Private, same-origin                                   | Toggle visibility when active                            |
| POST             | `/api/console/projects/[id]/toggle-featured` | Private, same-origin                                   | Toggle ordering priority when active                     |

Only `/user/login` is a public workspace page. Auth endpoints necessarily accept unauthenticated sign-in/session requests, but Better Auth rejects sign-up and middleware guards every mutation.

## Planned private routes

- `/user/stack` remains a possible future editor if stack groups need to be managed outside the homepage settings page.

Hard delete is not implemented.

## Guard and response rules

- Middleware guards every `/user` path except login and every `/api/console/*` route except the login bridge.
- Private pages redirect missing sessions to `/user/login`; private APIs return `401`.
- Console infrastructure failures return a conservative `503` or login notice without SQL/configuration details.
- Mutation endpoints repeat the authentication check, reject untrusted origins and oversized forms, and validate every field.
- Login failures do not reveal whether an account exists.
- Console HTML is `noindex`, Pagefind-excluded, absent from public navigation, and filtered from the sitemap.
- Authenticated HTML and private API responses must not be placed in public caches.
