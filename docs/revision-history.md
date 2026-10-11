# Content revision history (Phase 17)

The Now, Projects, Notes, and Lab editors show saved versions beneath the editor. Each successful content mutation records the resulting validated row in `content_revisions` in the same SQLite transaction as the change. Project visibility, featuring, archive, and restore actions are included. Imported and preexisting records receive a baseline version.

Restoring a version copies its content fields into the live row, writes a new snapshot that points to the restored revision, and adds an audit event. Restore requests are owner-authenticated, same-origin, and bound to a revision with the same content type and record ID. Slug collisions make a restore fail without changing content.

Each record retains its 50 most recent revisions. Older versions are pruned as new snapshots are written. Snapshot previews show up to 5,000 characters of the body; the database retains the complete body. Revisions include the authored Markdown and therefore belong in the same protected backups as the content tables.

This is full-snapshot history, not a text diff. Media files are not part of this phase. Source-controlled MDX remains available for rollback to the MDX source.
