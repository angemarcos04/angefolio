import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
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

async function freePort(): Promise<number> {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  server.close();
  return address.port;
}

async function waitForServer(origin: string, getOutput: () => string) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(origin)).ok) return;
    } catch {
      // Wait until the standalone server is accepting requests.
    }
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error(`Server did not start. ${getOutput()}`);
}

function postForm(
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

async function saveAndRename(
  origin: string,
  cookie: string,
  path: string,
  fields: Record<string, string>,
): Promise<string> {
  const created = await postForm(origin, path, fields, cookie);
  assert.equal(
    created.status,
    303,
    `${path}: ${created.headers.get('location')}`,
  );
  const location = created.headers.get('location') ?? '';
  const id = location.match(/\/([a-f0-9-]+)\?notice=saved$/)?.[1];
  assert(id, `Could not read created id from ${location}`);
  const renamed = await postForm(
    origin,
    path,
    { ...fields, id, slug: fields.slug.replace('-original', '-renamed') },
    cookie,
  );
  assert.equal(
    renamed.status,
    303,
    `${path}: ${renamed.headers.get('location')}`,
  );
  assert.match(renamed.headers.get('location') ?? '', /notice=saved/);
  return id;
}

async function assertAlias(
  origin: string,
  path: string,
  expectedStatus: number,
  expectedLocation?: string,
  expectNoStore = true,
) {
  const response = await fetch(`${origin}${path}`, { redirect: 'manual' });
  assert.equal(response.status, expectedStatus, path);
  if (expectedLocation) {
    assert.equal(response.headers.get('location'), expectedLocation);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  } else {
    assert.equal(response.headers.get('location'), null);
    if (expectNoStore)
      assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  return response;
}

test('historical aliases follow public owners across all content collections', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'angefolio-redirect-test-'));
  const databaseFile = join(directory, 'redirects.sqlite');
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const email = 'redirect-owner@angefolio.test';
  const password = 'f1-redirect-test-password-long';
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: String(port),
    PUBLIC_SITE_URL: origin,
    AUTH_TRUSTED_ORIGIN: origin,
    AUTH_SECRET: 'f1-redirect-integration-secret-at-least-32-characters',
    DATABASE_URL: `file:${databaseFile}`,
    ADMIN_EMAIL: email,
    ADMIN_PASSWORD: password,
  };
  const database = createClient({ url: env.DATABASE_URL });
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
    await waitForServer(origin, () => output);

    const login = await postForm(origin, '/api/console/login', {
      email,
      password,
    });
    assert.equal(login.status, 303);
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    assert(cookie);

    const projectFields = {
      slug: 'f1-project-original',
      title: 'F1 Project',
      description: 'Redirect privacy fixture.',
      status: 'Prototype',
      visible: 'on',
      stack: 'Astro',
      screenshots: '[]',
    };
    const projectCreated = await postForm(
      origin,
      '/api/console/projects/create',
      projectFields,
      cookie,
    );
    assert.equal(projectCreated.status, 303);
    const projectRow = await database.execute({
      sql: 'SELECT id FROM project_records WHERE slug = ?',
      args: [projectFields.slug],
    });
    const projectId = String(projectRow.rows[0]?.id ?? '');
    assert(projectId);
    const projectRenamed = await postForm(
      origin,
      `/api/console/projects/${projectId}/update`,
      { ...projectFields, slug: 'f1-project-renamed' },
      cookie,
    );
    assert.equal(projectRenamed.status, 303);
    await assertAlias(
      origin,
      '/projects/f1-project-original',
      302,
      '/projects/f1-project-renamed',
    );
    assert.equal(
      (await fetch(`${origin}/projects/f1-project-renamed`)).status,
      200,
    );
    const projectArchived = await postForm(
      origin,
      `/api/console/projects/${projectId}/archive`,
      { intent: 'archive' },
      cookie,
    );
    assert.match(
      projectArchived.headers.get('location') ?? '',
      /notice=archived/,
    );
    await assertAlias(origin, '/projects/f1-project-original', 404);
    const projectRestored = await postForm(
      origin,
      `/api/console/projects/${projectId}/restore`,
      { intent: 'restore' },
      cookie,
    );
    assert.match(
      projectRestored.headers.get('location') ?? '',
      /notice=restored/,
    );
    await postForm(
      origin,
      `/api/console/projects/${projectId}/toggle-visible`,
      { intent: 'toggle-visible' },
      cookie,
    );
    await assertAlias(
      origin,
      '/projects/f1-project-original',
      302,
      '/projects/f1-project-renamed',
    );
    await postForm(
      origin,
      `/api/console/projects/${projectId}/toggle-visible`,
      { intent: 'toggle-visible' },
      cookie,
    );
    const projectPrivateRename = await postForm(
      origin,
      `/api/console/projects/${projectId}/update`,
      { ...projectFields, slug: 'f1-project-private', visible: '' },
      cookie,
    );
    assert.equal(projectPrivateRename.status, 303);
    const projectAliasAfterPrivateRename = await database.execute({
      sql: 'SELECT from_path, to_path, entity_id FROM content_redirects WHERE from_path = ?',
      args: ['/projects/f1-project-original'],
    });
    assert.deepEqual(projectAliasAfterPrivateRename.rows, [
      {
        from_path: '/projects/f1-project-original',
        to_path: '/projects/f1-project-private',
        entity_id: projectId,
      },
    ]);
    assert.equal(
      (
        await database.execute({
          sql: 'SELECT COUNT(*) AS count FROM content_redirects WHERE from_path = ?',
          args: ['/projects/f1-project-renamed'],
        })
      ).rows[0]?.count,
      1,
    );
    await assertAlias(origin, '/projects/f1-project-original', 404);
    const projectPrivateRenameAgain = await postForm(
      origin,
      `/api/console/projects/${projectId}/update`,
      { ...projectFields, slug: 'f1-project-private-again', visible: '' },
      cookie,
    );
    assert.equal(projectPrivateRenameAgain.status, 303);
    assert.equal(
      (
        await database.execute({
          sql: 'SELECT to_path FROM content_redirects WHERE from_path = ?',
          args: ['/projects/f1-project-original'],
        })
      ).rows[0]?.to_path,
      '/projects/f1-project-private-again',
    );
    await postForm(
      origin,
      `/api/console/projects/${projectId}/toggle-visible`,
      { intent: 'toggle-visible' },
      cookie,
    );
    await assertAlias(
      origin,
      '/projects/f1-project-original',
      302,
      '/projects/f1-project-private-again',
    );

    const blogFields = {
      slug: 'f1-blog-original',
      title: 'F1 Blog',
      description: 'Redirect privacy fixture.',
      category: 'Testing',
      createdAt: '2026-10-17',
      body: 'Public article body.',
      published: 'on',
    };
    const blogId = await saveAndRename(
      origin,
      cookie,
      '/api/console/blog/save',
      blogFields,
    );
    await assertAlias(
      origin,
      '/blog/f1-blog-original',
      302,
      '/blog/f1-blog-renamed',
    );
    const blogHidden = await postForm(
      origin,
      '/api/console/blog/save',
      {
        ...blogFields,
        id: blogId,
        slug: 'f1-blog-renamed',
        published: '',
      },
      cookie,
    );
    assert.equal(blogHidden.status, 303);
    assert.equal(
      blogHidden.headers.get('location'),
      `/user/blog/${blogId}?notice=saved`,
    );
    const hiddenBlogRow = await database.execute({
      sql: 'SELECT slug, published, archived FROM blog_records WHERE id = ?',
      args: [blogId],
    });
    assert.equal(hiddenBlogRow.rows[0]?.slug, 'f1-blog-renamed');
    assert.equal(hiddenBlogRow.rows[0]?.published, 0);
    assert.equal(hiddenBlogRow.rows[0]?.archived, 0);
    await assertAlias(origin, '/blog/f1-blog-original', 404);
    await assertAlias(origin, '/blog/f1-blog-renamed', 404, undefined, false);
    const blogPrivateRename = await postForm(
      origin,
      '/api/console/blog/save',
      {
        ...blogFields,
        id: blogId,
        slug: 'f1-blog-private',
        published: '',
      },
      cookie,
    );
    assert.equal(blogPrivateRename.status, 303);
    assert.deepEqual(
      (
        await database.execute({
          sql: 'SELECT from_path, to_path, entity_id FROM content_redirects WHERE from_path = ?',
          args: ['/blog/f1-blog-original'],
        })
      ).rows,
      [
        {
          from_path: '/blog/f1-blog-original',
          to_path: '/blog/f1-blog-private',
          entity_id: blogId,
        },
      ],
    );
    assert.equal(
      (
        await database.execute({
          sql: 'SELECT COUNT(*) AS count FROM content_redirects WHERE from_path = ?',
          args: ['/blog/f1-blog-renamed'],
        })
      ).rows[0]?.count,
      1,
    );
    await postForm(
      origin,
      '/api/console/blog/save',
      {
        ...blogFields,
        id: blogId,
        slug: 'f1-blog-private-again',
        published: '',
      },
      cookie,
    );
    assert.equal(
      (
        await database.execute({
          sql: 'SELECT to_path FROM content_redirects WHERE from_path = ?',
          args: ['/blog/f1-blog-original'],
        })
      ).rows[0]?.to_path,
      '/blog/f1-blog-private-again',
    );
    await assertAlias(origin, '/blog/f1-blog-original', 404);
    const blogRepublished = await postForm(
      origin,
      '/api/console/blog/save',
      {
        ...blogFields,
        id: blogId,
        slug: 'f1-blog-private-again',
        published: 'on',
      },
      cookie,
    );
    assert.equal(blogRepublished.status, 303);
    await assertAlias(
      origin,
      '/blog/f1-blog-original',
      302,
      '/blog/f1-blog-private-again',
    );
    assert.equal(
      (await fetch(`${origin}/blog/f1-blog-private-again`)).status,
      200,
    );
    const blogArchived = await postForm(
      origin,
      '/api/console/blog/save',
      {
        ...blogFields,
        id: blogId,
        slug: 'f1-blog-private-again',
        published: 'on',
        archived: 'on',
      },
      cookie,
    );
    assert.equal(blogArchived.status, 303);
    await assertAlias(origin, '/blog/f1-blog-original', 404);
    const blogRestored = await postForm(
      origin,
      '/api/console/blog/save',
      {
        ...blogFields,
        id: blogId,
        slug: 'f1-blog-private-again',
        published: 'on',
        archived: '',
      },
      cookie,
    );
    assert.equal(blogRestored.status, 303);
    const blogSecondRename = await postForm(
      origin,
      '/api/console/blog/save',
      {
        ...blogFields,
        id: blogId,
        slug: 'f1-blog-latest',
        published: 'on',
      },
      cookie,
    );
    assert.equal(blogSecondRename.status, 303);
    await assertAlias(
      origin,
      '/blog/f1-blog-original',
      302,
      '/blog/f1-blog-latest',
    );
    // This slug was public before the private rename and remains an alias.
    await assertAlias(
      origin,
      '/blog/f1-blog-renamed',
      302,
      '/blog/f1-blog-latest',
    );
    const blogSearch = await (
      await fetch(`${origin}/api/search/blog?q=F1%20Blog`)
    ).text();
    assert.match(blogSearch, /f1-blog-latest/);
    assert.doesNotMatch(
      blogSearch,
      /f1-blog-original|f1-blog-renamed|f1-blog-private-again/,
    );
    const blogSitemap = await (
      await fetch(`${origin}/sitemap-blog.xml`)
    ).text();
    assert.match(blogSitemap, /\/blog\/f1-blog-latest/);
    assert.doesNotMatch(
      blogSitemap,
      /f1-blog-original|f1-blog-renamed|f1-blog-private-again/,
    );
    const blogRss = await (await fetch(`${origin}/blog/rss.xml`)).text();
    assert.match(blogRss, /\/blog\/f1-blog-latest/);
    assert.doesNotMatch(
      blogRss,
      /f1-blog-original|f1-blog-renamed|f1-blog-private-again/,
    );

    const noteFields = {
      slug: 'f1-note-original',
      title: 'F1 Note',
      description: 'Redirect privacy fixture.',
      category: 'Testing',
      createdAt: '2026-10-17',
      body: 'Public note body.',
      published: 'on',
    };
    const noteId = await saveAndRename(
      origin,
      cookie,
      '/api/console/notes/save',
      noteFields,
    );
    await assertAlias(
      origin,
      '/notes/f1-note-original',
      302,
      '/notes/f1-note-renamed',
    );
    assert.equal((await fetch(`${origin}/notes/f1-note-renamed`)).status, 200);
    const noteHidden = await postForm(
      origin,
      '/api/console/notes/save',
      {
        ...noteFields,
        id: noteId,
        slug: 'f1-note-renamed',
        published: '',
      },
      cookie,
    );
    assert.equal(noteHidden.status, 303);
    await assertAlias(origin, '/notes/f1-note-original', 404);
    const notePrivateRename = await postForm(
      origin,
      '/api/console/notes/save',
      { ...noteFields, id: noteId, slug: 'f1-note-private', published: '' },
      cookie,
    );
    assert.equal(notePrivateRename.status, 303);
    assert.equal(
      (
        await database.execute({
          sql: 'SELECT to_path FROM content_redirects WHERE from_path = ?',
          args: ['/notes/f1-note-original'],
        })
      ).rows[0]?.to_path,
      '/notes/f1-note-private',
    );
    assert.equal(
      (
        await database.execute({
          sql: 'SELECT COUNT(*) AS count FROM content_redirects WHERE from_path = ?',
          args: ['/notes/f1-note-renamed'],
        })
      ).rows[0]?.count,
      1,
    );
    await assertAlias(origin, '/notes/f1-note-original', 404);
    const noteRepublished = await postForm(
      origin,
      '/api/console/notes/save',
      {
        ...noteFields,
        id: noteId,
        slug: 'f1-note-private',
        published: 'on',
      },
      cookie,
    );
    assert.equal(noteRepublished.status, 303);
    await assertAlias(
      origin,
      '/notes/f1-note-original',
      302,
      '/notes/f1-note-private',
    );

    const labFields = {
      slug: 'f1-lab-original',
      title: 'F1 Lab',
      description: 'Redirect privacy fixture.',
      status: 'Testing',
      date: '2026-10-17',
      body: 'Visible experiment body.',
      visible: 'on',
    };
    const labId = await saveAndRename(
      origin,
      cookie,
      '/api/console/lab/save',
      labFields,
    );
    await assertAlias(
      origin,
      '/lab/f1-lab-original',
      302,
      '/lab/f1-lab-renamed',
    );

    const mutationsBeforeRead = await database.execute(
      'SELECT (SELECT COUNT(*) FROM content_revisions) AS revisions, (SELECT COUNT(*) FROM audit_log) AS events',
    );
    await assertAlias(origin, '/blog/f1-unknown-alias', 404, undefined, false);
    await assertAlias(
      origin,
      '/blog/f1-blog-original',
      302,
      '/blog/f1-blog-latest',
    );
    const mutationsAfterRead = await database.execute(
      'SELECT (SELECT COUNT(*) FROM content_revisions) AS revisions, (SELECT COUNT(*) FROM audit_log) AS events',
    );
    assert.deepEqual(mutationsAfterRead.rows, mutationsBeforeRead.rows);
    assert.equal((await fetch(`${origin}/lab/f1-lab-renamed`)).status, 200);
    const labHidden = await postForm(
      origin,
      '/api/console/lab/save',
      {
        ...labFields,
        id: labId,
        slug: 'f1-lab-renamed',
        visible: '',
      },
      cookie,
    );
    assert.equal(labHidden.status, 303);
    await assertAlias(origin, '/lab/f1-lab-original', 404);
    const labPrivateRename = await postForm(
      origin,
      '/api/console/lab/save',
      { ...labFields, id: labId, slug: 'f1-lab-private', visible: '' },
      cookie,
    );
    assert.equal(labPrivateRename.status, 303);
    assert.equal(
      (
        await database.execute({
          sql: 'SELECT to_path FROM content_redirects WHERE from_path = ?',
          args: ['/lab/f1-lab-original'],
        })
      ).rows[0]?.to_path,
      '/lab/f1-lab-private',
    );
    assert.equal(
      (
        await database.execute({
          sql: 'SELECT COUNT(*) AS count FROM content_redirects WHERE from_path = ?',
          args: ['/lab/f1-lab-renamed'],
        })
      ).rows[0]?.count,
      1,
    );
    await assertAlias(origin, '/lab/f1-lab-original', 404);
    const labVisible = await postForm(
      origin,
      '/api/console/lab/save',
      { ...labFields, id: labId, slug: 'f1-lab-private' },
      cookie,
    );
    assert.equal(labVisible.status, 303);
    await assertAlias(
      origin,
      '/lab/f1-lab-original',
      302,
      '/lab/f1-lab-private',
    );

    // Tampering with a destination must not create an open redirect or point
    // an alias at another same-collection record.
    await database.execute({
      sql: 'UPDATE content_redirects SET to_path = ? WHERE from_path = ?',
      args: ['https://attacker.example/', '/blog/f1-blog-original'],
    });
    await assertAlias(origin, '/blog/f1-blog-original', 404);
    await database.execute({
      sql: 'UPDATE content_redirects SET to_path = ? WHERE from_path = ?',
      args: ['/blog/f1-blog-renamed', '/blog/f1-blog-original'],
    });
    await database.execute({
      sql: 'UPDATE content_redirects SET entity_id = ? WHERE from_path = ?',
      args: ['unrelated-entity', '/blog/f1-blog-original'],
    });
    await assertAlias(origin, '/blog/f1-blog-original', 404);

    const aliasRows = await database.execute(
      "SELECT from_path, to_path FROM content_redirects WHERE from_path LIKE '/blog/f1-%' ORDER BY from_path",
    );
    assert.equal(aliasRows.rows.length, 3);

    await database.execute('DROP TABLE content_redirects');
    const unavailableAlias = await fetch(`${origin}/blog/f1-blog-original`, {
      redirect: 'manual',
    });
    assert.equal(unavailableAlias.status, 503);
    assert.equal(unavailableAlias.headers.get('location'), null);
  } finally {
    if (server && server.exitCode === null) {
      server.kill('SIGTERM');
      await once(server, 'exit');
    }
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});
