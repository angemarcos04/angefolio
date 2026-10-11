# Lab publishing (Phase 16)

The private Lab editor is at `/user/lab`. It manages each experiment's status, category, tags, visibility, featured marker, repository/demo/related project links, tools, lessons, risk, logged date, updated date, and Markdown body. Preview uses the authenticated sanitized renderer.

## Source selection

Existing entries stay in `src/content/lab/` as rollback copies. `pnpm lab:import` is a dry run; apply with `--apply --backup <new-file>` to make a verified SQLite backup before writing records. Imported records leave `replaces_mdx` off, so MDX stays public until you select “Use this record for the public page.” Hidden adopted entries suppress the old MDX page too.

Public archive grouping, details, search, and `/sitemap-lab.xml` read the same visible catalog. Public pages fail closed if the database cannot be read because an adopted entry might otherwise reappear after being hidden. Lab entries do not have an RSS feed.

There is no hard delete or revision history yet. Source files remain available for rollback; switch a matching record back to MDX in the editor when needed.
