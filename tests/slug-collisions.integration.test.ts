import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { createClient } from '@libsql/client';

const execFileAsync = promisify(execFile);
const cwd = resolve(import.meta.dirname, '..');

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
  path: string,
  values: Record<string, string>,
  cookie?: string,
) {
  return fetch(`${origin}${path}`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      origin,
      'content-type': 'application/x-www-form-urlencoded',
      ...(cookie ? { cookie } : {}),
    },
    body: new URLSearchParams(values),
  });
}

function noteFields(slug: string) {
  return {
    slug,
    title: `Note ${slug}`,
    description: 'Slug ownership integration fixture.',
    category: 'Testing',
    tags: 'test',
    createdAt: '2026-10-17',
    body: '# Note body',
    published: 'on',
  };
}

function labFields(slug: string) {
  return {
    slug,
    title: `Lab ${slug}`,
    description: 'Slug ownership integration fixture.',
    status: 'Prototype',
    date: '2026-10-17',
    body: '# Lab body',
    visible: 'on',
  };
}

function projectFields(slug: string) {
  return {
    slug,
    title: `Project ${slug}`,
    description: 'Slug ownership integration fixture.',
    status: 'Prototype',
    caseStudyBody: '# Project body',
    screenshots: '[]',
    visible: 'on',
  };
}

function blogFields(slug: string) {
  return {
    slug,
    title: `Blog ${slug}`,
    description: 'Slug ownership integration fixture.',
    category: 'Testing',
    createdAt: '2026-10-17',
    body: '# Blog body',
    published: 'on',
  };
}

test('CMS slug ownership prevents database and redirect collisions across collections', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'angefolio-slug-test-'));
  const databaseFile = join(directory, 'slugs.sqlite');
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const email = 'owner@slug-test.angefolio';
  const password = 'isolated-slug-test-password';
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: String(port),
    PUBLIC_SITE_URL: origin,
    AUTH_TRUSTED_ORIGIN: origin,
    AUTH_SECRET: 'phase-f3-integration-secret-at-least-32-characters',
    DATABASE_URL: `file:${databaseFile}`,
    ADMIN_EMAIL: email,
    ADMIN_PASSWORD: password,
  };
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
        if ((await fetch(`${origin}/user/login`)).ok) {
          ready = true;
          break;
        }
      } catch {
        // Wait for the standalone server to start.
      }
      await new Promise((done) => setTimeout(done, 250));
    }
    assert(ready, `Server did not start. ${output}`);

    const login = await post(origin, '/api/console/login', { email, password });
    assert.equal(login.status, 303);
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    assert(cookie);

    const shared = `shared-${Date.now()}`;
    const createdProject = await post(
      origin,
      '/api/console/projects/create',
      projectFields(shared),
      cookie,
    );
    assert.equal(
      createdProject.headers.get('location'),
      '/user/projects?notice=created',
    );

    const createdBlog = await post(
      origin,
      '/api/console/blog/save',
      blogFields(shared),
      cookie,
    );
    const blogId = createdBlog.headers
      .get('location')
      ?.match(/^\/user\/blog\/([^?]+)/)?.[1];
    assert(blogId);
    assert.equal(createdBlog.status, 303);

    const createdNote = await post(
      origin,
      '/api/console/notes/save',
      noteFields(shared),
      cookie,
    );
    const noteId = createdNote.headers
      .get('location')
      ?.match(/^\/user\/notes\/([^?]+)/)?.[1];
    assert(noteId);
    assert.equal(createdNote.status, 303);

    const createdLab = await post(
      origin,
      '/api/console/lab/save',
      labFields(shared),
      cookie,
    );
    const labId = createdLab.headers
      .get('location')
      ?.match(/^\/user\/lab\/([^?]+)/)?.[1];
    assert(labId);
    assert.equal(createdLab.status, 303);

    const database = createClient({ url: `file:${databaseFile}` });
    try {
      const projectRow = await database.execute({
        sql: 'SELECT id FROM project_records WHERE slug = ?',
        args: [shared],
      });
      const projectId = String(projectRow.rows[0].id);

      const occupied = `${shared}-occupied`;
      assert.equal(
        (
          await post(
            origin,
            '/api/console/projects/create',
            projectFields(occupied),
            cookie,
          )
        ).status,
        303,
      );
      const occupiedBlog = await post(
        origin,
        '/api/console/blog/save',
        blogFields(occupied),
        cookie,
      );
      const occupiedBlogId = occupiedBlog.headers
        .get('location')
        ?.match(/^\/user\/blog\/([^?]+)/)?.[1];
      assert(occupiedBlogId);
      const occupiedNote = await post(
        origin,
        '/api/console/notes/save',
        noteFields(occupied),
        cookie,
      );
      const occupiedNoteId = occupiedNote.headers
        .get('location')
        ?.match(/^\/user\/notes\/([^?]+)/)?.[1];
      assert(occupiedNoteId);
      const occupiedLab = await post(
        origin,
        '/api/console/lab/save',
        labFields(occupied),
        cookie,
      );
      const occupiedLabId = occupiedLab.headers
        .get('location')
        ?.match(/^\/user\/lab\/([^?]+)/)?.[1];
      assert(occupiedLabId);

      const beforeRejectedUpdates = await Promise.all([
        database.execute('SELECT count(*) AS count FROM audit_log'),
        database.execute('SELECT count(*) AS count FROM content_revisions'),
      ]);
      const rejectedUpdates = await Promise.all([
        post(
          origin,
          `/api/console/projects/${projectId}/update`,
          projectFields(occupied),
          cookie,
        ),
        post(
          origin,
          '/api/console/blog/save',
          { ...blogFields(occupied), id: blogId },
          cookie,
        ),
        post(
          origin,
          '/api/console/notes/save',
          { ...noteFields(occupied), id: noteId },
          cookie,
        ),
        post(
          origin,
          '/api/console/lab/save',
          { ...labFields(occupied), id: labId },
          cookie,
        ),
      ]);
      for (const response of rejectedUpdates) {
        assert.match(
          response.headers.get('location') ?? '',
          /error=slug&field=slug/,
        );
      }
      const afterRejectedUpdates = await Promise.all([
        database.execute('SELECT count(*) AS count FROM audit_log'),
        database.execute('SELECT count(*) AS count FROM content_revisions'),
      ]);
      assert.deepEqual(
        afterRejectedUpdates.map((result) => result.rows[0].count),
        beforeRejectedUpdates.map((result) => result.rows[0].count),
      );

      const initialAudit = await database.execute(
        'SELECT count(*) AS count FROM audit_log',
      );

      const duplicateRequests = await Promise.all([
        post(
          origin,
          '/api/console/projects/create',
          projectFields(shared),
          cookie,
        ),
        post(origin, '/api/console/blog/save', blogFields(shared), cookie),
        post(origin, '/api/console/notes/save', noteFields(shared), cookie),
        post(origin, '/api/console/lab/save', labFields(shared), cookie),
      ]);
      for (const response of duplicateRequests) {
        assert.match(
          response.headers.get('location') ?? '',
          /error=slug&field=slug/,
        );
      }
      const afterDuplicateAudit = await database.execute(
        'SELECT count(*) AS count FROM audit_log',
      );
      assert.equal(
        afterDuplicateAudit.rows[0].count,
        initialAudit.rows[0].count,
      );

      const renamed = {
        project: `${shared}-renamed`,
        blog: `${shared}-blog-renamed`,
        note: `${shared}-note-renamed`,
        lab: `${shared}-lab-renamed`,
      };
      assert.equal(
        (
          await post(
            origin,
            `/api/console/projects/${projectId}/update`,
            projectFields(renamed.project),
            cookie,
          )
        ).headers.get('location'),
        '/user/projects?notice=updated',
      );
      assert.equal(
        (
          await post(
            origin,
            '/api/console/blog/save',
            { ...blogFields(renamed.blog), id: blogId },
            cookie,
          )
        ).status,
        303,
      );
      assert.equal(
        (
          await post(
            origin,
            '/api/console/notes/save',
            { ...noteFields(renamed.note), id: noteId },
            cookie,
          )
        ).status,
        303,
      );
      assert.equal(
        (
          await post(
            origin,
            '/api/console/lab/save',
            { ...labFields(renamed.lab), id: labId },
            cookie,
          )
        ).status,
        303,
      );

      const foreignAliasRequests = await Promise.all([
        post(
          origin,
          '/api/console/projects/create',
          projectFields(shared),
          cookie,
        ),
        post(origin, '/api/console/blog/save', blogFields(shared), cookie),
        post(origin, '/api/console/notes/save', noteFields(shared), cookie),
        post(origin, '/api/console/lab/save', labFields(shared), cookie),
      ]);
      for (const response of foreignAliasRequests) {
        assert.match(
          response.headers.get('location') ?? '',
          /error=slug&field=slug/,
        );
      }

      const reclaimed = await Promise.all([
        post(
          origin,
          `/api/console/projects/${projectId}/update`,
          projectFields(shared),
          cookie,
        ),
        post(
          origin,
          '/api/console/blog/save',
          { ...blogFields(shared), id: blogId },
          cookie,
        ),
        post(
          origin,
          '/api/console/notes/save',
          { ...noteFields(shared), id: noteId },
          cookie,
        ),
        post(
          origin,
          '/api/console/lab/save',
          { ...labFields(shared), id: labId },
          cookie,
        ),
      ]);
      assert.equal(
        reclaimed[0].headers.get('location'),
        '/user/projects?notice=updated',
      );
      for (const response of reclaimed.slice(1))
        assert.equal(response.status, 303);

      const counts = await Promise.all([
        database.execute('SELECT count(*) AS count FROM project_records'),
        database.execute('SELECT count(*) AS count FROM blog_records'),
        database.execute('SELECT count(*) AS count FROM note_records'),
        database.execute('SELECT count(*) AS count FROM lab_records'),
      ]);
      for (const result of counts) assert.equal(result.rows[0].count, 2);

      for (const path of [
        `/projects/${shared}`,
        `/blog/${shared}`,
        `/notes/${shared}`,
        `/lab/${shared}`,
      ]) {
        assert.equal((await fetch(`${origin}${path}`)).status, 200, path);
      }
      for (const [type, slug] of Object.entries(renamed)) {
        const collection =
          type === 'project'
            ? 'projects'
            : type === 'blog' || type === 'lab'
              ? type
              : 'notes';
        const response = await fetch(`${origin}/${collection}/${slug}`, {
          redirect: 'manual',
        });
        assert.equal(response.status, 302, `${collection}/${slug}`);
        assert.equal(
          response.headers.get('location'),
          `/${collection}/${shared}`,
        );
      }

      const ids = await Promise.all([
        database.execute({
          sql: 'SELECT id FROM blog_records WHERE slug = ?',
          args: [shared],
        }),
        database.execute({
          sql: 'SELECT id FROM note_records WHERE slug = ?',
          args: [shared],
        }),
        database.execute({
          sql: 'SELECT id FROM lab_records WHERE slug = ?',
          args: [shared],
        }),
      ]);
      assert.equal(ids[0].rows[0].id, blogId);
      assert.equal(ids[1].rows[0].id, noteId);
      assert.equal(ids[2].rows[0].id, labId);
      assert.equal(
        (
          await database.execute({
            sql: 'SELECT id FROM project_records WHERE slug = ?',
            args: [shared],
          })
        ).rows[0].id,
        projectId,
      );
    } finally {
      database.close();
    }
  } finally {
    server?.kill('SIGTERM');
    if (server) await once(server, 'exit').catch(() => undefined);
    await rm(directory, { recursive: true, force: true });
  }
});
