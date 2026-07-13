# angefolio

The personal developer portfolio of **Angellie Marcos**, an Information Technology student building practical web systems with a Linux-minded, creative edge.

This repository is currently in **Phase 6: notes and technical writing**. It builds on the Astro baseline, reusable design system, bento-dashboard homepage, public content indexes, and project case studies without adding a database, authentication, admin console, or CMS.

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
│   ├── projects/    # Public project index and static detail routes
│   ├── notes/       # Public note index and static detail routes
│   └── lab/         # Public lab collection index
└── styles/
    └── global.css   # Tailwind entry, theme tokens, and shared utilities
```

## Current limitations

- Lab detail routes are not implemented yet; its Phase 4 collection index remains a static listing.
- Notes are source-controlled MDX files. There is no browser editor, comments system, RSS feed, or category/tag route yet.
- Pagefind search is installed but is not exposed yet; search remains planned for a later polish phase.
- Project detail pages are static and MDX-backed. There is no browser-based project editor or automatic synchronization with GitHub.
- The optional project `cover` field is reserved for later visual treatment and is not rendered yet.
- The resume link expects a future `public/resume.pdf` file.
- GitHub activity is a static visual placeholder and does not call the GitHub API.
- Project filtering is a UI demonstration only.
- The command menu and card visibility controls are non-production stubs.
- There is no database, authentication, Node adapter, private `/console`, or CMS. A future `/console` may manage project and note content, but it is deliberately outside Phase 6.

## Roadmap

- **Phase 1:** Project setup and foundation
- **Phase 2:** Design system and reusable UI foundation
- **Phase 3:** Static bento homepage
- **Phase 4:** Public content collection indexes
- **Phase 5:** Project detail pages and case studies (complete)
- **Phase 6:** Note detail pages, tags/categories, and writing polish (complete)
- **Phase 7:** Lab
- **Phase 8:** Search, SEO, and polish
- **Phase 9:** Docker hardening
- **Phase 10+:** Private `/console` planning and CMS work

Next: **Phase 7 should build out lab detail pages and experiment write-ups.** Search, SEO, and broader archive polish remain planned for Phase 8. Astro remains the main framework, with Svelte limited to focused interactive islands.
