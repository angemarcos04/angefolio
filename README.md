# angefolio

The personal developer portfolio of **Angellie Marcos**, an Information Technology student building practical web systems with a Linux-minded, creative edge.

This repository is currently in **Phase 1: project setup and foundation**. It establishes the technical baseline and a small four-card preview without building the final homepage, content experience, database, authentication, or admin tools.

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

Open `http://localhost:4321`. Stop it with:

```bash
docker compose down
```

The container is named `angefolio` and uses `unless-stopped`. Phase 1 has no database volumes or secrets.

## Folder structure

```text
src/
├── components/
│   ├── astro/       # Layout and reusable presentation primitives
│   └── svelte/      # Small interactive islands and future stubs
├── content/
│   ├── projects/    # Starter project entries
│   ├── notes/       # Starter build note
│   ├── lab/         # Starter experiment entry
│   └── config.ts    # Typed collection schemas
├── lib/
│   ├── data/        # Shared site identity
│   └── utils/       # Shared helpers
├── pages/
│   └── index.astro  # Minimal Phase 1 preview
└── styles/
    └── global.css   # Tailwind entry and theme variables
```

## Roadmap

- **Phase 2:** Design system
- **Phase 3:** Static bento homepage
- **Phase 4:** Content collections and content pages
- **Phase 5:** Projects section
- **Phase 6:** Notes/blog
- **Phase 7:** Lab
- **Phase 8:** Search, SEO, and polish
- **Phase 9:** Docker hardening
- **Phase 10+:** Private `/console` planning and CMS work

The private `/console` dashboard is planned but **not implemented in Phase 1**. There is currently no database, authentication, Node adapter, admin route, or CMS.
