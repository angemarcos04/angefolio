# Note publishing (Phase 15)

**Current status:** The original starter Notes were removed from source and the local database. The import and MDX rollback steps below apply only to future matching MDX content. Historical database backups remain available.

The private Notes editor is at `/user/notes`. It stores Markdown, metadata, tags, publication state, and featured state in SQLite. Preview uses the same authenticated sanitized renderer as project writing.

## Source selection

Notes can remain in `src/content/notes/` as rollback copies. `pnpm notes:import` is a dry run; if this optional directory is absent, it reports zero source Notes. Apply with `--apply --backup <new-file>` requires at least one valid `.md` or `.mdx` file, refuses missing or empty directories before backup/database writes, and creates a verified SQLite backup before import. Other filesystem and source-validation errors remain failures. Imported records leave `replaces_mdx` off, so MDX remains the public source. In the editor, selecting “Use this record for the public page” switches that slug to its database version. The database version only appears publicly when it is also published and has a body. Unpublishing an adopted record suppresses the old MDX version as well. Dry runs do not import or modify content records.

Database-only notes can be authored with a new slug. Public archive, detail pages, search, RSS, and `/sitemap-notes.xml` use the same catalog and only expose published notes. If the database is unavailable, the catalog fails closed because it cannot know whether an MDX note has been adopted and hidden.

Historical slug aliases redirect with a noncached 302 only when the alias still belongs to a Note selected by the public catalog. Unpublished Notes and inactive database replacements return a noncached 404 through their old aliases; alias records remain so republication can restore them.

There is no hard delete or revision history yet. Back up the database before relying on edits in a deployed volume. The source files stay untouched and can be used to switch a note back to MDX.

The shared Markdown editor can upload JPEG, PNG, or WebP images (up to 8 MB) and insert normal Markdown image syntax. Images use the authenticated `/api/console/media/upload` endpoint, are resized/converted to WebP, and are stored in SQLite. Markdown sanitization allows safe uploaded media, safe static images, and HTTPS image sources.
The Notes editor includes an optional Markdown starter and private page preview.
Use **Preview Markdown** for the body alone or **Preview Page** to review the
current title, metadata, and body before saving. Draft edits are protected by a
leave-page warning and remain in the editor after server validation errors.
