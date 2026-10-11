# Historical content baseline for the private editor

**Current status:** The ten starter Project, Note, and Lab entries listed below were removed from the source collections and local SQLite records. This document records the earlier import phase; it is not an inventory of currently published content. Historical database backups were retained. New content is authored through `/user`, and the public homepage shows published entries marked Featured when their sections are enabled.

Captured for Phase 13 from the working tree at commit `8d6811d`. This is an archival record of the original sources, not a live content inventory or an instruction to reimport them.

## Public content and routes

| Area     | Former source                | Public route       | Former entries                                                                   |
| -------- | ---------------------------- | ------------------ | -------------------------------------------------------------------------------- |
| Projects | `src/content/projects/*.mdx` | `/projects/[slug]` | `aulert`, `cspams`, `gamon-site`, `tokumako`                                     |
| Notes    | `src/content/notes/*.mdx`    | `/notes/[slug]`    | `building-angefolio`, `cspams-system-design-lessons`, `gentoo-development-setup` |
| Lab      | `src/content/lab/*.mdx`      | `/lab/[slug]`      | `ai-persona-concepts`, `svelte-ui-experiments`, `terminal-setups`                |

All ten entries had their public flag enabled at the time of this snapshot. Their source files and local database records have since been cleared. The collection schemas in `src/content/config.ts` still define the available fields.

The homepage combines several sources. `src/lib/data/site.ts` holds identity, contact, social image, and SEO defaults. `src/lib/data/home.ts` holds the fallback Now list, stack groups, contact links, and LinkedIn link. `src/lib/data/homeProgress.ts` holds section labels. `src/pages/index.astro` contains the portrait path, introduction copy, layout, and terminal data. Published `now_status`, homepage settings, visible projects, and published notes can override parts of that page at request time. GitHub activity loads from the configured public profile and is cached server-side. Project and Note MDX remain rollback copies; Lab has its own public catalog.

`public/91889584.jpeg` is the current portrait. `public/og.png` and the two `angefolio_logo_dropcap_*.svg` files are other current assets. Any later media editor needs a path and backup policy before accepting uploads.

## Import contract for later phases

1. Keep these ten slugs and their URLs stable unless a redirect is deliberately added. Preserve body text, dates, visibility, featured state, order, and optional metadata; report missing fields and broken local links.
2. Map every field in `src/content/config.ts` before adding a destination table. The current project table is a metadata slice: it omits source `date`, `highlights`, and `cover`, and its body is stored plain text. It cannot yet replace the MDX files or detail routes.
3. Choose an authored body format before enabling visual editing. Markdown is the likely portable source; existing MDX must be reviewed for JSX/components before conversion. Rendered HTML must be sanitized and must never execute stored MDX or arbitrary code.
4. Build an idempotent dry-run import with a duplicate-slug/conflict report. Take a file snapshot and SQLite backup before any write, then compare the ten detail routes, homepage cards, RSS, sitemap, and search results before and after cutover.
5. Keep a single source of truth per area during migration. MDX remains the public source for Notes and Lab until each record is deliberately switched in the editor. Database project metadata remains a separate public-card source; no automatic sync is implied.

Phase 14 moved the private workspace to `/user` and imported the four local project entries into SQLite after a verified backup. Those MDX files remain on disk as rollback copies. Project cutover behavior is recorded in [project-publishing.md](./project-publishing.md). Authentication, not obscurity, controls access.

Phase 15 added a verified Notes import and database source selection. Three note records are present in the local SQLite database; MDX remains active until each record is deliberately selected. The current boundary is documented in [note-publishing.md](./note-publishing.md).

Phase 16 adds controlled source selection to Lab. Three records are imported into the local SQLite database after a dry run and verified backup; MDX remains selected until each record is deliberately switched. See [lab-publishing.md](./lab-publishing.md).

Phase 25 adds a separate database-backed Blog for longer articles. It has no MDX import or migration of existing Notes: Notes remain short learning entries, Lab remains experiments, and Blog posts are authored directly at `/user/blog`. See [blog-publishing.md](./blog-publishing.md).

Phase 17 adds saved-version history and restore for all four editor areas. Baseline snapshots were added for existing database records when the migration ran; the latest 50 versions are retained per record.
