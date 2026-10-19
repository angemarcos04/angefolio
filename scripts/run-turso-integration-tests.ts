import assert from 'node:assert/strict';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { createClient } from '@libsql/client';
import { readStagingConfig, verifyStagingIdentity } from './turso-test-gate';

const execFileAsync = promisify(execFile);
const cwd = resolve(import.meta.dirname, '..');
const config = readStagingConfig(process.env);
await verifyStagingIdentity(config);
const runId = `h5-${randomBytes(5).toString('hex')}`;
const database = createClient({ url: config.url, authToken: config.token });

async function freePort(): Promise<number> {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  return address.port;
}

function childEnvironment(origin: string, port: number): NodeJS.ProcessEnv {
  // No inherited DATABASE_URL, production token, owner password, or .env path.
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    LANG: process.env.LANG,
    DOTENV_CONFIG_PATH: '/dev/null',
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: String(port),
    DATABASE_URL: config.url,
    TURSO_AUTH_TOKEN: config.token,
    AUTH_SECRET: randomBytes(32).toString('hex'),
    PUBLIC_SITE_URL: origin,
    AUTH_TRUSTED_ORIGIN: origin,
    ADMIN_EMAIL: config.ownerEmail,
    ADMIN_PASSWORD: config.ownerPassword,
  };
}

function formRequest(
  origin: string,
  path: string,
  fields: Record<string, string>,
  cookie?: string,
  requestOrigin = origin,
) {
  return fetch(`${origin}${path}`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      origin: requestOrigin,
      'content-type': 'application/x-www-form-urlencoded',
      ...(cookie ? { cookie } : {}),
    },
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(30_000),
  });
}

async function startServer(env: NodeJS.ProcessEnv, origin: string) {
  const server = spawn(process.execPath, ['dist/server/entry.mjs'], {
    cwd,
    env,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  // Keep diagnostics in memory; never print raw server output with secrets.
  let output = '';
  server.stderr?.on('data', (chunk) => {
    output = (output + String(chunk)).slice(-4000);
  });
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null)
      throw new Error('Staging server exited before it became ready.');
    try {
      const response = await fetch(`${origin}/health/ready`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.status === 200) return server;
    } catch {
      // Startup is still in progress.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  server.kill('SIGTERM');
  throw new Error(
    `Staging server did not become ready (${output ? 'server reported an error' : 'no response'}).`,
  );
}

async function stopServer(server: ChildProcess | undefined) {
  if (!server || server.exitCode !== null) return;
  server.kill('SIGTERM');
  await Promise.race([
    once(server, 'exit'),
    new Promise((resolveWait) => setTimeout(resolveWait, 5000)),
  ]);
  if (server.exitCode === null) server.kill('SIGKILL');
}

async function row(sql: string, args: Array<string | number> = []) {
  const result = await database.execute({ sql, args });
  return result.rows[0];
}

async function ownedRecord(table: string, slug: string) {
  assert(slug.startsWith(`${runId}-`));
  const result = await row(`SELECT id FROM ${table} WHERE slug = ?`, [slug]);
  const id = result?.id;
  assert(typeof id === 'string', `Expected a saved ${table} fixture.`);
  return id;
}

const ownedEntities: Array<{
  type: string;
  table: string;
  id: string;
  slug: string;
}> = [];
const ownedMedia: string[] = [];
const settingTables = [
  'homepage_settings',
  'site_settings',
  'now_status',
] as const;
const originalSettings = new Map<string, Record<string, unknown> | undefined>();
const previousSettingHistory = new Map<string, Set<string>>();

async function captureSettingBaseline() {
  for (const table of settingTables) {
    const existing = await row(`SELECT * FROM ${table} WHERE id = 'primary'`);
    originalSettings.set(table, existing ? { ...existing } : undefined);
  }
  for (const table of ['content_revisions', 'audit_log']) {
    const result = await database.execute({
      sql: `SELECT id FROM ${table} WHERE entity_type IN ('homepage_settings', 'site_settings', 'now_status')`,
      args: [],
    });
    previousSettingHistory.set(
      table,
      new Set(result.rows.map((item) => String(item.id))),
    );
  }
}

async function cleanUpSettings() {
  if (!originalSettings.size) return;
  for (const table of settingTables) {
    const current = await row(`SELECT * FROM ${table} WHERE id = 'primary'`);
    if (!current) continue;
    const marker =
      table === 'now_status' ? current.current_focus : current.settings_json;
    if (typeof marker !== 'string' || !marker.includes(runId)) continue;
    const original = originalSettings.get(table);
    if (!original) {
      await database.execute({
        sql: `DELETE FROM ${table} WHERE id = 'primary'`,
        args: [],
      });
    } else {
      const columns = Object.keys(original).filter((key) => key !== 'id');
      await database.execute({
        sql: `UPDATE ${table} SET ${columns.map((key) => `${key} = ?`).join(', ')} WHERE id = 'primary'`,
        args: columns.map((key) => original[key] as string | number | null),
      });
    }
  }
  for (const table of ['content_revisions', 'audit_log']) {
    const before = previousSettingHistory.get(table);
    if (!before) continue;
    const result = await database.execute({
      sql: `SELECT id FROM ${table} WHERE entity_type IN ('homepage_settings', 'site_settings', 'now_status')`,
      args: [],
    });
    for (const item of result.rows) {
      const id = String(item.id);
      if (!before.has(id))
        await database.execute({
          sql: `DELETE FROM ${table} WHERE id = ?`,
          args: [id],
        });
    }
  }
}

async function cleanUp() {
  await cleanUpSettings();
  for (const fixture of ownedEntities) {
    if (!fixture.slug.startsWith(`${runId}-`)) continue;
    const current = await row(
      `SELECT slug FROM ${fixture.table} WHERE id = ?`,
      [fixture.id],
    );
    if (!current || !String(current.slug).startsWith(`${runId}-`)) continue;
    for (const table of ['content_revisions', 'audit_log'])
      await database.execute({
        sql: `DELETE FROM ${table} WHERE entity_type = ? AND entity_id = ?`,
        args: [fixture.type, fixture.id],
      });
    for (const table of ['content_redirects', 'content_public_slugs'])
      await database.execute({
        sql: `DELETE FROM ${table} WHERE entity_type = ? AND entity_id = ?`,
        args: [fixture.type, fixture.id],
      });
    await database.execute({
      sql: `DELETE FROM ${fixture.table} WHERE id = ? AND slug LIKE ?`,
      args: [fixture.id, `${runId}-%`],
    });
  }
  for (const id of ownedMedia) {
    await database.execute({
      sql: "DELETE FROM audit_log WHERE entity_type = 'media' AND entity_id = ?",
      args: [id],
    });
    await database.execute({
      sql: 'DELETE FROM media_assets WHERE id = ?',
      args: [id],
    });
  }
  // The sole staging owner is synthetic and reserved for this suite.
  await database.execute({
    sql: 'DELETE FROM session WHERE user_id IN (SELECT id FROM user WHERE email = ?)',
    args: [config.ownerEmail],
  });
}

async function entityState(type: string, table: string, id: string) {
  const content = await database.execute({
    sql: `SELECT * FROM ${table} WHERE id = ?`,
    args: [id],
  });
  const related = await Promise.all(
    [
      'content_redirects',
      'content_public_slugs',
      'content_revisions',
      'audit_log',
    ].map(
      async (name) =>
        [
          name,
          (
            await database.execute({
              sql: `SELECT * FROM ${name} WHERE entity_type = ? AND entity_id = ? ORDER BY rowid`,
              args: [type, id],
            })
          ).rows,
        ] as const,
    ),
  );
  return { content: content.rows, related: Object.fromEntries(related) };
}

test('isolated remote Turso integration', { timeout: 240_000 }, async (t) => {
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const env = childEnvironment(origin, port);
  let server: ChildProcess | undefined;
  let cookie = '';
  try {
    await t.test(
      'identity, migration, readiness, and owner bootstrap',
      async () => {
        const existingTables = await database.execute(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user'",
        );
        if (existingTables.rows.length) {
          const owners = await database.execute('SELECT email FROM user');
          assert(
            owners.rows.every((owner) => owner.email === config.ownerEmail),
          );
        }
        await execFileAsync(
          './node_modules/.bin/tsx',
          ['scripts/create-admin.ts'],
          {
            cwd,
            env,
            timeout: 45_000,
          },
        );
        const migrations = await row(
          'SELECT count(*) AS total FROM "__drizzle_migrations"',
        );
        assert(Number(migrations?.total) > 0);
        await execFileAsync(
          './node_modules/.bin/tsx',
          ['scripts/create-admin.ts'],
          {
            cwd,
            env,
            timeout: 45_000,
          },
        );
        assert.equal(
          Number(
            (await row('SELECT count(*) AS total FROM "__drizzle_migrations"'))
              ?.total,
          ),
          Number(migrations?.total),
        );
        assert.equal(
          Number((await row('SELECT count(*) AS total FROM user'))?.total),
          1,
        );
        await assert.rejects(
          execFileAsync(
            './node_modules/.bin/tsx',
            ['scripts/create-admin.ts'],
            {
              cwd,
              env: { ...env, ADMIN_EMAIL: 'second-h5-owner@example.test' },
              timeout: 45_000,
            },
          ),
        );
        assert.equal(
          Number((await row('SELECT count(*) AS total FROM user'))?.total),
          1,
        );
        server = await startServer(env, origin);
        const ready = await fetch(`${origin}/health/ready`);
        assert.equal(ready.status, 200);
        assert.deepEqual(await ready.json(), { status: 'ready' });
      },
    );

    await t.test(
      'login, origin protection, private session, restart, and logout',
      async () => {
        assert.equal(
          (await fetch(`${origin}/user`, { redirect: 'manual' })).status,
          303,
        );
        const bad = await formRequest(origin, '/api/console/login', {
          email: config.ownerEmail,
          password: 'incorrect-staging-password',
        });
        assert.equal(bad.headers.get('location'), '/user/login?error=invalid');
        const untrusted = await formRequest(
          origin,
          '/api/console/login',
          { email: config.ownerEmail, password: config.ownerPassword },
          undefined,
          'https://untrusted.example',
        );
        assert.notEqual(untrusted.headers.get('location'), '/user');
        const login = await formRequest(origin, '/api/console/login', {
          email: config.ownerEmail,
          password: config.ownerPassword,
        });
        assert.equal(login.headers.get('location'), '/user');
        cookie = login.headers.get('set-cookie')?.split(';')[0] ?? '';
        assert(cookie);
        assert.equal(
          (await fetch(`${origin}/user`, { headers: { cookie } })).status,
          200,
        );
        await stopServer(server);
        server = await startServer(env, origin);
        assert.equal(
          (await fetch(`${origin}/user`, { headers: { cookie } })).status,
          200,
        );
        const signUp = await fetch(`${origin}/api/auth/sign-up/email`, {
          method: 'POST',
          headers: { origin, 'content-type': 'application/json' },
          body: JSON.stringify({
            name: 'Second owner',
            email: 'second-h5-owner@example.test',
            password: 'second-owner-password',
          }),
        });
        assert(signUp.status >= 400);
      },
    );

    await t.test(
      'invalid remote credentials fail closed without local fallback',
      async () => {
        const invalid = createClient({
          url: config.url,
          authToken: 'invalid-h5-token',
        });
        try {
          await assert.rejects(invalid.execute('SELECT 1 AS ready'));
        } finally {
          invalid.close();
        }
        const unreachable = createClient({
          url: 'libsql://127.0.0.1:1',
          authToken: 'invalid-h5-token',
        });
        try {
          await assert.rejects(unreachable.execute('SELECT 1 AS ready'));
        } finally {
          unreachable.close();
        }
        await stopServer(server);
        const unavailable = spawn(process.execPath, ['dist/server/entry.mjs'], {
          cwd,
          env: { ...env, TURSO_AUTH_TOKEN: 'invalid-h5-token' },
          stdio: 'ignore',
        });
        try {
          let response: Response | undefined;
          const deadline = Date.now() + 15_000;
          while (Date.now() < deadline) {
            try {
              response = await fetch(`${origin}/health/ready`, {
                signal: AbortSignal.timeout(2000),
              });
              break;
            } catch {
              await new Promise((resolveWait) => setTimeout(resolveWait, 250));
            }
          }
          assert(response);
          assert.equal(response.status, 503);
          assert.deepEqual(await response.json(), { status: 'not_ready' });
          const protectedRequest = await formRequest(
            origin,
            '/api/console/blog/save',
            {
              slug: `${runId}-must-not-save`,
              title: 'Unavailable',
              description: 'No write.',
              category: 'Testing',
              createdAt: '2026-10-19',
              body: '# No write',
            },
            cookie,
          );
          assert.equal(protectedRequest.status, 503);
          assert.equal(
            await row('SELECT id FROM blog_records WHERE slug = ?', [
              `${runId}-must-not-save`,
            ]),
            undefined,
          );
        } finally {
          await stopServer(unavailable);
          server = await startServer(env, origin);
        }
      },
    );

    await t.test(
      'all four CMS collections, concurrency, revisions, and redirects',
      async () => {
        const fixtures = [
          {
            type: 'project',
            table: 'project_records',
            section: 'projects',
            savePath: '/api/console/projects/create',
            fields: {
              slug: `${runId}-project-alpha`,
              title: 'H5 Project',
              description: 'Remote project.',
              status: 'Prototype',
              screenshots: '[]',
              caseStudyBody: '# Project',
              visible: 'on',
              links: 'Documentation | https://example.com/docs',
            },
          },
          {
            type: 'blog',
            table: 'blog_records',
            section: 'blog',
            savePath: '/api/console/blog/save',
            fields: {
              slug: `${runId}-blog-alpha`,
              title: 'H5 Blog',
              description: 'Remote blog.',
              category: 'Testing',
              createdAt: '2026-10-19',
              body: '# Blog',
              published: 'on',
            },
          },
          {
            type: 'note',
            table: 'note_records',
            section: 'notes',
            savePath: '/api/console/notes/save',
            fields: {
              slug: `${runId}-note-alpha`,
              title: 'H5 Note',
              description: 'Remote note.',
              category: 'Testing',
              createdAt: '2026-10-19',
              body: '# Note',
              published: 'on',
            },
          },
          {
            type: 'lab',
            table: 'lab_records',
            section: 'lab',
            savePath: '/api/console/lab/save',
            fields: {
              slug: `${runId}-lab-alpha`,
              title: 'H5 Lab',
              description: 'Remote lab.',
              status: 'Idea',
              date: '2026-10-19',
              body: '# Lab',
              visible: 'on',
            },
          },
        ] as const;
        for (const fixture of fixtures) {
          const saved = await formRequest(
            origin,
            fixture.savePath,
            fixture.fields,
            cookie,
          );
          assert.equal(saved.status, 303);
          assert(
            !saved.headers.get('location')?.includes('error='),
            fixture.type,
          );
          const id = await ownedRecord(fixture.table, fixture.fields.slug);
          ownedEntities.push({
            type: fixture.type,
            table: fixture.table,
            id,
            slug: fixture.fields.slug,
          });
          assert.equal(
            (
              await fetch(
                `${origin}/${fixture.section}/${fixture.fields.slug}`,
                { redirect: 'manual' },
              )
            ).status,
            200,
            fixture.type,
          );
          assert(
            Number(
              (
                await row(
                  'SELECT count(*) AS total FROM content_revisions WHERE entity_type = ? AND entity_id = ?',
                  [fixture.type, id],
                )
              )?.total,
            ) > 0,
          );
        }
        const slug = `${runId}-racing-project`;
        const candidate = {
          slug,
          title: 'Concurrent H5 Project',
          description: 'Bounded conflict test.',
          status: 'Prototype',
          screenshots: '[]',
        };
        const attempts = await Promise.all([
          formRequest(
            origin,
            '/api/console/projects/create',
            candidate,
            cookie,
          ),
          formRequest(
            origin,
            '/api/console/projects/create',
            candidate,
            cookie,
          ),
        ]);
        assert.equal(
          attempts.filter(
            (result) =>
              result.headers.get('location') ===
              '/user/projects?notice=created',
          ).length,
          1,
        );
        assert.equal(
          Number(
            (
              await row(
                'SELECT count(*) AS total FROM project_records WHERE slug = ?',
                [slug],
              )
            )?.total,
          ),
          1,
        );
        const id = await ownedRecord('project_records', slug);
        ownedEntities.push({
          type: 'project',
          table: 'project_records',
          id,
          slug,
        });

        const blog = fixtures[1];
        const blogId = ownedEntities.find((entry) => entry.type === 'blog')!.id;
        const firstRevision = String(
          (
            await row(
              "SELECT id FROM content_revisions WHERE entity_type = 'blog' AND entity_id = ? ORDER BY rowid LIMIT 1",
              [blogId],
            )
          )?.id,
        );
        const hidden = await formRequest(
          origin,
          blog.savePath,
          {
            ...blog.fields,
            id: blogId,
            published: '',
          },
          cookie,
        );
        assert(!hidden.headers.get('location')?.includes('error='));
        assert.equal(
          (await fetch(`${origin}/blog/${blog.fields.slug}`)).status,
          404,
        );
        const beta = `${runId}-blog-beta`;
        const renamed = await formRequest(
          origin,
          blog.savePath,
          {
            ...blog.fields,
            id: blogId,
            slug: beta,
            published: '',
          },
          cookie,
        );
        assert(!renamed.headers.get('location')?.includes('error='));
        const republished = await formRequest(
          origin,
          blog.savePath,
          {
            ...blog.fields,
            id: blogId,
            slug: beta,
          },
          cookie,
        );
        assert(!republished.headers.get('location')?.includes('error='));
        assert.equal(
          (
            await fetch(`${origin}/blog/${blog.fields.slug}`, {
              redirect: 'manual',
            })
          ).status,
          302,
        );
        const restored = await formRequest(
          origin,
          '/api/console/revisions/restore',
          {
            entityType: 'blog',
            entityId: blogId,
            revisionId: firstRevision,
          },
          cookie,
        );
        assert(restored.headers.get('location')?.includes('notice=restored'));
        assert.equal(
          String(
            (await row('SELECT slug FROM blog_records WHERE id = ?', [blogId]))
              ?.slug,
          ),
          blog.fields.slug,
        );
      },
    );

    await t.test(
      'project, note, and lab private/public boundaries survive remote writes',
      async () => {
        const project = ownedEntities.find((entry) => entry.type === 'project');
        const note = ownedEntities.find((entry) => entry.type === 'note');
        const lab = ownedEntities.find((entry) => entry.type === 'lab');
        assert(project && note && lab);
        const projectPath = `/projects/${project.slug}`;
        await formRequest(
          origin,
          `/api/console/projects/${project.id}/toggle-visible`,
          { intent: 'toggle-visible' },
          cookie,
        );
        assert.equal((await fetch(`${origin}${projectPath}`)).status, 404);
        await formRequest(
          origin,
          `/api/console/projects/${project.id}/toggle-visible`,
          { intent: 'toggle-visible' },
          cookie,
        );
        assert.equal((await fetch(`${origin}${projectPath}`)).status, 200);
        for (const fixture of [note, lab]) {
          const path = `/${fixture.type === 'note' ? 'notes' : 'lab'}/${fixture.slug}`;
          const fields: Record<string, string> = {
            id: fixture.id,
            slug: fixture.slug,
            title: fixture.type === 'note' ? 'H5 Note' : 'H5 Lab',
            description:
              fixture.type === 'note' ? 'Remote note.' : 'Remote lab.',
            body: fixture.type === 'note' ? '# Note' : '# Lab',
          };
          if (fixture.type === 'note') {
            fields.category = 'Testing';
            fields.createdAt = '2026-10-19';
          } else {
            fields.status = 'Idea';
            fields.date = '2026-10-19';
          }
          const endpoint = `/api/console/${fixture.type === 'note' ? 'notes' : 'lab'}/save`;
          const hidden = await formRequest(origin, endpoint, fields, cookie);
          assert(!hidden.headers.get('location')?.includes('error='));
          assert.equal((await fetch(`${origin}${path}`)).status, 404);
          const published = await formRequest(
            origin,
            endpoint,
            {
              ...fields,
              [fixture.type === 'note' ? 'published' : 'visible']: 'on',
            },
            cookie,
          );
          assert(!published.headers.get('location')?.includes('error='));
          assert.equal((await fetch(`${origin}${path}`)).status, 200);
        }
      },
    );

    await t.test(
      'historical snapshots and injected content failure remain atomic',
      async () => {
        const blog = ownedEntities.find((entry) => entry.type === 'blog');
        const project = ownedEntities.find((entry) => entry.type === 'project');
        const lab = ownedEntities.find((entry) => entry.type === 'lab');
        assert(blog && project && lab);
        const actor = await row('SELECT id FROM user WHERE email = ?', [
          config.ownerEmail,
        ]);
        assert(typeof actor?.id === 'string');

        for (const fixture of [project, lab]) {
          const source = await row(
            'SELECT snapshot_json FROM content_revisions WHERE entity_type = ? AND entity_id = ? ORDER BY rowid LIMIT 1',
            [fixture.type, fixture.id],
          );
          assert(typeof source?.snapshot_json === 'string');
          const snapshot = JSON.parse(source.snapshot_json) as Record<
            string,
            unknown
          >;
          delete snapshot[
            fixture.type === 'project' ? 'projectDate' : 'updatedAt'
          ];
          const revisionId = crypto.randomUUID();
          await database.execute({
            sql: 'INSERT INTO content_revisions (id, entity_type, entity_id, snapshot_json, actor_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            args: [
              revisionId,
              fixture.type,
              fixture.id,
              JSON.stringify(snapshot),
              actor.id,
              Math.floor(Date.now() / 1000),
            ],
          });
          const restored = await formRequest(
            origin,
            '/api/console/revisions/restore',
            {
              entityType: fixture.type,
              entityId: fixture.id,
              revisionId,
            },
            cookie,
          );
          assert(restored.headers.get('location')?.includes('notice=restored'));
          const stored = await row(
            'SELECT snapshot_json FROM content_revisions WHERE id = ?',
            [revisionId],
          );
          assert.equal(stored?.snapshot_json, JSON.stringify(snapshot));
        }

        const valid = await row(
          "SELECT snapshot_json FROM content_revisions WHERE entity_type = 'blog' AND entity_id = ? ORDER BY rowid LIMIT 1",
          [blog.id],
        );
        assert(typeof valid?.snapshot_json === 'string');
        const malformed = JSON.parse(valid.snapshot_json) as Record<
          string,
          unknown
        >;
        delete malformed.title;
        const invalidRevision = crypto.randomUUID();
        await database.execute({
          sql: 'INSERT INTO content_revisions (id, entity_type, entity_id, snapshot_json, actor_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          args: [
            invalidRevision,
            'blog',
            blog.id,
            JSON.stringify(malformed),
            actor.id,
            Math.floor(Date.now() / 1000),
          ],
        });
        const beforeInvalid = await entityState('blog', blog.table, blog.id);
        const rejected = await formRequest(
          origin,
          '/api/console/revisions/restore',
          {
            entityType: 'blog',
            entityId: blog.id,
            revisionId: invalidRevision,
          },
          cookie,
        );
        assert(
          rejected.headers.get('location')?.includes('notice=restore-failed'),
        );
        assert.deepEqual(
          await entityState('blog', blog.table, blog.id),
          beforeInvalid,
        );

        const triggerName = `h5_${runId.slice(3)}_audit_failure`;
        await database.execute(`CREATE TRIGGER ${triggerName} BEFORE INSERT ON audit_log
        WHEN NEW.entity_id = '${blog.id}' AND NEW.action = 'blog.update'
        BEGIN SELECT RAISE(ABORT, 'h5 injected audit failure'); END`);
        try {
          const before = await entityState('blog', blog.table, blog.id);
          const failed = await formRequest(
            origin,
            '/api/console/blog/save',
            {
              id: blog.id,
              slug: `${runId}-blog-failed`,
              title: 'Failed H5 update',
              description: 'Should roll back.',
              category: 'Testing',
              createdAt: '2026-10-19',
              body: '# Failed',
              published: 'on',
            },
            cookie,
          );
          assert(failed.headers.get('location')?.includes('error=unavailable'));
          assert.deepEqual(
            await entityState('blog', blog.table, blog.id),
            before,
          );
        } finally {
          await database.execute(`DROP TRIGGER IF EXISTS ${triggerName}`);
        }
      },
    );

    await t.test(
      'bounded concurrent restores and publication changes keep consistent history',
      async () => {
        const blog = ownedEntities.find((entry) => entry.type === 'blog');
        const project = ownedEntities.find((entry) => entry.type === 'project');
        assert(blog && project);
        const revisions = await database.execute({
          sql: "SELECT id FROM content_revisions WHERE entity_type = 'blog' AND entity_id = ? ORDER BY rowid LIMIT 2",
          args: [blog.id],
        });
        assert.equal(revisions.rows.length, 2);
        const before = await entityState('blog', blog.table, blog.id);
        const responses = await Promise.all(
          revisions.rows.map((revision) =>
            formRequest(
              origin,
              '/api/console/revisions/restore',
              {
                entityType: 'blog',
                entityId: blog.id,
                revisionId: String(revision.id),
              },
              cookie,
            ),
          ),
        );
        const successes = responses.filter((response) =>
          response.headers.get('location')?.includes('notice=restored'),
        ).length;
        assert(successes >= 1);
        const after = await entityState('blog', blog.table, blog.id);
        assert.equal(
          after.related.content_revisions.length -
            before.related.content_revisions.length,
          successes,
        );
        assert.equal(
          after.related.audit_log.length - before.related.audit_log.length,
          successes,
        );
        assert(String(after.content[0]?.slug).startsWith(`${runId}-blog-`));

        const visibility = await Promise.all([
          formRequest(
            origin,
            `/api/console/projects/${project.id}/toggle-visible`,
            { intent: 'toggle-visible' },
            cookie,
          ),
          formRequest(
            origin,
            `/api/console/projects/${project.id}/toggle-visible`,
            { intent: 'toggle-visible' },
            cookie,
          ),
        ]);
        assert(visibility.every((response) => response.status === 303));
        assert.equal(
          Number(
            (
              await row(
                'SELECT count(*) AS total FROM project_records WHERE id = ? AND slug LIKE ?',
                [project.id, `${runId}-%`],
              )
            )?.total,
          ),
          1,
        );
        const projectState = await entityState(
          'project',
          project.table,
          project.id,
        );
        assert(projectState.related.content_revisions.length > 0);
        assert(projectState.related.audit_log.length > 0);
      },
    );

    await t.test(
      'workspace settings persist and are restored after reconnect',
      async () => {
        await captureSettingBaseline();
        process.env.DATABASE_URL = config.url;
        process.env.TURSO_AUTH_TOKEN = config.token;
        const { migrateDatabase, closeDatabase } =
          await import('../src/lib/server/db/client');
        const { defaultHomepageConfig } =
          await import('../src/lib/data/homepage');
        const { saveHomepageConfig } =
          await import('../src/lib/server/homepage');
        const { saveSiteSettings } =
          await import('../src/lib/server/siteSettings');
        const actor = await row('SELECT id FROM user WHERE email = ?', [
          config.ownerEmail,
        ]);
        assert(typeof actor?.id === 'string');
        await migrateDatabase();
        await saveHomepageConfig(
          { ...defaultHomepageConfig, heroName: runId },
          actor.id,
        );
        await saveSiteSettings(
          {
            siteName: runId,
            name: 'H5 Test Owner',
            seoDescription: 'Remote staging test.',
            github: 'https://github.com/example',
            email: 'h5-owner@example.test',
          },
          actor.id,
        );
        const nowSaved = await formRequest(
          origin,
          '/api/console/now',
          {
            currentFocus: runId,
            workingOn: 'Remote persistence',
            learning: 'libSQL',
            using: 'Astro',
          },
          cookie,
        );
        assert.equal(nowSaved.headers.get('location'), '/user/now?saved=1');
        const firstRevisions = new Map<string, string>();
        for (const type of [
          'homepage_settings',
          'site_settings',
          'now_status',
        ]) {
          const revision = await row(
            'SELECT id FROM content_revisions WHERE entity_type = ? AND entity_id = ? ORDER BY rowid DESC LIMIT 1',
            [type, 'primary'],
          );
          assert(typeof revision?.id === 'string');
          firstRevisions.set(type, revision.id);
        }
        await saveHomepageConfig(
          { ...defaultHomepageConfig, heroName: `${runId}-changed` },
          actor.id,
        );
        await saveSiteSettings(
          {
            siteName: `${runId}-changed`,
            name: 'H5 Test Owner',
            seoDescription: 'Remote staging test.',
            github: 'https://github.com/example',
            email: 'h5-owner@example.test',
          },
          actor.id,
        );
        const nowChanged = await formRequest(
          origin,
          '/api/console/now',
          {
            currentFocus: `${runId}-changed`,
            workingOn: 'Remote persistence',
            learning: 'libSQL',
            using: 'Astro',
          },
          cookie,
        );
        assert.equal(nowChanged.headers.get('location'), '/user/now?saved=1');
        for (const [entityType, revisionId] of firstRevisions) {
          const restored = await formRequest(
            origin,
            '/api/console/revisions/restore',
            {
              entityType,
              entityId: 'primary',
              revisionId,
            },
            cookie,
          );
          assert(
            restored.headers.get('location')?.includes('notice=restored'),
            entityType,
          );
        }
        closeDatabase();
        const homepage = await row(
          "SELECT settings_json FROM homepage_settings WHERE id = 'primary'",
        );
        const site = await row(
          "SELECT settings_json FROM site_settings WHERE id = 'primary'",
        );
        assert(typeof homepage?.settings_json === 'string');
        assert(typeof site?.settings_json === 'string');
        assert.equal(JSON.parse(homepage.settings_json).heroName, runId);
        assert.equal(JSON.parse(site.settings_json).siteName, runId);
        assert.equal(
          (
            await row(
              "SELECT current_focus FROM now_status WHERE id = 'primary'",
            )
          )?.current_focus,
          runId,
        );
      },
    );

    await t.test('remote rollback and media BLOB round-trip', async () => {
      process.env.DATABASE_URL = config.url;
      process.env.TURSO_AUTH_TOKEN = config.token;
      const { getDatabase, migrateDatabase, closeDatabase } =
        await import('../src/lib/server/db/client');
      const { auditLog, mediaAssets } =
        await import('../src/lib/server/db/schema');
      const { sql } = await import('drizzle-orm');
      await migrateDatabase();
      const rollbackId = `${runId}-rollback`;
      await assert.rejects(
        getDatabase().transaction(async (tx) => {
          await tx.run(sql`INSERT INTO audit_log (id, action, entity_type, metadata_json, created_at)
          VALUES (${rollbackId}, 'h5.test', 'h5', '{}', 1)`);
          throw new Error('deliberate rollback');
        }),
      );
      assert.equal(
        await row('SELECT id FROM audit_log WHERE id = ?', [rollbackId]),
        undefined,
      );

      const sharp = (await import('sharp')).default;
      const png = await sharp({
        create: {
          width: 2,
          height: 2,
          channels: 3,
          background: '#2d6a4f',
        },
      })
        .png()
        .toBuffer();
      const body = new FormData();
      body.set('image', new File([png], 'h5.png', { type: 'image/png' }));
      const upload = await fetch(`${origin}/api/console/media/upload`, {
        method: 'POST',
        headers: { origin, cookie },
        body,
      });
      assert.equal(upload.status, 200);
      const path = String((await upload.json()).path);
      const id = /^\/media\/([0-9a-f-]{36})\.webp$/.exec(path)?.[1];
      assert(id);
      ownedMedia.push(id);
      const record = await row(
        'SELECT mime_type, data FROM media_assets WHERE id = ?',
        [id],
      );
      assert.equal(record?.mime_type, 'image/webp');
      const data: unknown = record?.data;
      assert(data instanceof ArrayBuffer || data instanceof Uint8Array);
      const expected = Buffer.from(
        data instanceof ArrayBuffer ? new Uint8Array(data) : data,
      );
      assert(expected.length > 0);
      await stopServer(server);
      server = await startServer(env, origin);
      const served = await fetch(`${origin}${path}`);
      assert.equal(served.status, 200);
      assert.equal(served.headers.get('content-type'), 'image/webp');
      assert.deepEqual(Buffer.from(await served.arrayBuffer()), expected);
      assert.equal(
        (await fetch(`${origin}/media/${crypto.randomUUID()}.webp`)).status,
        404,
      );

      for (const [mime, extension, converted] of [
        ['image/jpeg', 'jpg', await sharp(png).jpeg().toBuffer()],
        ['image/webp', 'webp', await sharp(png).webp().toBuffer()],
      ] as const) {
        const extraBody = new FormData();
        extraBody.set(
          'image',
          new File([converted], `h5.${extension}`, { type: mime }),
        );
        const extraUpload = await fetch(`${origin}/api/console/media/upload`, {
          method: 'POST',
          headers: { origin, cookie },
          body: extraBody,
        });
        assert.equal(extraUpload.status, 200);
        const extraPath = String((await extraUpload.json()).path);
        const extraId = /^\/media\/([0-9a-f-]{36})\.webp$/.exec(extraPath)?.[1];
        assert(extraId);
        ownedMedia.push(extraId);
        const extraRecord = await row(
          'SELECT data FROM media_assets WHERE id = ?',
          [extraId],
        );
        const extraData: unknown = extraRecord?.data;
        assert(
          extraData instanceof ArrayBuffer || extraData instanceof Uint8Array,
        );
        const stored = Buffer.from(
          extraData instanceof ArrayBuffer
            ? new Uint8Array(extraData)
            : extraData,
        );
        const extraResponse = await fetch(`${origin}${extraPath}`);
        assert.equal(extraResponse.headers.get('content-type'), 'image/webp');
        assert.deepEqual(
          Buffer.from(await extraResponse.arrayBuffer()),
          stored,
        );
      }
      const mediaCount = Number(
        (await row('SELECT count(*) AS total FROM media_assets'))?.total,
      );
      for (const [bytes, mime, expectedStatus] of [
        [Buffer.from('not an image'), 'image/png', 400],
        [png, 'text/plain', 415],
      ] as const) {
        const invalidBody = new FormData();
        invalidBody.set('image', new File([bytes], 'invalid', { type: mime }));
        const invalidUpload = await fetch(
          `${origin}/api/console/media/upload`,
          {
            method: 'POST',
            headers: { origin, cookie },
            body: invalidBody,
          },
        );
        assert.equal(invalidUpload.status, expectedStatus);
      }
      assert.equal(
        Number(
          (await row('SELECT count(*) AS total FROM media_assets'))?.total,
        ),
        mediaCount,
      );

      const failedId = crypto.randomUUID();
      await assert.rejects(
        getDatabase().transaction(async (tx) => {
          await tx.insert(mediaAssets).values({
            id: failedId,
            mimeType: 'image/webp',
            data: expected,
            createdAt: new Date(),
          });
          await tx.insert(auditLog).values({
            id: rollbackId,
            action: 'h5.fail',
            entityType: 'media',
            entityId: failedId,
            metadata: {},
            createdAt: new Date(),
          });
          await tx.insert(auditLog).values({
            id: rollbackId,
            action: 'h5.fail',
            entityType: 'media',
            entityId: failedId,
            metadata: {},
            createdAt: new Date(),
          });
        }),
      );
      assert.equal(
        await row('SELECT id FROM media_assets WHERE id = ?', [failedId]),
        undefined,
      );
      closeDatabase();
    });

    await t.test('logout invalidates the remote session', async () => {
      const logout = await formRequest(origin, '/user/logout', {}, cookie);
      assert.equal(logout.status, 303);
      assert.equal(
        (
          await fetch(`${origin}/user`, {
            headers: { cookie },
            redirect: 'manual',
          })
        ).status,
        303,
      );
    });
  } finally {
    await stopServer(server);
    try {
      await cleanUp();
    } finally {
      database.close();
    }
  }
});

console.log(`H5 staging target verified: ${config.host}; run ${runId}.`);
