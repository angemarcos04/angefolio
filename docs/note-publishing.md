# Note publishing (Phase 15)

**Current status:** The original starter Notes were removed from source and the local database. The import and MDX rollback steps below apply only to future matching MDX content. Historical database backups remain available.

The private Notes editor is at `/user/notes`. It stores Markdown, metadata, tags, publication state, and featured state in SQLite. Preview uses the same authenticated sanitized renderer as project writing.

## Source selection

Notes remain in `src/content/notes/` as rollback copies. `pnpm notes:import` is a dry run; apply with `--apply --backup <new-file>` to create a verified SQLite backup and import records. Imported records leave `replaces_mdx` off, so MDX remains the public source. In the editor, selecting “Use this record for the public page” switches that slug to its database version. The database version only appears publicly when it is also published and has a body. Unpublishing an adopted record suppresses the old MDX version as well.

Database-only notes can be authored with a new slug. Public archive, detail pages, search, RSS, and `/sitemap-notes.xml` use the same catalog and only expose published notes. If the database is unavailable, the catalog fails closed because it cannot know whether an MDX note has been adopted and hidden.

There is no hard delete or revision history yet. Back up the database before relying on edits in a deployed volume. The source files stay untouched and can be used to switch a note back to MDX.
