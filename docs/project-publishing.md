# Project publishing (Phase 14)

**Current status:** The original starter projects were removed from source and the local database. The import and MDX rollback steps below describe the historical workflow and apply only when matching MDX content exists. Historical database backups remain available.

The owner workspace is `/user`. It is absent from public navigation, marked `noindex`, omitted from Pagefind and the sitemap, and protected by server sessions. The write endpoints remain under `/api/console/*`; their path names do not grant access.

## Sources and cutover

Future case studies can be stored in `src/content/projects/*.mdx` as rollback copies. A project record can hold the same slug, complete metadata, and a Markdown body. The `replaces_mdx` switch chooses that record as the public source for the slug. Until the switch is on, matching MDX supplies the card and detail page. Database-only records can appear when visible. Hiding or archiving an adopted record suppresses the matching MDX page as well.

Every visible, non-archived project returned by the public catalog has a canonical `/projects/[slug]` page. Database-only projects without a case-study body render a Project Overview from their available metadata, links, and optional problem, solution, and highlights fields. Adding a Markdown body switches the same URL to the Full Project Case Study presentation; removing it returns an eligible database-only project to its overview without changing its slug. No template-mode field is stored. The public route resolves projects only through the authorized catalog, which continues to exclude hidden, archived, and redirect-alias records.

The stricter replacement rule remains in place: a visible database record replacing a matching MDX project must have a case-study body. Source selection and rollback behavior are unchanged, so an adopted MDX case study cannot be unintentionally replaced with an empty overview.

Run the committed migrations and inspect the import before writing:

```bash
pnpm db:migrate
pnpm projects:import
pnpm projects:import --apply --backup /path/to/new-backup.sqlite
```

The legacy MDX directory is optional for a dry run: if it is absent, the command reports zero source projects. An apply operation requires at least one valid `.md` or `.mdx` file and refuses a missing or empty directory before creating a backup or writing to the database. Other filesystem and source-validation errors remain failures. Apply requires a new backup path, refuses any slug conflict, and takes a verified SQLite backup before inserting. It maps current title, description, status, date, featured/visible state, stack, links, category, role, problem, solution, highlights, cover, order, and body. It rejects source MDX components, unsupported `caseStudy` links, and internal-link metadata for manual review. Import never rewrites or deletes the source files. Repeating an import reports conflicts and makes no changes. Dry runs do not import or modify content records.

After import, compare the `/projects/[slug]` pages, `/projects`, the homepage, `/api/search/projects`, and `/sitemap-projects.xml`. Project details render on demand. Database Markdown is sanitized before it enters HTML; the private preview uses the same renderer. New project edits appear without rebuilding. Search combines live project results with Pagefind's build-time index for Notes, Lab, and other static pages. Robots advertises the dynamic project sitemap alongside the static sitemap.

## Editing and rollback

The project editor offers bold, italic, heading, list, and link controls over portable Markdown source, plus a private preview. It does not execute MDX or arbitrary HTML. Public replacement requires a nonempty body. Changing a public database-backed slug creates a historical alias. The alias redirects with a noncached 302 only while its owning project remains in the public catalog; hidden or archived aliases return a noncached 404. See [console-plan.md](./console-plan.md#phase-20-slug-redirects).

To roll back one project, uncheck **Use this record instead of matching MDX content** and save. The MDX page becomes public again. To recover the entire database, follow [operations.md](./operations.md) using the backup made before import. If the database is unavailable, project queries return no entries because old MDX could otherwise reveal work that was hidden after cutover. Notes and Lab remain independent static content.

Projects support cover uploads, up to eight ordered screenshots with alt text and optional captions, inline Markdown image uploads, revision restore, and slug redirects. Removing a screenshot or cover reference does not delete the stored media. Existing image uploads are resized and converted to WebP before they are stored in SQLite. The same workspace also manages Notes, Lab, homepage settings, and public site settings. An encrypted off-host backup job is available; configure its remote, secrets, timer, and storage retention by following [operations.md](./operations.md).
The project editor also offers an optional Markdown starter and a private
**Preview Page** using the current form values. Previewing does not save or
change visibility. Unsaved edits trigger a browser warning when leaving, and
server validation failures remain in the editor while JavaScript is enabled.
