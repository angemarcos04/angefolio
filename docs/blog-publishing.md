# Blog publishing (Phase 25)

Blog is a database-backed writing area for longer articles, tutorials, and reflections. It is distinct from Notes, which hold shorter learning entries, and Lab, which tracks experiments. New posts are authored directly in `/user/blog`; no existing Notes or MDX content is copied into Blog.

## Public routes

- `/blog` lists published, unarchived posts newest first.
- `/blog/[slug]` renders the sanitized Markdown article and publication metadata.
- `/blog/rss.xml` contains the Blog feed. `/rss.xml` remains the Notes feed.
- `/sitemap-blog.xml` lists only current published post URLs, and `robots.txt` advertises it.
- `/api/search/blog` returns only published, unarchived posts.

## Private editor

Use `/user/blog` to create and manage posts. The editor supports Markdown with a private preview, title, URL slug, description, optional short summary, category, tags, publication date, featured state, and publication state. Published slug changes create permanent redirects. Up to 50 saved versions are available to restore.

Unpublished posts stay private. Archiving keeps a post in the editor and its revision history but removes it from the archive, detail route, search, RSS, and sitemap. There is no hard delete. Saves require an authenticated owner session, a same-origin request, and validated fields.

The `blog_records` table is the single source of truth. Markdown renders through the shared sanitized renderer; stored MDX and arbitrary HTML are never executed.
