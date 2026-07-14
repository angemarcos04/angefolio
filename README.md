# angefolio

The personal developer portfolio of **Angellie Marcos**, an Information Technology student building practical web systems with a Linux-minded, creative edge.

This repository is currently in **Phase 12: private `/console` Projects Manager MVP**. Astro runs through the standalone Node adapter so console sessions and writes stay server-side. Better Auth, Drizzle, and a local SQLite/libSQL database power one protected owner account, the Now Status editor, and protected project records. Notes and Lab content remain source-controlled MDX; project MDX remains an explicit public fallback.

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

Open `http://localhost:4321`.

Create the one allowed administrator once, after filling `AUTH_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in the local environment:

```bash
pnpm console:bootstrap
```

Remove the two `ADMIN_` values immediately afterward. Public sign-up is disabled, and the bootstrap refuses to add a second account.

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

Open `http://localhost:4321`. Stop it with `docker compose down`.

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

The deployable artifact is the standalone Node server plus `dist/client`, committed migrations, and runtime dependencies. A static-only host is no longer sufficient for `/console`, live Now Status, or database project records. Build with:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
pnpm build
```

The Docker build uses `pnpm build:search` so Pagefind output is always present. Project details, Notes, Lab, RSS, robots, search, and the 404 page remain prerendered. `/`, `/projects`, `/console/*`, and console/auth endpoints run on demand because public project records can change without a rebuild. `astro preview` remains an inspection tool, while production uses the Node adapter entry point.

Expected public output includes project, note, and Lab indexes/details; `/search`; `/rss.xml`; `/robots.txt`; `/sitemap-index.xml`; and `/404.html`. Pagefind indexes the prerendered public HTML in `dist/client`. The homepage remains server-rendered so a published database status appears without a rebuild.

## Environment

Copy `.env.example` to `.env` locally. `AUTH_SECRET` is server-only and must be at least 32 random characters in production. `DATABASE_URL` defaults to `file:./data/angefolio.db` only in development. `PUBLIC_SITE_URL` and `AUTH_TRUSTED_ORIGIN` must match the browser-visible origin so Better Auth and the same-origin write checks agree.

`ADMIN_EMAIL` and `ADMIN_PASSWORD` are one-time inputs consumed only by `pnpm console:bootstrap`; the web application never reads them. Never prefix auth, database, or bootstrap values with `PUBLIC_`.

Before a real deployment, replace `https://angellie-marcos.dev` in both `astro.config.mjs` and `src/lib/data/site.ts`, then rebuild. Inject authentication and database values only as server-side runtime secrets; never commit them or expose them through `PUBLIC_` variables.

## CI

`.github/workflows/ci.yml` validates pushes and pull requests targeting `main` on Node.js 22. It installs the frozen lockfile, runs Astro checks, verifies formatting, builds the SSR server and Pagefind client index, and builds the production image. Auth is lazy at runtime, so CI needs no real secret and performs no deployment.

## Deployment notes

- Deploy the Node image to a host that supports a long-running process, container port `4321`, persistent volumes, runtime secrets, and health checks.
- Terminate HTTPS at the hosting platform or reverse proxy. Secure cookies are enabled automatically when `NODE_ENV=production`.
- Back up `/app/data/angefolio.db` before console editing is treated as operationally important; backup automation and restore testing remain future operational work.
- Run migrations before the new server receives traffic. The Docker command does this automatically.
- Rebuild for MDX changes so public collection pages, RSS, sitemap, and Pagefind stay synchronized. Now Status and database project updates do not require a rebuild, but Pagefind does not re-index those request-time changes until the next build.

## Production URL placeholder

Astro currently uses `https://angellie-marcos.dev` as a clearly documented placeholder in `astro.config.mjs` and `src/lib/data/site.ts`. Sitemap, RSS, canonical URLs, robots metadata, and social metadata need an absolute origin, but this repository does not yet confirm a deployed domain.

Replace both placeholder values with the real public origin before deployment, and set the matching `PUBLIC_SITE_URL`/`AUTH_TRUSTED_ORIGIN` at runtime. These public origin values are not secrets.

## Phase 2 design system

Astro presentation primitives:

- Shell and metadata: `Layout`, `SEO`, `Footer`
- Bento layout: `BentoGrid`, `BentoCard`, `CardGrid`
- Controls and labels: `Button`, `Tag`, `StatusPill`, `IconLink`
- Content structure: `SectionHeader`, `StackGroup`, `TerminalBlock`
- Content cards: `ProjectCard`, `NoteCard`, `LabCard`

Svelte islands:

- `ThemeToggle` provides an SSR-safe dark/dim preference.
- `ProjectFilter` demonstrates small client-side filter state for a future projects page.
- `CommandMenuStub` communicates planned functionality without global shortcuts.
- `CardVisibilityDemo` is an unmounted visual prototype only; it has no admin behavior.

Import Astro components directly and pass content through typed props and slots:

```astro
---
import BentoCard from '../components/astro/BentoCard.astro';
import Tag from '../components/astro/Tag.astro';
---

<BentoCard title="System status" accent="green" class="lg:col-span-4">
  <Tag tone="green">Live</Tag>
</BentoCard>
```

Bento children may use Tailwind responsive spans such as `md:col-span-2`, `lg:col-span-4`, or `lg:col-span-8`. Global tokens and compact shared utilities live in `src/styles/global.css`.

## Phase 3 homepage

The homepage is a desktop-first 12-column bento dashboard with a natural mobile stack. It contains exactly eight main cells, each with one job:

1. **Hero** - identity, focus, and primary paths
2. **About** - developer perspective and interests
3. **Featured Projects** - four visible collection-backed projects
4. **Now** - current work, learning, and daily environment
5. **Stack** - compact frontend, backend, systems, and exploring groups
6. **GitHub Activity** - static public-work indicator and profile link
7. **Latest Notes** - up to three published collection-backed notes
8. **Contact** - email, GitHub, resume, and LinkedIn links

Profile identity remains in `src/lib/data/site.ts`. Homepage-only lists, stack groups, contact links, and the static contribution pattern live in `src/lib/data/home.ts`. Featured projects and latest notes are loaded from Astro Content Collections in `src/content/` during the static build.

## Phase 4 content pages

The public collection indexes are generated statically from Astro Content Collections:

- `/projects` lists visible projects, with featured work first and newest entries first within each group.
- `/notes` lists published notes from newest to oldest.
- `/lab` lists visible experiments from newest to oldest.

All three routes share the existing layout, terminal-style navigation, responsive card grid, content cards, status pills, and tags. Their core filtering and date sorting live in `src/lib/content.ts`. Hidden or unpublished entries remain available to the source repository but are excluded from public listing pages during the build.

## Phase 5 project case studies

Visible project entries render detail pages at `/projects/[slug]`. The filename remains the MDX route slug, so `src/content/projects/example-project.mdx` is served as `/projects/example-project`. Phase 12 moved the route to request-time rendering so DB-only projects can coexist while preserving this MDX body behavior.

The `/projects` index and homepage project cards link to these local pages. Detail pages render the MDX body inside a consistent case-study shell with project status, category, date, role, stack, optional links, summary fields, and previous/next navigation.

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

Create an `.md` or `.mdx` file in `src/content/notes/`:

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

Only entries with `published: true` appear on `/notes` or generate a public detail page. `featured` adds a visual marker and lets the homepage communicate important writing; it does not publish an entry by itself. Categories provide broad archive groupings, while tags describe the specific technologies or ideas in a note. The index currently summarizes both as static metadata rather than client-side filters.

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
- The content filename becomes the route slug, so `src/content/notes/building-angefolio.mdx` builds as `/notes/building-angefolio`.
- Project case studies and notes share the global `.prose-shell` styles for headings, paragraphs, lists, links, code, blockquotes, images, and overflow-safe tables.

To add writing, create an `.md` or `.mdx` file in `src/content/notes/`, fill in the required frontmatter, write the body, and run the normal checks. No database, CMS, or browser-based editor is involved; these are static MDX-backed routes. A future private `/console` may manage note content, but it is intentionally outside this phase.

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
- The content filename becomes the route slug, so `src/content/lab/svelte-ui-experiments.mdx` builds as `/lab/svelte-ui-experiments`.
- Project, note, and Lab detail pages reuse the shared `.prose-shell` article styles.

To add an experiment, create an `.md` or `.mdx` file in `src/content/lab/`, complete the required frontmatter, document what was actually tried, and run the normal checks. Lab entries remain source-controlled static content. A future private `/console` may manage them, but there is no browser editor, database, authentication, or admin workflow yet.

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

The longer-term console is intended to manage Now/status content, featured projects, note drafts, Lab entries, stack groups, homepage card visibility, and supported site settings. Phase 11 implements only Now Status.

The planning documents remain the source for future boundaries and have been updated with what Phase 11 actually shipped.

## Phase 11 private console MVP

Phase 11 adds one secure end-to-end publishing path:

- Astro uses `@astrojs/node` in standalone server mode. Public content routes remain prerendered where they do not need runtime data.
- Better Auth provides hashed email/password credentials, HTTP-only server sessions, secure production cookies, trusted-origin checks, and login rate limiting. Public sign-up is disabled.
- Drizzle and local libSQL/SQLite persist Better Auth's core tables plus one `now_status` row. Migrations are committed under `drizzle/`.
- `src/middleware.ts` guards `/console/*` except login and every `/api/console/*` mutation route. Endpoints also check authentication, request origin, size, and field limits.
- `/console`, `/console/now`, and `POST /console/logout` are private. `/console/login` is the only public console page.
- The homepage reads a published database status on the server and falls back to the existing static `nowItems` when the row is unpublished, missing, or unavailable.
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

Run `pnpm db:migrate` to apply `project_records`. There is intentionally no automatic seed: create records through the protected manager, and keep the MDX collection as the fallback until a deliberate content cutover. Notes, Lab, stack, homepage cards, settings, uploads, rich text, audit logging, and backups are not implemented here.

## Folder structure

```text
docs/
├── console-plan.md    # Console architecture and security plan
├── console-routes.md  # Current and future route boundaries
└── data-model.md      # Implemented and future persistence models

drizzle/               # Versioned SQLite migrations
scripts/               # Start validation and one-time owner bootstrap
src/
├── components/
│   ├── astro/       # Layout, content cards, and presentation primitives
│   └── svelte/      # Small interactive islands and future-facing stubs
├── content/         # Typed starter projects, notes, and lab entries
├── lib/             # Shared content utilities and server-only modules
│   ├── console/     # Future-facing type contracts
│   └── server/      # Auth, database, validation, Now, and project queries
├── pages/
│   ├── index.astro  # Eight-cell bento-dashboard homepage
│   ├── projects/    # DB-first index and prerendered MDX detail routes
│   ├── notes/       # Public note index and static detail routes
│   ├── lab/         # Public Lab index and static detail routes
│   ├── api/         # Better Auth and guarded console endpoints
│   ├── console/     # Protected overview, Now editor, and Projects Manager
│   ├── search.astro # Static Pagefind search shell
│   ├── rss.xml.ts   # Published-note RSS feed
│   └── 404.astro    # Static not-found page
└── styles/
    └── global.css   # Tailwind entry, theme tokens, and shared utilities
```

## Current limitations

- Lab entries are source-controlled MDX files. There is no browser editor, discussion system, or separate status/tag route yet.
- Lab status grouping and archive metadata remain static rather than interactive filters.
- Notes are source-controlled MDX files. There is no browser editor, comments system, or category/tag route yet.
- Pagefind search is available only after a production build; the development server intentionally shows a fallback message when the index is absent.
- The canonical production domain is still a documented placeholder and must be replaced before deployment.
- Container TLS, DNS, secret injection, backups, and hosting-provider configuration remain external deployment concerns; the Node image serves HTTP on port `4321` behind the chosen platform or reverse proxy.
- Now Status and project records are database-backed. A single bootstrap account is supported; password recovery, passkeys/2FA, audit logging, and backup automation are not implemented yet.
- Database projects are metadata and stored plain text only. DB-only records have no detail page in Phase 12. There is no rich-text/MDX execution, media upload, hard delete, restore/unarchive workflow, bulk import, or automatic GitHub synchronization.
- Request-time database cards are not added to Pagefind until a later indexing strategy is implemented; prerendered MDX detail pages remain part of the build-time index.
- The optional project `cover` field is reserved for later visual treatment and is not rendered yet.
- GitHub activity is a static visual placeholder and does not call the GitHub API.
- Project filtering is a UI demonstration only.
- The command menu and card visibility controls are non-production stubs.
- Notes and Lab entries remain MDX-backed; project MDX remains the public fallback, and the private console is not a general CMS.

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
- **Phase 13+:** Project operations hardening, auditing/backups, and the next deliberate content slice

Next: **Phase 13 should harden project operations before adding another editor.** Add route/session integration tests, append-only audit events for Now and project mutations, tested SQLite backup/restore, an explicit archive recovery policy, and a Turso/libSQL deployment decision. Keep Notes, Lab, stack, homepage cards, and settings file-backed until those controls are proven.
