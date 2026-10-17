import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
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

test('blog drafts remain private and publishing updates the public indexes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'angefolio-blog-test-'));
  const databaseFile = join(directory, 'blog.sqlite');
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const email = 'owner@angefolio.test';
  const password = 'phase-25-blog-test-password';
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: String(port),
    PUBLIC_SITE_URL: origin,
    AUTH_TRUSTED_ORIGIN: origin,
    AUTH_SECRET: 'phase-25-integration-secret-at-least-32-characters',
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
        const response = await fetch(`${origin}/blog`);
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        // Wait for the standalone server to start.
      }
      await new Promise((done) => setTimeout(done, 250));
    }
    assert(ready, `Server did not start. ${output}`);

    const login = await postForm(origin, '/api/console/login', {
      email,
      password,
    });
    assert.equal(login.status, 303);
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    assert(cookie);
    const editor = await fetch(`${origin}/user/blog`, { headers: { cookie } });
    assert.equal(editor.status, 200);

    const unauthenticatedUpload = await fetch(
      `${origin}/api/console/media/upload`,
      {
        method: 'POST',
        headers: { origin },
        body: new FormData(),
      },
    );
    assert.equal(unauthenticatedUpload.status, 401);
    const untrustedUpload = await fetch(`${origin}/api/console/media/upload`, {
      method: 'POST',
      headers: { origin: 'https://untrusted.example', cookie },
      body: new FormData(),
    });
    assert.equal(untrustedUpload.status, 403);

    const uploadForm = new FormData();
    uploadForm.set(
      'image',
      new Blob([await readFile(join(cwd, 'public/og.png'))], {
        type: 'image/png',
      }),
      'cover.png',
    );
    const uploaded = await fetch(`${origin}/api/console/media/upload`, {
      method: 'POST',
      headers: { origin, cookie },
      body: uploadForm,
    });
    assert.equal(uploaded.status, 200);
    const uploadedPath = ((await uploaded.json()) as { path: string }).path;
    assert.match(uploadedPath, /^\/media\/[a-f0-9-]+\.webp$/);
    const media = await fetch(`${origin}${uploadedPath}`);
    assert.equal(media.status, 200);
    assert.equal(media.headers.get('content-type'), 'image/webp');

    const fields = {
      slug: 'a-first-article',
      title: 'A First Article',
      description: 'A test article for the Blog section.',
      summary: 'A short summary.',
      cover: uploadedPath,
      category: 'Writing',
      tags: 'testing\nblog',
      createdAt: new Date().toISOString().slice(0, 10),
      body: '# Draft\n\nPrivate text.',
    };
    const draft = await postForm(
      origin,
      '/api/console/blog/save',
      fields,
      cookie,
    );
    const draftLocation = draft.headers.get('location') ?? '';
    assert.match(draftLocation, /^\/user\/blog\/[a-f0-9-]+\?notice=saved$/);
    const postId = draftLocation.match(/^\/user\/blog\/([^?]+)/)?.[1];
    assert(postId);
    assert.equal((await fetch(`${origin}/blog/a-first-article`)).status, 404);
    assert.doesNotMatch(
      await (await fetch(`${origin}/blog`)).text(),
      /A First Article/,
    );
    assert.doesNotMatch(await (await fetch(origin)).text(), /A First Article/);
    assert.deepEqual(
      await (await fetch(`${origin}/api/search/blog?q=Private`)).json(),
      [],
    );

    const published = await postForm(
      origin,
      '/api/console/blog/save',
      {
        ...fields,
        id: postId,
        published: 'on',
        featured: 'on',
        body: `# Published\n\n**Public text.** <script>alert(1)</script>\n\n![Uploaded screenshot](${uploadedPath})`,
      },
      cookie,
    );
    assert.equal(
      published.headers.get('location'),
      `/user/blog/${postId}?notice=saved`,
    );
    const article = await fetch(`${origin}/blog/a-first-article`);
    assert.equal(article.status, 200);
    const articleHtml = await article.text();
    assert.match(articleHtml, /Public text/);
    assert.match(articleHtml, new RegExp(uploadedPath.replaceAll('/', '\\/')));
    assert.match(articleHtml, /alt="Uploaded screenshot"/);
    assert.doesNotMatch(articleHtml, /<script>alert\(1\)<\/script>/);
    assert.match(
      await (await fetch(`${origin}/blog`)).text(),
      /A First Article/,
    );
    assert.match(await (await fetch(origin)).text(), /A First Article/);
    const search = await (
      await fetch(`${origin}/api/search/blog?q=Public`)
    ).json();
    assert(
      search.some(
        (result: { url: string }) => result.url === '/blog/a-first-article',
      ),
    );
    assert.match(
      await (await fetch(`${origin}/blog/rss.xml`)).text(),
      /A First Article/,
    );
    assert.match(
      await (await fetch(`${origin}/sitemap-blog.xml`)).text(),
      /\/blog\/a-first-article/,
    );

    const archived = await postForm(
      origin,
      '/api/console/blog/save',
      {
        ...fields,
        id: postId,
        published: 'on',
        featured: 'on',
        archived: 'on',
      },
      cookie,
    );
    assert.equal(
      archived.headers.get('location'),
      `/user/blog/${postId}?notice=saved`,
    );
    assert.equal((await fetch(`${origin}/blog/a-first-article`)).status, 404);
    assert.doesNotMatch(await (await fetch(origin)).text(), /A First Article/);
    assert.deepEqual(
      await (await fetch(`${origin}/api/search/blog?q=Public`)).json(),
      [],
    );
    assert.doesNotMatch(
      await (await fetch(`${origin}/blog/rss.xml`)).text(),
      /A First Article/,
    );
    assert.doesNotMatch(
      await (await fetch(`${origin}/sitemap-blog.xml`)).text(),
      /\/blog\/a-first-article/,
    );
  } finally {
    if (server && server.exitCode === null) {
      server.kill('SIGTERM');
      await once(server, 'exit');
    }
    await rm(directory, { recursive: true, force: true });
  }
});
