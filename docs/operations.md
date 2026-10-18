# Database operations

For local Docker Compose, the Node server uses a persistent SQLite volume. In Docker, `DATABASE_URL=file:/app/data/angefolio.db` and `/app/data` is mounted. Keep the database and its WAL/SHM files on durable storage. Render Free uses Turso through `DATABASE_URL=libsql://...` and `TURSO_AUTH_TOKEN`; see [render-deployment.md](render-deployment.md) for remote deployment and backup steps. Set `PUBLIC_SITE_URL` and `AUTH_TRUSTED_ORIGIN` to the real HTTPS origin, and inject `AUTH_SECRET` as a server secret.

## Back up and verify

Run backups while the server is online with the SQLite `VACUUM INTO` operation. It creates a consistent copy, including committed WAL changes. The destination must be a new file and must be on a writable path:

```bash
DATABASE_URL=file:/app/data/angefolio.db node scripts/db-maintenance.mjs backup /app/data/backups/angefolio-YYYYMMDD.sqlite
node scripts/db-maintenance.mjs verify /app/data/backups/angefolio-YYYYMMDD.sqlite
```

For Compose, run the commands through `docker compose exec portfolio ...`; the mounted `/app/data` makes the backup visible outside the container through the volume. The `backup` Compose profile provides an automated encrypted off-host copy using `age` and `rclone`, without adding either tool or the remote credentials to the web service.

### Configure automated off-host copies

Choose an `age` recipient and configure an rclone remote on the host. Keep the age private identity offline or in a separate secure location; the server only needs the public recipient. Create `rclone.conf` with permissions `0600`, and set the following values in the deployment `.env` file:

```dotenv
BACKUP_REMOTE=remote-name:dedicated/angefolio
BACKUP_AGE_RECIPIENT=age1...
RCLONE_CONFIG_PATH=./rclone.conf
```

`BACKUP_REMOTE` must point to a dedicated destination directory. The one-shot backup container mounts the database volume so SQLite can open the live database and coordinate a consistent snapshot while the app is running. The script writes its snapshot and encrypted artifact only to `/tmp` (mounted as tmpfs), encrypts before upload, then checks the uploaded object size. Failures return a nonzero status so systemd records them. The script does not prune remote files; set a lifecycle/retention rule in the selected storage provider after choosing the desired retention period.

Build and run a one-time backup to confirm the host configuration:

```bash
docker compose --profile backup build backup
docker compose --profile backup run --rm backup
```

The included systemd timer runs daily around 03:30 with a randomized delay. Copy `deploy/angefolio-backup.service` and `deploy/angefolio-backup.timer` into `/etc/systemd/system/`, adjust `WorkingDirectory` if the checkout is elsewhere, then enable the timer:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now angefolio-backup.timer
systemctl list-timers angefolio-backup.timer
```

Review the last job with `journalctl -u angefolio-backup.service`. A successful upload still needs periodic restore rehearsals. Run `node --test tests/offsite-backup.test.mjs` to exercise snapshot, encryption, upload, size-check, cleanup, and missing-configuration paths with local command stand-ins; it does not test a production remote.

To restore, download one encrypted object with `rclone copyto`, decrypt it on a trusted machine with the private age identity, then verify the SQLite file before using the restore procedure below:

```bash
rclone copyto remote-name:dedicated/angefolio/angefolio-<timestamp>.sqlite.age ./backup.sqlite.age
age -d -i /secure/offline/angefolio.agekey -o ./backup.sqlite ./backup.sqlite.age
node scripts/db-maintenance.mjs verify ./backup.sqlite
```

## Restore rehearsal or recovery

The restore command first verifies the source and copies it to a **new** file. It refuses to overwrite the destination or existing WAL/SHM peers:

```bash
node scripts/db-maintenance.mjs restore /path/to/backup.sqlite /path/to/rehearsal.sqlite
node scripts/db-maintenance.mjs verify /path/to/rehearsal.sqlite
```

For live recovery, stop the app, keep the old database and its `-wal`/`-shm` files together as a rollback copy, then restore a verified backup to an empty path. Point `DATABASE_URL` at that new file, run committed migrations, and start the app. Check login, Now, project lists, and public routes before removing the rollback copy. Never replace a running database with `cp`; that can discard committed WAL data.

The integration test creates a separate database, exercises writes, backs it up, restores the copy, and checks retained audit rows. It does not test an actual production volume or off-host copy.

## Account and secret recovery

Keep the owner password and `AUTH_SECRET` in a password manager. Changing `AUTH_SECRET` invalidates existing signed cookies; plan to sign in again after rotating it. Keep the previous secret only for a controlled rollback window, then remove it. `console:bootstrap` refuses to create a second owner, and there is no password-reset email or recovery UI. For a lost password, run the interactive one-owner recovery command from the trusted host or container:

```bash
pnpm console:recover
# or, in Compose:
docker compose exec --interactive --tty portfolio pnpm console:recover
```

It prompts for the exact owner email and a new password without echoing the password. It refuses to run unless the database contains exactly one user matching that email and an existing Better Auth credential account. It uses Better Auth's configured password hasher and internal adapter, revokes every existing session, and writes an audit event. Keep `AUTH_SECRET` and `DATABASE_URL` configured for the command. Do not pass the password as an argument or store it in shell history. Do not manually edit password hashes or enable public sign-up.

The container health probe requests `/health/ready`. The endpoint returns `200 {"status":"ready"}` only when the database answers a query and the latest migration in the shipped Drizzle journal is applied. It returns `503 {"status":"not_ready"}` for database or migration failures, with no internal details in the response. It does not run migrations; startup or the deployment process must apply them first. The endpoint sends `Cache-Control: no-store`.

## Media and Phase 3 schema changes

Project screenshots and optional Blog covers reference existing media assets; image bytes remain in the SQLite `media_assets` table. Uploads accept static JPEG, PNG, or WebP up to 8 MB, then Sharp processes them into WebP (up to 2 MB) before storage. Removing a content reference does not delete media. Historical revisions may still reference an image, and this release intentionally does not perform orphan cleanup.

Phase 3 adds nullable `blog_records.cover` and default-empty `project_records.screenshots_json` columns through the additive `0012_giant_chimera.sql` migration. Back up the persistent database, apply committed migrations through the normal deployment process, then verify the migration and public media routes. Existing Blog rows have no cover and existing projects receive an empty screenshot list. This change has not been applied to production automatically.
