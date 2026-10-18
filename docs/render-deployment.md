# Deploy angefolio on Render Free with Turso

The [`render.yaml`](../render.yaml) Blueprint defines one Docker web service on the Free plan. Auth, sessions, authored content, revisions, and images live in a Turso **libSQL** database. The web service has no persistent disk. Automatic deploys are off.

## Before creating the service

1. Confirm that any older Render disk contains no content to preserve. Removing a disk or replacing its service loses its local SQLite database. If an older service has a disk, create a new Free service and retire the old one only after verification.
2. Install and log in to the [Turso CLI](https://github.com/tursodatabase/turso-cli), then create a libSQL database: `turso db create angefolio`. Do not pass `--tursodb`; this app uses `@libsql/client`.
3. Get the database URL with `turso db show angefolio --url`, and create a token with `turso db tokens create angefolio`. Keep the token in a private file or password manager, outside Git.
4. Apply the committed migration history from your trusted machine with `DATABASE_URL` set to the Turso URL and `TURSO_AUTH_TOKEN` set to the token: `pnpm db:migrate`. Confirm all 13 migrations are present before bootstrapping the owner.

## Create the Free service

Create a new Render Blueprint from this repository and review the service before deploying. On the initial Blueprint setup, enter:

- `DATABASE_URL`: the `libsql://...` URL from Turso.
- `TURSO_AUTH_TOKEN`: the private database token.
- `PUBLIC_SITE_URL`: the actual HTTPS origin of the new Render service, or its custom domain.

The Blueprint generates `AUTH_SECRET` and sets `PORT=4321`. Its Docker startup applies any pending committed migrations before starting Astro. `/health/ready` must return HTTP 200 with `{"status":"ready"}`. Check the Render logs if it returns 503.

For an **existing** Blueprint, Render ignores `sync: false` variables on later syncs and preserves older environment values omitted from the YAML. Set or replace `DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `PUBLIC_SITE_URL` manually in the Dashboard. Check that `DATABASE_URL` no longer points at `file:/app/data/angefolio.db`. A Free service cannot use a persistent disk.

## Bootstrap the owner

Run `pnpm console:bootstrap` once on your trusted computer with `DATABASE_URL`, `TURSO_AUTH_TOKEN`, a local `AUTH_SECRET` of at least 32 random characters, and `PUBLIC_SITE_URL` set to the deployed origin. The script prompts for the email and password without displaying the password. The bootstrap secret can differ from Render's generated `AUTH_SECRET`; no browser session is created by the script. Do not put `ADMIN_EMAIL` or `ADMIN_PASSWORD` in Render or Git.

Public sign-up remains disabled. The bootstrap refuses to create a second owner. For password recovery, run `pnpm console:recover` from the trusted computer with the same database connection values and a suitable `AUTH_SECRET`.

## Verify the workspace

After a manual deploy, check `/health/ready`, then `/user/login`. Sign in, create and publish a private draft, upload an image, restore a revision, and verify the public view and historical slug redirect. Restart the Render service and confirm the account, content, and image remain. Use the deployed HTTPS origin for all browser tests.

## Back up Turso

On your trusted computer, while logged in to the Turso CLI, run:

```sh
pnpm db:backup:turso angefolio /secure/backups/angefolio-YYYYMMDD.sqlite
node scripts/db-maintenance.mjs verify /secure/backups/angefolio-YYYYMMDD.sqlite
```

Use a new filename each time. The backup command exports Turso's SQLite snapshot and WAL, folds them into one SQLite file, and verifies its integrity and required tables. Store that file in protected off-machine storage and rehearse a restore to a **new** Turso database with `turso db create <new-name> --from-file /secure/backups/angefolio-YYYYMMDD.sqlite`. Point a test process at the new database and confirm `/health/ready` and content before considering a production cutover. The existing local SQLite `db:backup` command and Docker Compose age/rclone job still serve local volume deployments; they do not export Turso.

## References

- [Turso CLI](https://github.com/tursodatabase/turso-cli)
- [Render Blueprint specification](https://render.com/docs/blueprint-spec)
- [Render Free service limitations](https://render.com/docs/free)
