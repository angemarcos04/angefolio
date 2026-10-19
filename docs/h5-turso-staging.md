# H5 Turso staging verification

`pnpm test:turso` is an opt-in integration suite. It is not part of ordinary
pull-request CI. It exercises only a separately authorized **libSQL** database;
never point it at angefolio production.

## One-time staging setup

1. Create a separate Turso libSQL database on an account with available free
   quota. Do not use `--tursodb`. Do not copy production data into it.
2. Create a dedicated database token and a synthetic owner address ending in
   `@example.test`. Store the token and password outside the repository.
3. In the staging database only, create an identity marker with a unique random
   value. This is deliberately outside application migrations:

   ```sql
   CREATE TABLE h5_staging_identity (database_id TEXT PRIMARY KEY);
   INSERT INTO h5_staging_identity (database_id) VALUES ('<random-identity>');
   ```

4. Set these variables in a private shell session:

   ```text
   TURSO_INTEGRATION_TEST=1
   TEST_TURSO_DATABASE_URL=libsql://<staging-host>.turso.io
   TEST_TURSO_AUTH_TOKEN=<staging-only-token>
   TEST_TURSO_EXPECTED_HOST=<staging-host>.turso.io
   TEST_TURSO_DATABASE_ID=<random-identity>
   TEST_TURSO_CONFIRM_DATABASE_ID=<same-random-identity>
   TEST_TURSO_OWNER_EMAIL=h5-owner@example.test
   TEST_TURSO_OWNER_PASSWORD=<synthetic-staging-password>
   PRODUCTION_DATABASE_URL=libsql://<production-host>.turso.io
   ```

   `DATABASE_URL` may also be present; the gate rejects a staging host that
   matches it. Never reuse production credentials as staging variables.

5. Build the current working tree, then run:

   ```sh
   pnpm build
   pnpm test:turso
   ```

The gate validates opt-in, URL scheme, exact host, explicit identity
confirmation, and synthetic owner configuration before connecting. It then
checks the marker with a read-only query before any migration or test write.
Missing or mismatched configuration causes a `BLOCKED` failure. The child
server receives only the staging URL/token and a local HTTP origin.

The suite creates small synthetic fixtures with a unique run prefix. Normal
completion removes those content, history, redirect, media, and singleton
setting fixtures and closes staging sessions. It retains the synthetic owner
for repeat runs. A killed process may leave fixtures behind; inspect the
reported run prefix and remove only verified rows belonging to that run after
rechecking the identity marker. Do not run table-wide cleanup.

The staging token can be short lived. Replace an expired token in your private
shell configuration; do not commit it or paste it into reports.
