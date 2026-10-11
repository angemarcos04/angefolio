# Project publishing (Phase 14)

**Current status:** The original starter projects were removed from source and the local database. The import and MDX rollback steps below describe the historical workflow and apply only when matching MDX content exists. Historical database backups remain available.

The owner workspace is `/user`. It is absent from public navigation, marked `noindex`, omitted from Pagefind and the sitemap, and protected by server sessions. The write endpoints remain under `/api/console/*`; their path names do not grant access.

## Sources and cutover

Future case studies can be stored in `src/content/projects/*.mdx` as rollback copies. A project record can hold the same slug, complete metadata, and a Markdown body. The `replaces_mdx` switch chooses that record as the public source for the slug. Until the switch is on, matching MDX supplies the card and detail page. Database-only records can appear when visible. Hiding or archiving an adopted record suppresses the matching MDX page as well.

Run the committed migrations and inspect the import before writing:

```bash
pnpm db:migrate
pnpm projects:import
pnpm projects:import --apply --backup /path/to/new-backup.sqlite
```

The import refuses any slug conflict and takes a verified SQLite backup before inserting. It maps current title, description, status, date, featured/visible state, stack, links, category, role, problem, solution, highlights, cover, order, and body. It rejects source MDX components, unsupported `caseStudy` links, and internal-link metadata for manual review. Import never rewrites or deletes the source files. Repeating an import reports conflicts and makes no changes.

After import, compare the four `/projects/[slug]` pages, `/projects`, the homepage, `/api/search/projects`, and `/sitemap-projects.xml`. Project details now render on demand. Database Markdown is sanitized before it enters HTML; the private preview uses the same renderer. New project edits appear without rebuilding. Search combines live project results with Pagefind's build-time index for Notes, Lab, and other static pages. Robots advertises the dynamic project sitemap alongside the static sitemap.

## Editing and rollback

The project editor offers bold, italic, heading, list, and link controls over portable Markdown source, plus a private preview. It does not execute MDX or arbitrary HTML. Public replacement requires a nonempty body. Changing an adopted public slug creates a redirect to the new URL; see [console-plan.md](./console-plan.md#phase-20-slug-redirects).

To roll back one project, uncheck **Use this record instead of matching MDX content** and save. The MDX page becomes public again. To recover the entire database, follow [operations.md](./operations.md) using the backup made before import. If the database is unavailable, project queries return no entries because old MDX could otherwise reveal work that was hidden after cutover. Notes and Lab remain independent static content.

Projects support cover uploads, revision restore, and slug redirects. The same workspace also manages Notes, Lab, homepage settings, and public site settings. An encrypted off-host backup job is available; configure its remote, secrets, timer, and storage retention by following [operations.md](./operations.md).
