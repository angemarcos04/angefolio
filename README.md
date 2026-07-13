# angefolio

The personal developer portfolio of **Angellie Marcos**, an Information Technology student building practical web systems with a Linux-minded, creative edge.

This repository is currently in **Phase 10: private `/console` planning and safe architecture scaffold**. It builds on the static Astro portfolio and hardened Phase 9 deployment without adding a database, authentication, writable CMS, API mutations, or an SSR runtime.

## Tech stack

- Astro with TypeScript and static output
- Svelte for interactive islands only
- Tailwind CSS v4
- MDX and Astro Content Collections
- Expressive Code
- Pagefind and Sharp
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
pnpm dev
```

Open `http://localhost:4321`.

Build and preview production output locally:

```bash
pnpm build
pnpm preview --host 0.0.0.0 --port 4321
```

`pnpm build` remains the standard production build and its existing `postbuild` hook generates the Pagefind index. For an explicit, self-contained search build that does not depend on lifecycle behavior, use `pnpm build:search`. To regenerate only the index for an existing `dist/`, use `pnpm index`.

Optional checks:

```bash
pnpm check
pnpm format:check
```

## Docker

The production image uses three stages: a pnpm dependency stage, a static Astro/Pagefind build stage, and an Nginx runtime containing only `dist/` and the server configuration. Node.js, pnpm, source files, and development dependencies do not ship in the runtime image. Nginx serves the generated routes directly; there is no SPA fallback or SSR process.

Build and run the image directly:

```bash
pnpm docker:build
pnpm docker:run
```

The equivalent raw commands are `docker build -t angefolio .` and `docker run --rm -p 4321:80 angefolio`.

Or build and run the `portfolio` Compose service:

```bash
docker compose up --build
```

Open `http://localhost:4321`. Stop it with `docker compose down`.

The container is named `angefolio`, maps host port `4321` to Nginx port `80`, and uses `unless-stopped`. Compose also enables the image health check, a read-only root filesystem, temporary Nginx cache/run mounts, and `no-new-privileges`. No database volumes, backend services, runtime environment variables, or secrets are required.

Useful validation commands:

```bash
docker compose config
docker build -t angefolio:test .
docker inspect --format='{{json .State.Health}}' angefolio
```

The last command applies while the Compose service is running.

## Production build

The deployable artifact is the generated `dist/` directory. A non-container static host can publish that directory after this workflow:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
pnpm build
```

The Docker build uses `pnpm build:search` so Pagefind output is always present in the runtime image. `astro preview` remains available for local inspection, but the production container intentionally uses Nginx instead of the Astro preview server.

Expected public output includes the homepage; project, note, and Lab indexes and detail pages; `/search`; `/rss.xml`; `/robots.txt`; `/sitemap-index.xml`; and `/404.html`. Nginx uses normal file/directory resolution and returns the generated 404 page with a 404 response instead of rewriting unknown paths to the homepage.

## Environment

Phase 10 does not require environment variables. `.env.example` keeps the current empty runtime contract and documents commented names that a future console may use. `AUTH_SECRET`, `DATABASE_URL`, and `PUBLIC_SITE_URL` are not read by the application and must not be populated until the corresponding authenticated server architecture exists.

Before a real deployment, replace `https://angellie-marcos.dev` in both `astro.config.mjs` and `src/lib/data/site.ts`, then rebuild. Do not add authentication, database, or private API values until Phase 11 defines how they are generated, stored, rotated, and consumed.

## CI

`.github/workflows/ci.yml` validates pushes and pull requests targeting `main` on Node.js 22. It installs the frozen pnpm lockfile, runs Astro checks, verifies formatting, builds the static site and Pagefind index, and builds the production Docker image. It does not deploy, publish an image, use secrets, or assume a hosting provider.

## Deployment notes

- Deploy the Nginx image to any container host that can expose container port `80` and honor its health check.
- Alternatively, publish `dist/` to a static hosting provider. Configure that provider to serve generated directories normally and use `404.html` for missing routes; do not enable a blanket SPA rewrite.
- Terminate HTTPS and configure the public domain at the hosting platform or reverse proxy. The repository intentionally contains no domain-specific proxy labels.
- Rebuild for every content change so Astro pages, RSS, sitemap, and Pagefind stay synchronized.
- Preserve `/pagefind/`, `/_astro/`, XML, text, image, and font files when copying the artifact.

## Production URL placeholder

Astro currently uses `https://angellie-marcos.dev` as a clearly documented placeholder in `astro.config.mjs` and `src/lib/data/site.ts`. Sitemap, RSS, canonical URLs, robots metadata, and social metadata need an absolute origin, but this repository does not yet confirm a deployed domain.

Replace both placeholder values with the real public origin before deployment. No environment variable or secret is required for the static build.

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

Visible project entries now generate static detail pages at `/projects/[slug]`. The filename becomes the route slug, so `src/content/projects/example-project.mdx` builds as `/projects/example-project`.

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

The production path is now explicitly static and container-friendly:

- A multi-stage Dockerfile installs from the frozen pnpm lockfile, builds Astro plus Pagefind, and copies only the generated output into Nginx.
- Nginx serves real generated files and directories, applies conservative cache lifetimes, emits basic security headers, and exposes a container health check.
- Compose maps `4321:80`, uses a read-only runtime filesystem with narrowly scoped temporary mounts, and adds no database, secrets, or backend service.
- Docker build/run scripts and a separate `build:search` command make local and automated workflows reproducible.
- GitHub Actions checks types, formatting, the production build, and the Docker image without deploying anything.

This runtime serves only the public portfolio. It does not provide API routes, on-demand rendering, authentication, content editing, or a private `/console`.

## Phase 10 private console planning

Phase 10 creates a careful boundary for a future private portfolio CMS while leaving the deployed site static:

- [Private Console Plan](docs/console-plan.md) records purpose, non-goals, future sections, authentication/security boundaries, SSR migration choices, deployment implications, and the recommended Phase 11 slice.
- [Future Console Data Model](docs/data-model.md) sketches `now_status`, projects, notes, Lab entries, stack groups, homepage cards, site settings, and an audit log without creating a database.
- [Future Console Route Map](docs/console-routes.md) separates current public routes from planned guarded pages and mutation endpoints.
- `src/lib/console/types.ts` provides future-facing TypeScript contracts only; it contains no database or auth access.
- `/console` is a static, noindex, Pagefind-excluded planning notice. It is not linked from public navigation, is excluded from the sitemap, and explicitly does not claim privacy or security.

The future console is intended to manage Now/status content, featured projects, note drafts, Lab entries, stack groups, homepage card visibility, and supported site settings. Content is still edited through source-controlled MDX, Astro Content Collections, and TypeScript data in Phase 10.

There is no Better Auth integration, Drizzle schema, SQLite database, Turso connection, Node adapter, login, session, route guard, form submission, server action, or API write route in this phase. A working `/console` will require authenticated SSR or a separate secured service, persistent storage, backups, and a revised deployment strategy.

## Folder structure

```text
docs/
├── console-plan.md    # Console architecture and security plan
├── console-routes.md  # Current and future route boundaries
└── data-model.md      # Future persistence sketches

src/
├── components/
│   ├── astro/       # Layout, content cards, and presentation primitives
│   └── svelte/      # Small interactive islands and future-facing stubs
├── content/         # Typed starter projects, notes, and lab entries
├── lib/             # Shared site identity and content utilities
│   └── console/     # Future-facing type contracts only
├── pages/
│   ├── index.astro  # Eight-cell bento-dashboard homepage
│   ├── projects/    # Public project index and static detail routes
│   ├── notes/       # Public note index and static detail routes
│   ├── lab/         # Public Lab index and static detail routes
│   ├── console/     # Static noindex planning placeholder
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
- Container TLS, DNS, and hosting-provider configuration remain external deployment concerns; the image serves HTTP on port `80` behind the chosen platform or reverse proxy.
- `/console` is only a public static planning notice. No route in Phase 10 is private, authenticated, or capable of changing content.
- Project detail pages are static and MDX-backed. There is no browser-based project editor or automatic synchronization with GitHub.
- The optional project `cover` field is reserved for later visual treatment and is not rendered yet.
- GitHub activity is a static visual placeholder and does not call the GitHub API.
- Project filtering is a UI demonstration only.
- The command menu and card visibility controls are non-production stubs.
- There is no database, authentication, Node adapter, private console, or CMS. The planned console may eventually manage project, note, and Lab content, but Phase 10 adds only documentation, types, and a non-functional holding page.

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
- **Phase 11+:** Authenticated console vertical slice and content migration decisions

Next: **Phase 11 should decide between integrated Astro SSR and a separate private console service, then implement one secured Now Status vertical slice.** That phase should add the Node adapter, Better Auth, Drizzle, SQLite, server-side guards, CSRF protection, audit logging, and backup/restore tests only after the deployment and data-source decisions are recorded. Projects, notes, Lab, stack, homepage cards, and settings should remain file-backed until the first slice proves the security and operational model.
