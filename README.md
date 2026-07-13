# angefolio

The personal developer portfolio of **Angellie Marcos**, an Information Technology student building practical web systems with a Linux-minded, creative edge.

This repository is currently in **Phase 4: public content collection pages**. It builds on the Astro baseline, reusable design system, and bento-dashboard homepage without adding a database, authentication, admin console, or CMS.

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

Build and preview production output:

```bash
pnpm build
pnpm preview --host 0.0.0.0 --port 4321
```

Optional checks:

```bash
pnpm check
pnpm format:check
```

## Docker

Build and run the `portfolio` service:

```bash
docker compose up --build
```

Open `http://localhost:4321`. Stop it with `docker compose down`.

The container is named `angefolio` and uses `unless-stopped`. No database volumes or secrets are required.

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
---
```

Valid project statuses are `Planning`, `Prototype`, `In Progress`, `Live`, and `Archived`. Only entries with `visible: true` appear on `/projects`.

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
---
```

Only entries with `published: true` appear on `/notes`.

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
---
```

Valid lab statuses are `Idea`, `Prototype`, `Testing`, `Paused`, and `Archived`. Only entries with `visible: true` appear on `/lab`.

## Folder structure

```text
src/
├── components/
│   ├── astro/       # Layout, content cards, and presentation primitives
│   └── svelte/      # Small interactive islands and future-facing stubs
├── content/         # Typed starter projects, notes, and lab entries
├── lib/             # Shared site identity and content utilities
├── pages/
│   ├── index.astro  # Eight-cell bento-dashboard homepage
│   ├── projects/    # Public project collection index
│   ├── notes/       # Public note collection index
│   └── lab/         # Public lab collection index
└── styles/
    └── global.css   # Tailwind entry, theme tokens, and shared utilities
```

## Current limitations

- Project, note, and lab detail routes are not implemented yet; Phase 4 only provides their public collection indexes.
- The resume link expects a future `public/resume.pdf` file.
- GitHub activity is a static visual placeholder and does not call the GitHub API.
- Project filtering is a UI demonstration only.
- The command menu and card visibility controls are non-production stubs.
- There is no database, authentication, Node adapter, private `/console`, or CMS.

## Roadmap

- **Phase 1:** Project setup and foundation
- **Phase 2:** Design system and reusable UI foundation
- **Phase 3:** Static bento homepage
- **Phase 4:** Public content collection indexes
- **Phase 5:** Project detail pages and case studies
- **Phase 6:** Note detail pages, tags/categories, and search
- **Phase 7:** Lab
- **Phase 8:** Search, SEO, and polish
- **Phase 9:** Docker hardening
- **Phase 10+:** Private `/console` planning and CMS work

Next: **Phase 5 should add project detail pages and honest case studies. Phase 6 should add note detail pages, tag/category navigation, and Pagefind search.** Astro remains the main framework, with Svelte limited to focused interactive islands.
