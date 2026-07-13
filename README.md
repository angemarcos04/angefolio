# angefolio

The personal developer portfolio of **Angellie Marcos**, an Information Technology student building practical web systems with a Linux-minded, creative edge.

This repository is currently in **Phase 2: design system and reusable UI foundation**. It preserves the Phase 1 Astro baseline and demonstrates the visual language without building the final homepage, database, authentication, admin console, or CMS.

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
- Future content cards: `ProjectCard`, `NoteCard`, `LabCard`

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

## Folder structure

```text
src/
├── components/
│   ├── astro/       # Layout, content cards, and presentation primitives
│   └── svelte/      # Small interactive islands and future-facing stubs
├── content/         # Typed starter projects, notes, and lab entries
├── lib/             # Shared site identity and utilities
├── pages/
│   └── index.astro  # Minimal Phase 2 component demonstration
└── styles/
    └── global.css   # Tailwind entry, theme tokens, and shared utilities
```

## Current limitations

- The homepage is still a compact placeholder, not the final eight-cell portfolio.
- Project, note, and lab cards are ready for content collection data but are not wired to listing routes yet.
- Project filtering is a UI demonstration only.
- The command menu and card visibility controls are non-production stubs.
- There is no database, authentication, Node adapter, private `/console`, or CMS.

## Roadmap

- **Phase 1:** Project setup and foundation
- **Phase 2:** Design system and reusable UI foundation
- **Phase 3:** Static bento homepage
- **Phase 4:** Content collections and content pages
- **Phase 5:** Projects section
- **Phase 6:** Notes/blog
- **Phase 7:** Lab
- **Phase 8:** Search, SEO, and polish
- **Phase 9:** Docker hardening
- **Phase 10+:** Private `/console` planning and CMS work

Next: **Phase 3 will build the static bento homepage** from these primitives while keeping Astro as the main framework and Svelte limited to interactive islands.
