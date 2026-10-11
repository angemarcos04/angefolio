# Deploy angefolio on Render

This repository includes a Render Blueprint at [`render.yaml`](../render.yaml). It defines one Docker web service with a persistent disk at `/app/data`, where SQLite stores the owner account, sessions, authored content, revisions, and project images. Review the paid compute plan, 5 GB disk, and Singapore region before creating the service. The region cannot be changed later, and the disk cannot be made smaller. Automatic deploys are off in the Blueprint so later Git pushes do not publish by themselves.

The Free web service is unsuitable for the current writer workspace: its local filesystem is lost on restart or redeploy, and Free services cannot attach a persistent disk. The app also needs a Node server, so it cannot be deployed as a static site.

## Before creating the service

1. Review the public copy and images in the repository. A fresh Render disk starts without the local owner account or locally authored content; ignored local database files are not part of Git or the Docker image.
2. Keep a strong owner password in a password manager. The Blueprint creates a stable random `AUTH_SECRET` in Render; do not replace it casually because changing it signs out existing sessions.
3. If you want a custom domain immediately, add `PUBLIC_SITE_URL` with its full HTTPS origin to the service environment before the first build. Otherwise the site uses Render's `RENDER_EXTERNAL_URL` for generated links and authentication. You can set a custom domain later and redeploy.

## Create and check the service

1. In the Render Dashboard, create a **Blueprint** from this GitHub repository and review the resources in `render.yaml` before approving the paid service and disk. This does not happen when the file is merely committed to Git.
2. Allow the first deploy. Render builds the existing Dockerfile, mounts `/app/data`, and runs committed Drizzle migrations during container startup. Do not move migrations into a Render pre-deploy command: Render does not expose the attached disk there.
3. Open `/health/ready` on the new service URL. It must return HTTP 200 with `{"status":"ready"}` before using `/user`. A failed check means the application or its SQLite migration is not ready; inspect Render logs.
4. Open the public homepage and `/user/login`. The sign-in form is expected, but there is no account until the one-time bootstrap below.

Render supplies the port through the Blueprint as `4321`, matching the Docker health probe. The container binds to `0.0.0.0`. The database URL is `file:/app/data/angefolio.db`; only `/app/data` persists across deploys.

## Create the owner account once

Open the running web service's **Shell** in Render and run:

```sh
cd /app
./node_modules/.bin/tsx scripts/create-admin.ts
```

The command asks for the owner email and a password twice without echoing the password. The email is the sign-in identifier; no email delivery service is required for normal sign-in. The account and password hash are stored in SQLite on the persistent disk. Public sign-up is disabled, and the bootstrap refuses to create a second account. Do not place `ADMIN_EMAIL` or `ADMIN_PASSWORD` in the Blueprint or permanent Render environment settings.

If the password is lost, use the Render Shell and run `./node_modules/.bin/tsx scripts/recover-owner.ts`. It prompts for the exact owner email and a new password and revokes existing sessions. There is no email-based reset flow. See [operations.md](operations.md) for recovery details.

## Custom domain and ongoing deploys

When you attach a custom domain, set `PUBLIC_SITE_URL` in Render to its HTTPS origin and redeploy. This value is used at build time for the sitemap, robots file, and canonical links, and at runtime for auth and public links. Use the custom domain for owner sign-in. Render's `onrender.com` origin remains in the trusted-origin list; add `AUTH_TRUSTED_ORIGIN` only when another browser origin also needs to be trusted. Use the final domain to verify the homepage, `/user/login`, a published article, RSS, and the sitemap.

The Blueprint leaves automatic deploys off. Trigger later deploys manually from Render after reviewing changes. SQLite migrations run at container startup against the attached disk. A persistent disk limits this service to one instance and causes a short interruption during redeploys.

## Backups

Render's disk snapshots are useful for infrastructure recovery, but use SQLite's verified snapshot command before relying on authored content. In the service Shell, create a new file under the disk and verify it:

```sh
mkdir -p /app/data/backups
node scripts/db-maintenance.mjs backup /app/data/backups/angefolio-YYYYMMDD.sqlite
node scripts/db-maintenance.mjs verify /app/data/backups/angefolio-YYYYMMDD.sqlite
```

Replace `YYYYMMDD` with a date and use a new filename each time. Transfer the verified snapshot off Render and keep it in protected storage; a backup on the same disk alone does not protect against losing that disk. The existing encrypted `age`/`rclone` backup job is configured for Docker Compose with a host timer. It is **not** scheduled by this Render Blueprint, and Render cron jobs cannot access the web service's attached disk. Follow [operations.md](operations.md) for the restore procedure and rehearse it before depending on live edits.

## References

- [Render Blueprint specification](https://render.com/docs/blueprint-spec)
- [Render persistent disks](https://render.com/docs/disks)
- [Render default environment variables](https://render.com/docs/environment-variables)
- [Render health checks](https://render.com/docs/health-checks)
- [Render Free service limitations](https://render.com/docs/free)
