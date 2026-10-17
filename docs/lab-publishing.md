# Lab publishing (Phase 16)

**Current status:** The original starter Lab entries were removed from source and the local database. The import and MDX rollback steps below apply only to future matching MDX content. Historical database backups remain available.

The private Lab editor is at `/user/lab`. It manages each experiment's status, category, tags, visibility, featured marker, repository/demo/related project links, tools, lessons, risk, logged date, updated date, and Markdown body. Preview uses the authenticated sanitized renderer.

## Source selection

Existing entries can stay in `src/content/lab/` as rollback copies. `pnpm lab:import` is a dry run; if this optional directory is absent, it reports zero source entries. Apply with `--apply --backup <new-file>` requires at least one valid `.md` or `.mdx` file, refuses missing or empty directories before backup/database writes, and makes a verified SQLite backup before writing records. Other filesystem and source-validation errors remain failures. Imported records leave `replaces_mdx` off, so MDX stays public until you select “Use this record for the public page.” Hidden adopted entries suppress the old MDX page too. Dry runs do not import or modify content records.

Public archive grouping, details, search, and `/sitemap-lab.xml` read the same visible catalog. Public pages fail closed if the database cannot be read because an adopted entry might otherwise reappear after being hidden. Lab entries do not have an RSS feed.

Historical slug aliases redirect with a noncached 302 only while the owning Lab entry is selected by the public catalog. Hidden entries and inactive database replacements return a noncached 404 through their old aliases; their redirect records remain available if visibility is restored.

There is no hard delete or revision history yet. Source files remain available for rollback; switch a matching record back to MDX in the editor when needed.

The shared Markdown editor can upload JPEG, PNG, or WebP images (up to 8 MB) and insert normal Markdown image syntax. Images use the authenticated media pipeline, are processed to WebP, and remain in SQLite; public Markdown rendering sanitizes image sources and attributes.
The Lab editor includes an optional experiment-note starter and private page
preview. **Preview Markdown** shows only the notes body; **Preview Page** shows
the current unsaved entry presentation. Saving still uses the existing server
validation and visibility controls, and unsaved work triggers a leave-page
warning.
