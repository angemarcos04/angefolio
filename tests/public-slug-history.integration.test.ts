import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { createClient } from '@libsql/client';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const cwd = resolve(import.meta.dirname, '..');
const stateTables = [
  'project_records',
  'blog_records',
  'note_records',
  'lab_records',
  'homepage_settings',
  'site_settings',
  'now_status',
  'content_public_slugs',
  'content_redirects',
  'content_revisions',
  'audit_log',
  'media_assets',
] as const;

async function databaseState(database: ReturnType<typeof createClient>) {
  const entries = await Promise.all(
    stateTables.map(
      async (table) =>
        [
          table,
          (await database.execute(`SELECT * FROM ${table} ORDER BY rowid`))
            .rows,
        ] as const,
    ),
  );
  return Object.fromEntries(entries);
}

async function freePort(): Promise<number> {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  server.close();
  return address.port;
}

function post(
  origin: string,
  cookie: string,
  path: string,
  fields: Record<string, string>,
) {
  return fetch(`${origin}${path}`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      origin,
      cookie,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(fields),
  });
}

test('public alpha survives unpublication and private rename in all four collections', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'angefolio-h3-baseline-'));
  const databaseFile = join(directory, 'history.sqlite');
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const email = 'h3-owner@example.test';
  const password = 'h3-local-test-password-long';
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: String(port),
    PUBLIC_SITE_URL: origin,
    AUTH_TRUSTED_ORIGIN: origin,
    AUTH_SECRET: 'h3-isolated-local-browser-secret-32-chars',
    DATABASE_URL: `file:${databaseFile}`,
    ADMIN_EMAIL: email,
    ADMIN_PASSWORD: password,
  };
  delete env.TURSO_AUTH_TOKEN;
  const database = createClient({ url: `file:${databaseFile}` });
  let server: ReturnType<typeof spawn> | undefined;
  let output = '';
  try {
    await execFileAsync(
      './node_modules/.bin/tsx',
      ['scripts/create-admin.ts'],
      {
        cwd,
        env,
      },
    );
    server = spawn(process.execPath, ['dist/server/entry.mjs'], {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout?.on('data', (chunk) => (output += chunk.toString()));
    server.stderr?.on('data', (chunk) => (output += chunk.toString()));
    const deadline = Date.now() + 45_000;
    let ready = false;
    while (Date.now() < deadline) {
      try {
        if ((await fetch(origin)).ok) {
          ready = true;
          break;
        }
      } catch {
        // Wait for the isolated server.
      }
      await new Promise((done) => setTimeout(done, 250));
    }
    assert(ready, output);
    const login = await fetch(`${origin}/api/console/login`, {
      method: 'POST',
      redirect: 'manual',
      headers: { origin, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email, password }),
    });
    assert.equal(login.status, 303);
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    assert(cookie);

    const cases = [
      {
        type: 'project',
        section: 'projects',
        table: 'project_records',
        savePath: '/api/console/projects/create',
        fields: {
          slug: 'h3-project-alpha',
          title: 'H3 Project',
          description: 'H3 lifecycle.',
          status: 'Prototype',
          screenshots: '[]',
          visible: 'on',
        },
        publicFlag: 'visible',
      },
      {
        type: 'blog',
        section: 'blog',
        table: 'blog_records',
        savePath: '/api/console/blog/save',
        fields: {
          slug: 'h3-blog-alpha',
          title: 'H3 Blog',
          description: 'H3 lifecycle.',
          category: 'Testing',
          createdAt: '2026-10-17',
          body: '# Blog',
          published: 'on',
        },
        publicFlag: 'published',
      },
      {
        type: 'note',
        section: 'notes',
        table: 'note_records',
        savePath: '/api/console/notes/save',
        fields: {
          slug: 'h3-note-alpha',
          title: 'H3 Note',
          description: 'H3 lifecycle.',
          category: 'Testing',
          createdAt: '2026-10-17',
          body: '# Note',
          published: 'on',
        },
        publicFlag: 'published',
      },
      {
        type: 'lab',
        section: 'lab',
        table: 'lab_records',
        savePath: '/api/console/lab/save',
        fields: {
          slug: 'h3-lab-alpha',
          title: 'H3 Lab',
          description: 'H3 lifecycle.',
          status: 'Idea',
          date: '2026-10-17',
          body: '# Lab',
          visible: 'on',
        },
        publicFlag: 'visible',
      },
    ] as const;

    const missingAliases: string[] = [];
    for (const fixture of cases) {
      const created = await post(
        origin,
        cookie,
        fixture.savePath,
        fixture.fields,
      );
      assert.equal(
        created.status,
        303,
        `${fixture.type} create: ${created.headers.get('location')}`,
      );
      const selected = await database.execute({
        sql: `SELECT id FROM ${fixture.table} WHERE slug = ?`,
        args: [fixture.fields.slug],
      });
      const id = String(selected.rows[0]?.id ?? '');
      assert(id);
      const oldPath = `/${fixture.section}/${fixture.fields.slug}`;
      const newSlug = fixture.fields.slug.replace('alpha', 'beta');
      const newPath = `/${fixture.section}/${newSlug}`;
      assert.equal(
        (await fetch(`${origin}${oldPath}`, { redirect: 'manual' })).status,
        200,
      );

      if (fixture.type === 'project') {
        const hidden = await post(
          origin,
          cookie,
          `/api/console/projects/${id}/toggle-visible`,
          { intent: 'toggle-visible' },
        );
        assert.match(hidden.headers.get('location') ?? '', /notice=visibility/);
      } else {
        const hidden = await post(origin, cookie, fixture.savePath, {
          ...fixture.fields,
          id,
          [fixture.publicFlag]: '',
        });
        assert.match(hidden.headers.get('location') ?? '', /notice=saved/);
      }
      const privateOld = await fetch(`${origin}${oldPath}`, {
        redirect: 'manual',
      });
      assert.equal(privateOld.status, 404);
      assert.equal(privateOld.headers.get('location'), null);

      const renamed = await post(
        origin,
        cookie,
        fixture.type === 'project'
          ? `/api/console/projects/${id}/update`
          : fixture.savePath,
        { ...fixture.fields, id, slug: newSlug, [fixture.publicFlag]: '' },
      );
      assert.equal(renamed.status, 303);
      const privateAlias = await fetch(`${origin}${oldPath}`, {
        redirect: 'manual',
      });
      assert.equal(privateAlias.status, 404);
      assert.equal(privateAlias.headers.get('location'), null);
      for (const discoveryPath of [
        `/${fixture.section}`,
        `/api/search/${fixture.section}?q=${encodeURIComponent(fixture.fields.title)}`,
        `/sitemap-${fixture.section}.xml`,
        ...(fixture.type === 'blog' ? ['/blog/rss.xml'] : []),
      ]) {
        const discovery = await (
          await fetch(`${origin}${discoveryPath}`)
        ).text();
        assert.equal(
          discovery.includes(newSlug),
          false,
          `${fixture.type}: ${discoveryPath} exposed a private slug`,
        );
      }

      const republished = await post(
        origin,
        cookie,
        fixture.type === 'project'
          ? `/api/console/projects/${id}/toggle-visible`
          : fixture.savePath,
        fixture.type === 'project'
          ? { intent: 'toggle-visible' }
          : { ...fixture.fields, id, slug: newSlug },
      );
      assert.equal(republished.status, 303);
      assert.equal(
        (await fetch(`${origin}${newPath}`, { redirect: 'manual' })).status,
        200,
      );
      const old = await fetch(`${origin}${oldPath}`, { redirect: 'manual' });
      if (old.status !== 302)
        missingAliases.push(`${fixture.type}: ${old.status}`);
      else {
        assert.equal(old.headers.get('location'), newPath);
        assert.equal(old.headers.get('cache-control'), 'no-store');
      }

      // A second publication cycle must preserve both published names while
      // omitting intermediate private-only names.
      if (fixture.type === 'project') {
        await post(
          origin,
          cookie,
          `/api/console/projects/${id}/toggle-visible`,
          {
            intent: 'toggle-visible',
          },
        );
      } else {
        await post(origin, cookie, fixture.savePath, {
          ...fixture.fields,
          id,
          slug: newSlug,
          [fixture.publicFlag]: '',
        });
      }
      const gammaSlug = fixture.fields.slug.replace('alpha', 'gamma');
      const gammaPath = `/${fixture.section}/${gammaSlug}`;
      await post(
        origin,
        cookie,
        fixture.type === 'project'
          ? `/api/console/projects/${id}/update`
          : fixture.savePath,
        { ...fixture.fields, id, slug: gammaSlug, [fixture.publicFlag]: '' },
      );
      for (const path of [oldPath, newPath]) {
        const hidden = await fetch(`${origin}${path}`, { redirect: 'manual' });
        assert.equal(
          hidden.status,
          404,
          `${fixture.type}: ${path} must stay private`,
        );
        assert.equal(hidden.headers.get('location'), null);
      }
      await post(
        origin,
        cookie,
        fixture.type === 'project'
          ? `/api/console/projects/${id}/toggle-visible`
          : fixture.savePath,
        fixture.type === 'project'
          ? { intent: 'toggle-visible' }
          : { ...fixture.fields, id, slug: gammaSlug },
      );
      assert.equal(
        (await fetch(`${origin}${gammaPath}`, { redirect: 'manual' })).status,
        200,
      );
      for (const path of [oldPath, newPath]) {
        const alias = await fetch(`${origin}${path}`, { redirect: 'manual' });
        assert.equal(alias.status, 302, `${fixture.type}: ${path}`);
        assert.equal(alias.headers.get('location'), gammaPath);
        assert.equal(alias.headers.get('cache-control'), 'no-store');
      }

      // The owner can reclaim alpha without a self-redirect. A second record
      // cannot claim beta, which remains owned historical public history.
      const reclaimed = await post(
        origin,
        cookie,
        fixture.type === 'project'
          ? `/api/console/projects/${id}/update`
          : fixture.savePath,
        { ...fixture.fields, id },
      );
      assert.equal(reclaimed.status, 303);
      assert.equal(
        (await fetch(`${origin}${oldPath}`, { redirect: 'manual' })).status,
        200,
      );
      for (const path of [newPath, gammaPath]) {
        const alias = await fetch(`${origin}${path}`, { redirect: 'manual' });
        assert.equal(alias.status, 302);
        assert.equal(alias.headers.get('location'), oldPath);
      }
      const foreignClaim = await post(origin, cookie, fixture.savePath, {
        ...fixture.fields,
        slug: newSlug,
        [fixture.publicFlag]: '',
      });
      assert.match(foreignClaim.headers.get('location') ?? '', /error=slug/);

      if (fixture.type === 'blog') {
        assert.match(id, /^[a-f0-9-]+$/);
        const failureSlug = 'h3-blog-failed';
        const failures = [
          [
            'content',
            'BEFORE UPDATE ON blog_records',
            `NEW.slug = '${failureSlug}'`,
          ],
          [
            'provenance',
            'BEFORE INSERT ON content_public_slugs',
            `NEW.path = '/blog/${failureSlug}'`,
          ],
          [
            'redirect',
            'BEFORE INSERT ON content_redirects',
            `NEW.to_path = '/blog/${failureSlug}'`,
          ],
          ['audit', 'BEFORE INSERT ON audit_log', "NEW.action = 'blog.update'"],
          [
            'revision',
            'BEFORE INSERT ON content_revisions',
            `NEW.entity_type = 'blog' AND NEW.entity_id = '${id}'`,
          ],
        ] as const;
        for (const [stage, timing, condition] of failures) {
          const trigger = `h3_fail_${stage}`;
          await database.execute(`CREATE TRIGGER ${trigger}
            ${timing} WHEN ${condition}
            BEGIN SELECT RAISE(ABORT, 'injected ${stage} failure'); END`);
          const before = await databaseState(database);
          const attempted = await post(origin, cookie, fixture.savePath, {
            ...fixture.fields,
            id,
            slug: failureSlug,
          });
          assert.match(
            attempted.headers.get('location') ?? '',
            /error=unavailable/,
          );
          assert.deepEqual(
            await databaseState(database),
            before,
            `${stage} failure must roll back all tables`,
          );
          await database.execute(`DROP TRIGGER ${trigger}`);
        }
      }

      const revisionFor = async (slug: string, published: boolean) => {
        const rows = await database.execute({
          sql: `SELECT id FROM content_revisions
            WHERE entity_type = ? AND entity_id = ?
              AND json_extract(snapshot_json, '$.slug') = ?
              AND json_extract(snapshot_json, '$.${fixture.publicFlag}') = ?
            ORDER BY rowid DESC LIMIT 1`,
          args: [fixture.type, id, slug, published ? 1 : 0],
        });
        const revisionId = String(rows.rows[0]?.id ?? '');
        assert(revisionId, `${fixture.type} ${slug} revision missing`);
        return revisionId;
      };
      const privateRevision = await revisionFor(newSlug, false);
      const publicRevision = await revisionFor(fixture.fields.slug, true);
      const restore = (revisionId: string) =>
        post(origin, cookie, '/api/console/revisions/restore', {
          entityType: fixture.type,
          entityId: id,
          revisionId,
        });
      const restoredPrivate = await restore(privateRevision);
      assert.match(
        restoredPrivate.headers.get('location') ?? '',
        /notice=restored/,
      );
      for (const path of [oldPath, newPath, gammaPath]) {
        const hidden = await fetch(`${origin}${path}`, { redirect: 'manual' });
        assert.equal(hidden.status, 404, `${fixture.type} restore: ${path}`);
        assert.equal(hidden.headers.get('location'), null);
      }
      const restoredPublic = await restore(publicRevision);
      assert.match(
        restoredPublic.headers.get('location') ?? '',
        /notice=restored/,
      );
      assert.equal(
        (await fetch(`${origin}${oldPath}`, { redirect: 'manual' })).status,
        200,
      );
      for (const path of [newPath, gammaPath]) {
        const alias = await fetch(`${origin}${path}`, { redirect: 'manual' });
        assert.equal(alias.status, 302);
        assert.equal(alias.headers.get('location'), oldPath);
      }

      if (fixture.type === 'project' || fixture.type === 'blog') {
        const archived = await post(
          origin,
          cookie,
          fixture.type === 'project'
            ? `/api/console/projects/${id}/archive`
            : fixture.savePath,
          fixture.type === 'project'
            ? { intent: 'archive' }
            : { ...fixture.fields, id, archived: 'on' },
        );
        assert.equal(archived.status, 303);
        for (const path of [oldPath, newPath, gammaPath]) {
          const hidden = await fetch(`${origin}${path}`, {
            redirect: 'manual',
          });
          assert.equal(hidden.status, 404);
          assert.equal(hidden.headers.get('location'), null);
        }
        if (fixture.type === 'project') {
          await post(origin, cookie, `/api/console/projects/${id}/restore`, {
            intent: 'restore',
          });
          assert.equal(
            (await fetch(`${origin}${oldPath}`, { redirect: 'manual' })).status,
            404,
          );
          await post(
            origin,
            cookie,
            `/api/console/projects/${id}/toggle-visible`,
            {
              intent: 'toggle-visible',
            },
          );
        } else {
          await post(origin, cookie, fixture.savePath, {
            ...fixture.fields,
            id,
            archived: '',
          });
        }
        assert.equal(
          (await fetch(`${origin}${oldPath}`, { redirect: 'manual' })).status,
          200,
        );
        for (const path of [newPath, gammaPath]) {
          const alias = await fetch(`${origin}${path}`, { redirect: 'manual' });
          assert.equal(alias.status, 302);
          assert.equal(alias.headers.get('location'), oldPath);
        }
      }

      // A separate never-published draft must not gain an alias from its
      // private-only name when it first becomes public.
      const privateSlug = fixture.fields.slug.replace('alpha', 'private-one');
      const publishedSlug = fixture.fields.slug.replace('alpha', 'private-two');
      await post(origin, cookie, fixture.savePath, {
        ...fixture.fields,
        slug: privateSlug,
        [fixture.publicFlag]: '',
      });
      const privateRow = await database.execute({
        sql: `SELECT id FROM ${fixture.table} WHERE slug = ?`,
        args: [privateSlug],
      });
      const privateId = String(privateRow.rows[0]?.id ?? '');
      assert(privateId);
      await post(
        origin,
        cookie,
        fixture.type === 'project'
          ? `/api/console/projects/${privateId}/update`
          : fixture.savePath,
        {
          ...fixture.fields,
          id: privateId,
          slug: publishedSlug,
          [fixture.publicFlag]: '',
        },
      );
      await post(
        origin,
        cookie,
        fixture.type === 'project'
          ? `/api/console/projects/${privateId}/toggle-visible`
          : fixture.savePath,
        fixture.type === 'project'
          ? { intent: 'toggle-visible' }
          : { ...fixture.fields, id: privateId, slug: publishedSlug },
      );
      assert.equal(
        (
          await fetch(`${origin}/${fixture.section}/${privateSlug}`, {
            redirect: 'manual',
          })
        ).status,
        404,
      );
      assert.equal(
        (
          await fetch(`${origin}/${fixture.section}/${publishedSlug}`, {
            redirect: 'manual',
          })
        ).status,
        200,
      );
      const privateHistory = await database.execute({
        sql: 'SELECT path FROM content_public_slugs WHERE entity_type = ? AND entity_id = ?',
        args: [fixture.type, privateId],
      });
      assert.deepEqual(
        privateHistory.rows.map((row) => row.path),
        [`/${fixture.section}/${publishedSlug}`],
      );
    }
    assert.deepEqual(missingAliases, []);
  } finally {
    database.close();
    if (server && server.exitCode === null) {
      server.kill('SIGTERM');
      await once(server, 'exit');
    }
    await rm(directory, { recursive: true, force: true });
  }
});
