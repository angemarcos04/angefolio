# angefolio

The personal developer portfolio of **Angellie Marcos**, an Information Technology student building practical web systems with a Linux-minded, creative edge.

The authenticated workspace lives at `/user`, absent from public navigation. Better Auth and SQLite protect the Now, Projects, Notes, Blog, and Lab editors, with audit records and restorable snapshots. The starter Project, Note, and Lab entries have been cleared from source and the local database. The owner can write and publish new entries in `/user`; historical database backups remain available.

Published entries marked **Featured** can appear on the homepage. `/user/homepage` controls section visibility and how many featured entries to show for Projects, Notes, Blog, and Lab; a count of 0 shows all. Sections with no qualifying entries are hidden.

## Tech stack

- Astro with TypeScript and standalone Node SSR
- Svelte for interactive islands only
- Tailwind CSS v4
- MDX and Astro Content Collections
- Expressive Code
- Pagefind and Sharp
- Better Auth with email/password sessions
- Drizzle ORM with local SQLite through libSQL
- pnpm
- Docker

## Setup

Requirements: Node.js 22+ and pnpm through Corepack.

```bash
corepack enable
pnpm install
```

Start development:

```bash
cp .env.example .env
pnpm db:migrate
pnpm dev
```

Open `http://localhost:4321`. The private workspace is at `/user`.

Create the one allowed administrator once. Set `AUTH_SECRET` first; the command prompts for the email and a hidden password if `ADMIN_EMAIL` and `ADMIN_PASSWORD` are unset:

```bash
pnpm console:bootstrap
```

Remove any `ADMIN_` values afterward. Public sign-up is disabled, and the bootstrap refuses to add a second account.

Build the production server and search index:

```bash
pnpm build
pnpm start
```

`pnpm start` validates production auth/database configuration and launches `dist/server/entry.mjs`. `pnpm build` remains the standard build; its `postbuild` hook writes Pagefind into `dist/client/pagefind`. Use `pnpm build:search` for an explicit Astro-plus-Pagefind build or `pnpm index` to refresh an existing SSR client artifact. Run `pnpm db:migrate` after pulling a migration and before starting a non-container deployment; Docker applies committed migrations at startup.

Optional checks:

```bash
pnpm check
pnpm format:check
pnpm test:console # after pnpm build
```

## Docker

The production image uses three Node 22 Alpine stages: frozen dependency installation, Astro/Pagefind build, and the standalone Node runtime. Container startup applies committed Drizzle migrations before launching Astro. The server listens on port `4321`; the database lives at `/app/data/angefolio.db` on a named volume.

Build and run the image directly:

```bash
pnpm docker:build
pnpm docker:run
```

`pnpm docker:run` reads runtime values from an uncommitted `.env`, maps `4321:4321`, and mounts the `angefolio_data` volume.

Or build and run the `portfolio` Compose service:

```bash
docker compose up --build
```

Open `http://localhost:4321`. The private workspace is at `/user`. Stop it with `docker compose down`.

The container is named `angefolio`, maps `4321:4321`, and uses `unless-stopped`. Compose preserves the read-only root filesystem and `no-new-privileges`, adds a writable `/tmp`, and mounts `portfolio_data` only at `/app/data`. Set a real `AUTH_SECRET` and deployment origins in an uncommitted `.env` before `docker compose up --build`.

Bootstrap the owner inside the Compose environment once:

```bash
docker compose run --rm \
  -e ADMIN_EMAIL="you@example.com" \
  -e ADMIN_PASSWORD="use-a-long-random-password" \
  portfolio ./node_modules/.bin/tsx scripts/create-admin.ts
```

Do not place bootstrap credentials in `compose.yml` or leave them in `.env`.

Useful validation commands:

```bash
docker compose config
docker build -t angefolio:test .
docker inspect --format='{{json .State.Health}}' angefolio
```

The last command applies while the Compose service is running.

## Production build

The deployable artifact is the standalone Node server plus `dist/client`, committed migrations, and runtime dependencies. A static-only host is no longer sufficient for `/user`, live Now content, or database projects. Build with:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
pnpm build
```

The Docker build uses `pnpm build:search` so Pagefind output is present for static content. Robots and 404 remain prerendered. `/`, Projects, Notes, Lab, Search, RSS, `/health/ready`, `/user/*`, and content search/sitemap endpoints run on demand. `astro preview` remains an inspection tool; production uses the Node adapter entry point.

Expected public output includes project, note, and Lab indexes/details; `/search`; `/rss.xml`; `/robots.txt`; content sitemaps; and `/404.html`. Pagefind indexes prerendered HTML in `dist/client`; live content search comes from the project, note, and Lab search endpoints. The homepage remains server-rendered.

## Environment

Copy `.env.example` to `.env` locally. `AUTH_SECRET` is server-only and must be at least 32 random characters in production. `DATABASE_URL` defaults to `file:./data/angefolio.db` only in development. `PUBLIC_SITE_URL` and `AUTH_TRUSTED_ORIGIN` must match the browser-visible origin so Better Auth and the same-origin write checks agree.

`ADMIN_EMAIL` and `ADMIN_PASSWORD` are optional one-time inputs consumed only by `pnpm console:bootstrap`; the web application never reads them. The command prompts interactively when they are unset. Never prefix auth, database, or bootstrap values with `PUBLIC_`.

On Render, the public URL defaults to `RENDER_EXTERNAL_URL` at build and runtime. Set `PUBLIC_SITE_URL` to the final HTTPS origin when using a custom domain, then redeploy so canonical URLs, sitemap, robots metadata, and RSS use it. Inject authentication and database values only as server-side runtime secrets; never commit them or expose them through `PUBLIC_` variables.

## CI

`.github/workflows/ci.yml` validates pushes and pull requests targeting `main` on Node.js 22. It installs the frozen lockfile, runs Astro checks, verifies formatting, builds the SSR server and Pagefind client index, runs the isolated console test, and builds the production image. The test creates its own owner and temporary database; CI needs no deployed secret.

## Deployment notes

- For Render, review [the Render deployment guide](docs/render-deployment.md) and `render.yaml` before creating the paid web service and persistent disk. The Blueprint has automatic deploys disabled until you choose to enable them.
- Deploy the Node image to a host that supports a long-running process, container port `4321`, persistent volumes, runtime secrets, and health checks.
- Terminate HTTPS at the hosting platform or reverse proxy. Secure cookies are enabled automatically when `NODE_ENV=production`.
- Back up the SQLite volume with `node scripts/db-maintenance.mjs backup <new-file>`. Verify and rehearse restore using [operations.md](docs/operations.md). Configure the encrypted off-host job and daily systemd timer before depending on live edits.
- Run migrations before the new server receives traffic. The Docker command does this automatically.
- Notes and Lab publish through `/user`; archives, articles, search, and sitemaps update on request. RSS includes Notes only. Direct source MDX changes still need a rebuild.

## Production URL

Astro uses `PUBLIC_SITE_URL` when set, then Render's `RENDER_EXTERNAL_URL`, then the documented `https://angellie-marcos.dev` fallback for builds outside Render. Sitemap, RSS, canonical URLs, robots metadata, and social metadata need an absolute origin.

Set `PUBLIC_SITE_URL` to the real public origin for any non-Render deployment and when switching Render to a custom domain. `AUTH_TRUSTED_ORIGIN` can add other trusted browser origins if needed. These public origin values are not secrets.

## Phase 2 design system

Astro presentation primitives:

- Shell and metadata: `Layout`, `SEO`, `Footer`
- Bento layout: `BentoGrid`, `BentoCard`, `CardGrid`
- Controls and labels: `Button`, `Tag`, `StatusPill`, `IconLink`
- Content structure: `SectionHeader`, `StackGroup`, `TerminalBlock`
- Content cards: `ProjectCard`, `NoteCard`, `LabCard`

Svelte islands:

- `ThemeToggle` provides an SSR-safe Light/Dim/Dark segmented preference with Dark as the default.
- `ProjectFilter` demonstrates small client-side filter state for a future projects page.
- `CommandMenuStub` communicates planned functionality without global shortcuts.
- `CardVisibilityDemo` is an unmounted visual prototype only; it has no admin behavior.

Import Astro components directly and pass content through typed props and slots:

```astro
---
import BentoCard from '../components/astro/BentoCard.astro';
import Tag from '../components/astro/Tag.astro';
---

<BentoCard title="System status" accent="strong" class="lg:col-span-4">
  <Tag tone="accent">Live</Tag>
</BentoCard>
```

Bento children may use Tailwind responsive spans such as `md:col-span-2`, `lg:col-span-4`, or `lg:col-span-8`. Global tokens and compact shared utilities live in `src/styles/global.css`.

## Phase 3 homepage

The homepage is a desktop-first 12-column bento dashboard with a natural mobile stack. Its sections appear when enabled and, for content sections, when qualifying entries exist:

1. **Hero** - identity, focus, and primary paths
2. **About** - developer perspective and interests
3. **Featured Projects** - published projects selected in the owner workspace
4. **Now** - current work, learning, and daily environment
5. **Stack** - compact frontend, backend, systems, and exploring groups
6. **GitHub Activity** - contribution calendar read from the public GitHub profile
7. **Featured Notes, Blog, and Lab** - published entries selected in their editors
8. **Contact** - email, GitHub, and LinkedIn links

Source defaults remain in `src/lib/data/site.ts`; `/user/settings` can override the public site name, author, SEO description, GitHub profile, and email. Homepage stack groups and LinkedIn live in `src/lib/data/home.ts`; Now has no static fallback content. The contribution calendar loads server-side from the configured GitHub profile and is cached for an hour. Featured Projects, Notes, Blog, and Lab use their public catalogs at request time.

## Phase 4 content pages

The initial public indexes used Astro Content Collections:

- `/projects` lists visible projects, with featured work first and newest entries first within each group.
- `/notes` lists published notes from newest to oldest.
- `/lab` lists visible experiments from newest to oldest.

The routes share the layout, navigation, cards, status pills, and tags. Projects, Notes, and Lab run on demand and can show selected database records. Hidden or unpublished MDX entries are excluded from public pages.

## Phase 5 project case studies

Visible MDX project entries and visible, non-archived database-only projects use the same canonical detail route at `/projects/[slug]`. A database project without a Markdown body renders a structured overview; adding a body switches that same URL to the full case-study presentation. Phase 12 moved the `/projects` index to request-time rendering, so both cards and detail pages reflect the authorized public catalog.

Project cards on `/projects` and the homepage link to their canonical detail pages. Detail pages render available status, category, date, role, stack, links, and summary fields; projects with actual Markdown or MDX content also render the long-form article and section navigation derived from its headings. Visibility, archive state, MDX source selection, redirect aliases, and previous/next navigation continue to use the public catalog.

### Add a project

Create an `.md` or `.mdx` file in `src/content/projects/`:

```yaml
---
title: Example Project
description: A concise explanation of what the project does.
status: In Progress
featured: false
visible: true
stack: [Astro, TypeScript, PostgreSQL]
github: https://github.com/example/project # optional
demo: https://example.com # optional
caseStudy: /projects/example-project # optional; use only when the route exists
date: 2026-07-14
category: Developer Tools # optional
problem: The concise problem this project explores. # optional
solution: The current solution direction. # optional
role: Product design and full-stack development # optional
highlights: [Typed content, Static delivery] # optional
links: # optional additional links; relative and external URLs are supported
  - label: Documentation
    href: /docs/example
    external: false
cover: /images/projects/example.webp # optional; reserved for cover artwork
order: 1 # optional; lower values are shown first within a featured group
---
```

Required fields are `title`, `description`, `status`, `featured`, `visible`, `stack`, and `date`. Valid project statuses are `Planning`, `Prototype`, `In Progress`, `Live`, and `Archived`.

Only entries with `visible: true` appear on `/projects` or generate a public detail route. Featured projects appear before non-featured projects; projects are otherwise ordered newest first unless an optional numeric `order` is provided within the same featured group. `featured` controls prominence and ordering, not visibility.

Use `github` and `demo` for their standard external actions. `caseStudy` remains supported for compatibility with a separately specified case-study URL, but the local detail link is generated automatically from the content entry filename.

### Recommended project body

Normal Markdown and MDX work inside each detail page. The starter entries use this compact structure so the local section navigation remains useful:

```md
## Overview

What the project is and why it exists.

## Problem

The need or workflow being addressed.

## Approach

How the project is being designed or built.

## Current status

What is complete, active, or still planned.

## What I am learning

Technical and design lessons from the work.
```

Keep project claims honest: do not invent usage metrics, clients, production status, or completed features. Optional frontmatter can be added gradually; incomplete case studies still render safely.

### Add a note

Use `/user/notes` to create and edit a note. For source-controlled writing, create an `.md` or `.mdx` file in `src/content/notes/` and import it with the reviewed backup workflow:

```sh
pnpm notes:import # dry run
pnpm notes:import --apply --backup data/backups/pre-notes-import.sqlite
```

```yaml
---
title: Example Note
description: A concise summary of the note.
category: Build Log
tags: [Astro, Linux]
published: true
featured: false
createdAt: 2026-07-14
updatedAt: 2026-07-15 # optional
summary: A shorter archive or callout summary. # optional
---
```

Required note fields are `title`, `description`, `category`, `tags`, `published`, `featured`, and `createdAt`. `updatedAt` and `summary` are optional.

Only published entries selected by the public source catalog appear on `/notes`, the homepage, search, RSS, or the note sitemap. `featured` adds a visual marker; it does not publish an entry by itself. Categories provide broad archive groupings, while tags describe the specific technologies or ideas in a note.

### Recommended note body

Note detail pages render Markdown and MDX inside the shared readable article shell used by project case studies. A useful starter structure is:

```md
## Context

Why this note exists.

## What I am building or learning

The current subject or question.

## Current approach

What I am trying now.

## Problems to solve

- An open problem or tradeoff.

## Next steps

What I plan to test or document next.
```

Keep work-in-progress notes explicit about what is planned, tested, or complete. Reading time is estimated automatically from the entry body at 200 words per minute with a one-minute minimum.

## Phase 6 notes archive

Published note entries now generate a static technical writing archive:

- `/notes` lists published notes newest first and links every title to its local detail page.
- `/notes/[slug]` renders the MDX body with category, tags, dates, reading time, an optional summary, and older/newer navigation.
- The content filename becomes the route slug, so `src/content/notes/example-note.mdx` builds as `/notes/example-note`.
- Project case studies and notes share the global `.prose-shell` styles for headings, paragraphs, lists, links, code, blockquotes, images, and overflow-safe tables.

Use `/user/notes` for routine writing and publishing. The MDX source remains in the repository as a rollback copy; when a database record is selected as the public source, edits to that MDX file no longer change the public note.

### Add a lab entry

Create an `.md` or `.mdx` file in `src/content/lab/`:

```yaml
---
title: Example Experiment
description: A concise explanation of the experiment.
status: Prototype
tags: [Svelte, UI]
visible: true
date: 2026-07-14
category: UI Experiments # optional
featured: false # optional
repo: https://github.com/example/experiment # optional
demo: https://example.com/experiment # optional
relatedProject: /projects/example-project # optional; relative or external
tools: [Svelte, TypeScript] # optional
lessons: [Keep the interactive surface small.] # optional
risk: Low # optional; Low, Medium, or High
updatedAt: 2026-07-15 # optional
---
```

Required lab fields are `title`, `description`, `status`, `tags`, `visible`, and `date`. Valid statuses are `Idea`, `Prototype`, `Testing`, `Paused`, and `Archived`. Optional metadata can be added only when it is known; incomplete experiments do not need fake links or results.

Only entries with `visible: true` appear on `/lab` or generate a public detail route. Status describes the current experiment state and controls its static archive group. `featured` adds a visual marker but does not change visibility. Categories identify broad workshop areas, tags describe subjects, and tools record the concrete environment used. Optional lessons surface the current observations without implying that an experiment is complete.

### Recommended lab body

Lab entries render Markdown and MDX with the same readable prose shell as projects and notes. Use this structure to keep unfinished work useful:

```md
## Context

Why this experiment exists.

## What I tried

The current approach.

## Current result

What works, what does not, and what remains unclear.

## Notes

- An observation, constraint, or technical detail.

## Next steps

What could happen next.
```

Be explicit when an entry is only an idea, partial prototype, or paused investigation. Do not add a repository, demo, or related project unless the link really exists.

## Phase 7 Lab archive

Visible experiment entries now generate a structured static workshop:

- `/lab` groups visible entries by `Prototype`, `Testing`, `Idea`, `Paused`, and `Archived`, while preserving newest-first order inside each group.
- `/lab/[slug]` renders the MDX experiment body with status, category, tags, dates, optional tools, risk, lessons, links, and older/newer navigation.
- The content filename becomes the route slug, so `src/content/lab/example-experiment.mdx` builds as `/lab/example-experiment`.
- Project, note, and Lab detail pages reuse the shared `.prose-shell` article styles.

Use `/user/lab` for routine experiment writing and publishing. Existing MDX stays available as a rollback copy; imported entries remain on that source until you select the database version. Source-controlled entries can be imported with a dry run followed by a verified backup:

```sh
pnpm lab:import # dry run
pnpm lab:import --apply --backup data/backups/pre-lab-import.sqlite
```

## Phase 8 production polish

The public build now includes:

- `/search`, backed by a browser-only Pagefind island. It fails gracefully during development when the generated index is unavailable.
- `/rss.xml`, containing published notes in newest-first order.
- `/sitemap-index.xml`, generated by `@astrojs/sitemap` from public static routes.
- `/robots.txt`, which allows public crawling and points to the sitemap.
- A static `/404.html` page with useful recovery links and no-index metadata.
- Canonical, Open Graph, Twitter card, author, theme color, RSS discovery, and article metadata.
- A site-specific `public/og.png` social preview fallback.

Search indexing runs automatically through the `postbuild` script. It indexes the public `<main>` content while navigation, search controls, and the 404 page are excluded. There is no server, external search service, API, token, or private `/console` content involved.

The accessibility pass preserves the skip link and semantic landmarks, strengthens visible focus rings, adds accessible external-link announcements, improves search status messaging, and keeps navigation and controls wrapping safely on small screens.

## Phase 9 deployment readiness

Phase 9 established the original static, container-friendly production path:

- A multi-stage Dockerfile installs from the frozen pnpm lockfile, builds Astro plus Pagefind, and copies only the generated output into Nginx.
- Nginx serves real generated files and directories, applies conservative cache lifetimes, emits basic security headers, and exposes a container health check.
- Compose maps `4321:80`, uses a read-only runtime filesystem with narrowly scoped temporary mounts, and adds no database, secrets, or backend service.
- Docker build/run scripts and a separate `build:search` command make local and automated workflows reproducible.
- GitHub Actions checks types, formatting, the production build, and the Docker image without deploying anything.

Phase 11 replaces that Nginx-only runtime with the Node service documented above. The Phase 9 notes remain here as project history.

## Phase 10 private console planning

Phase 10 created the planning boundary that Phase 11 now implements as a narrow first slice:

- [Private Console Plan](docs/console-plan.md) records purpose, non-goals, future sections, authentication/security boundaries, SSR migration choices, deployment implications, and the recommended Phase 11 slice.
- [Future Console Data Model](docs/data-model.md) sketches `now_status`, projects, notes, Lab entries, stack groups, homepage cards, site settings, and an audit log without creating a database.
- [Future Console Route Map](docs/console-routes.md) separates current public routes from planned guarded pages and mutation endpoints.
- `src/lib/console/types.ts` provides future-facing TypeScript contracts only; it contains no database or auth access.
- The original `/console` holding route has been replaced by the protected Phase 11 overview.

The original console plan covered Now status, featured projects, note drafts, Lab entries, stack groups, homepage card visibility, and site settings. Those owner editors now live under `/user`.

The planning documents remain the source for future boundaries and have been updated with what Phase 11 actually shipped.

## Phase 11 private console MVP

Phase 11 adds one secure end-to-end publishing path:

- Astro uses `@astrojs/node` in standalone server mode. Public content routes remain prerendered where they do not need runtime data.
- Better Auth provides hashed email/password credentials, HTTP-only server sessions, secure production cookies, trusted-origin checks, and login rate limiting. Public sign-up is disabled.
- Drizzle and local libSQL/SQLite persist Better Auth's core tables plus one `now_status` row. Migrations are committed under `drizzle/`.
- `src/middleware.ts` guards `/console/*` except login and every `/api/console/*` mutation route. Endpoints also check authentication, request origin, size, and field limits.
- `/console`, `/console/now`, and `POST /console/logout` are private. `/console/login` is the only public console page.
- The homepage reads a published database status on the server. The static fallback list is now empty, so Now stays hidden until published.
- The private pages stay `noindex`, out of Pagefind, absent from public navigation, and excluded from the sitemap.

At the completion of Phase 11, projects, notes, Lab entries, stack groups, homepage layout, and settings had no database editor. There is no registration UI, OAuth, password reset email, multi-user management, media upload, or audit log.

## Phase 12 Projects Manager MVP

Phase 12 adds the second narrow console module without turning angefolio into a general CMS:

- `/console/projects`, `/console/projects/new`, and `/console/projects/[id]` are protected by the existing Better Auth middleware and route-level checks.
- Authenticated, same-origin, payload-limited endpoints create and update records, toggle visibility/featured priority, and archive records. There is no hard-delete endpoint.
- The `project_records` migration stores normalized metadata, JSON stack/link arrays, public flags, ordering, timestamps, and a plain-text case-study body that is never executed.
- Slugs, status, lengths, list counts, integer ordering, and HTTP(S) URLs are validated on the server. New records default to private unless the owner explicitly checks visibility.
- The homepage and `/projects` use visible, non-archived database records when at least one exists. If the database is unavailable or contains no public records, both surfaces use the existing visible MDX collection.
- `/projects/[slug]` remains a prerendered MDX route so project case studies stay in Pagefind. A database card links locally only when a visible MDX entry has the same slug; DB-only records never emit a broken detail link, and stored bodies are not executed.

Run `pnpm db:migrate` to apply content tables. Imported content remains source-controlled for rollback while each record follows its explicit source setting. Homepage settings use a validated database row and source defaults.

## Phase 13 publishing groundwork

- Now and project writes record compact audit events in the same SQLite transaction.
- Archived projects retain their former status and can be restored as hidden, unfeatured drafts; there is still no hard delete.
- `node scripts/db-maintenance.mjs backup <new-file>`, `verify <file>`, and `restore <backup> <new-file>` provide verified copy operations. Restore never overwrites a live database.
- `pnpm test:console` exercises private routes and a backup/restore cycle against a temporary server and database.
- [Content inventory](docs/content-inventory.md) captures current sources and migration rules. [Operations](docs/operations.md) covers the chosen single-server persistent volume.

## Phase 14 project publishing

`/user/projects` edits full case studies. The Markdown toolbar supports bold, italic, headings, lists, links, and private preview. Future MDX projects can be imported with a dry run and verified backup; each adopted record takes over its existing URL. The four starter records and source files have been cleared. See [Project publishing](docs/project-publishing.md) for the cutover and rollback steps.

## Folder structure

```text
docs/
├── console-plan.md     # Console architecture and security plan
├── console-routes.md   # Current and future route boundaries
├── project-publishing.md # Project import and cutover
├── content-inventory.md # Existing content and import contract
├── data-model.md       # Implemented and future persistence models
└── operations.md       # SQLite backup and recovery

drizzle/               # Versioned SQLite migrations
scripts/               # Start validation and one-time owner bootstrap
src/
├── components/
│   ├── astro/       # Layout, content cards, and presentation primitives
│   └── svelte/      # Small interactive islands and future-facing stubs
├── content/         # Typed Project, Note, and Lab collections (currently empty)
├── lib/             # Shared content utilities and server-only modules
│   ├── console/     # Future-facing type contracts
│   └── server/      # Auth, database, validation, Now, and project queries
├── pages/
│   ├── index.astro  # Bento-dashboard homepage with conditional sections
│   ├── projects/    # Runtime index and adopted Markdown/MDX detail routes
│   ├── notes/       # Public note index and static detail routes
│   ├── lab/         # Public Lab archive and detail routes
│   ├── api/         # Better Auth and guarded console endpoints
│   ├── user/        # Protected overview and content editors
│   ├── search.astro # Server-rendered Pagefind search shell
│   ├── rss.xml.ts   # Published-note RSS feed
│   └── 404.astro    # Static not-found page
└── styles/
    └── global.css   # Tailwind entry, theme tokens, and shared utilities
```

## Current limitations

- Future Lab MDX files can be imported and used as rollback copies. There is no discussion system or separate status/tag route yet.
- Lab entries are grouped by status; there are no interactive filters yet.
- Future Note MDX files can be imported and used as rollback copies. There is no comments system or category/tag route yet.
- Pagefind needs a production build for static pages; live project search is available in development.
- The canonical production domain is still a documented placeholder and must be replaced before deployment.
- Container TLS, DNS, secret injection, and hosting-provider configuration remain external deployment concerns; the Node image serves HTTP on port `4321` behind the chosen platform or reverse proxy.
- Now Status, project, note, Lab, and homepage records are database-backed. A single bootstrap account is supported; passkeys/2FA are not implemented.
- Projects use sanitized Markdown with a formatting toolbar and preview. Project cover uploads are converted to WebP and stored in SQLite; hard delete and automatic GitHub synchronization are not implemented.
- Runtime project pages use live search rather than Pagefind. If SQLite is unavailable, project queries fail closed so hidden adopted content cannot reappear from old MDX.
- GitHub activity uses the public profile contribution calendar, cached on the server for an hour.
- Project filtering is a UI demonstration only.
- The command menu and unrelated card visibility controls are non-production stubs.
- Lab and Note MDX remain rollback copies for entries using database content.

## Roadmap

- **Phase 1:** Project setup and foundation
- **Phase 2:** Design system and reusable UI foundation
- **Phase 3:** Static bento homepage
- **Phase 4:** Public content collection indexes
- **Phase 5:** Project detail pages and case studies (complete)
- **Phase 6:** Note detail pages, tags/categories, and writing polish (complete)
- **Phase 7:** Lab detail pages and prototype archive (complete)
- **Phase 8:** Search, SEO, accessibility, RSS, and polish (complete)
- **Phase 9:** Docker hardening, production reliability, and deployment readiness (complete)
- **Phase 10:** Private `/console` planning and safe architecture scaffold (complete)
- **Phase 11:** Authenticated console foundation and Now Status editor (complete)
- **Phase 12:** Protected Projects Manager with DB-first public fallback (complete)
- **Phase 13:** Content baseline, audit trail, archive restore, and tested database recovery (complete)
- **Phase 14:** `/user` workspace and full project publishing with controlled MDX import (complete)
- **Phase 15:** Notes authoring, Markdown preview, and source selection (complete)
- **Phase 16:** Lab authoring, Markdown preview, and source selection (complete)
- **Phase 17:** Revision history and restore across all editors (complete)
- **Phase 18:** Project media upload and cover rendering (complete)
- **Phase 19:** Homepage settings and stack groups (complete)
- **Phase 20:** Slug redirect management (complete)
- **Phase 21:** Allow-listed public site settings (complete)
- **Phase 22:** Database-aware readiness probe (complete)
- **Phase 23:** One-owner password recovery command (complete)
- **Phase 24:** Encrypted off-host backup job and daily systemd timer (complete; configure host remote and secrets)
- **Phase 25:** Database-backed Blog publishing, public archive, search, RSS, and sitemap (complete)

Run `node --test tests/offsite-backup.test.mjs` to exercise the off-host backup job with local stand-ins.

See [console-plan.md](docs/console-plan.md) and [operations.md](docs/operations.md) for host configuration and restore steps.
See [blog-publishing.md](docs/blog-publishing.md) for the Blog editor and publishing behavior.

- **Phase 26:** Optional Blog covers, project screenshot galleries, and sanitized Markdown image insertion through SQLite-backed media uploads (complete)

Phase 26 adds an additive schema migration for Blog cover references and project screenshot metadata. Apply migrations only through the documented backup-and-deploy workflow; the feature does not run production migrations automatically. See the Blog and project publishing guides for editor workflows.
