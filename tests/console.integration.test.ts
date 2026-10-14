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
import {
  defaultHomepageConfig,
  homepageCardKeys,
} from '../src/lib/data/homepage';

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
      const response = await fetch(origin);
      if (response.ok) return;
    } catch {
      // The standalone server has not started yet.
    }
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error(`Server did not start. ${getOutput()}`);
}

function formRequest(
  origin: string,
  path: string,
  values: Record<string, string>,
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
    body: new URLSearchParams(values),
  });
}

test('private edits, audit history, recovery, and database backup', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'angefolio-console-test-'));
  const databaseFile = join(directory, 'portfolio.sqlite');
  const backupFile = join(directory, 'backup.sqlite');
  const restoredFile = join(directory, 'restored.sqlite');
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const email = 'owner@angefolio.test';
  const password = 'phase-13-test-password-long';
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: String(port),
    PUBLIC_SITE_URL: origin,
    AUTH_TRUSTED_ORIGIN: origin,
    AUTH_SECRET: 'phase-13-integration-secret-at-least-32-characters',
    DATABASE_URL: `file:${databaseFile}`,
    ADMIN_EMAIL: email,
    ADMIN_PASSWORD: password,
  };

  let server: ReturnType<typeof spawn> | undefined;
  let output = '';
  const database = createClient({ url: env.DATABASE_URL });
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

    const readiness = await fetch(`${origin}/health/ready`);
    assert.equal(readiness.status, 200);
    assert.deepEqual(await readiness.json(), { status: 'ready' });
    assert.equal(readiness.headers.get('cache-control'), 'no-store');
    const latestMigration = await database.execute(
      'SELECT hash, created_at FROM "__drizzle_migrations" ORDER BY created_at DESC LIMIT 1',
    );
    await database.execute({
      sql: 'DELETE FROM "__drizzle_migrations" WHERE hash = ?',
      args: [latestMigration.rows[0].hash],
    });
    const outdatedReadiness = await fetch(`${origin}/health/ready`);
    assert.equal(outdatedReadiness.status, 503);
    assert.deepEqual(await outdatedReadiness.json(), { status: 'not_ready' });
    await database.execute({
      sql: 'INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)',
      args: [latestMigration.rows[0].hash, latestMigration.rows[0].created_at],
    });

    const privatePage = await fetch(`${origin}/user`, {
      redirect: 'manual',
    });
    assert.equal(privatePage.status, 303);
    assert.equal(privatePage.headers.get('location'), '/user/login');
    assert.equal(
      (await formRequest(origin, '/api/console/now', {})).status,
      401,
    );
    assert.equal(
      (
        await formRequest(origin, '/api/console/markdown-preview', {
          markdown: '# Private',
        })
      ).status,
      401,
    );
    assert.doesNotMatch(
      await (await fetch(`${origin}/projects`)).text(),
      /CSPAMS/,
    );
    assert.doesNotMatch(
      await (await fetch(origin)).text(),
      /href="\/user(?:\/|\")/,
    );
    assert.equal((await fetch(`${origin}/console`)).status, 404);

    const badLogin = await formRequest(
      origin,
      '/api/console/login',
      { email, password },
      undefined,
      'https://untrusted.example',
    );
    assert.equal(badLogin.status, 403);

    const login = await formRequest(origin, '/api/console/login', {
      email,
      password,
    });
    assert.equal(login.status, 303);
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    assert(cookie, 'login must set a session cookie');
    assert.equal(
      (await fetch(`${origin}/user`, { headers: { cookie } })).status,
      200,
    );
    const preview = await formRequest(
      origin,
      '/api/console/markdown-preview',
      { markdown: '**Bold** <script>alert(1)</script>' },
      cookie,
    );
    const previewHtml = await preview.text();
    assert.match(previewHtml, /<strong>Bold<\/strong>/);
    assert.doesNotMatch(previewHtml, /<script>/);

    const nowFields = {
      currentFocus: 'Testing private publishing',
      workingOn: 'Project recovery',
      learning: 'Backups',
      using: 'Astro',
      published: 'on',
    };
    const badOrigin = await formRequest(
      origin,
      '/api/console/now',
      nowFields,
      cookie,
      'https://untrusted.example',
    );
    assert.equal(badOrigin.status, 403);
    const badNow = await formRequest(
      origin,
      '/api/console/now',
      { ...nowFields, currentFocus: '' },
      cookie,
    );
    assert.match(badNow.headers.get('location') ?? '', /error=validation/);
    assert.equal(
      (await database.execute('SELECT count(*) AS total FROM audit_log'))
        .rows[0].total,
      0,
    );

    const invalidSettings = await formRequest(
      origin,
      '/api/console/settings',
      {
        siteName: 'Test portfolio',
        name: 'Test Owner',
        seoDescription: 'An integration test portfolio.',
        github: 'https://not-github.example/test',
        email: 'owner@example.test',
      },
      cookie,
    );
    assert.match(
      invalidSettings.headers.get('location') ?? '',
      /error=validation/,
    );
    assert.equal(
      (await database.execute('SELECT count(*) AS total FROM audit_log'))
        .rows[0].total,
      0,
    );

    const savedSettings = await formRequest(
      origin,
      '/api/console/settings',
      {
        siteName: 'Test portfolio',
        name: 'Test Owner',
        seoDescription: 'An integration test portfolio.',
        github: 'https://github.com/test-owner',
        email: 'owner@example.test',
      },
      cookie,
    );
    assert.equal(
      savedSettings.headers.get('location'),
      '/user/settings?saved=1',
    );
    const publicSettingsPage = await (await fetch(origin)).text();
    assert.match(publicSettingsPage, /content="Test portfolio"/);
    assert.match(publicSettingsPage, /content="Test Owner"/);
    assert.match(publicSettingsPage, /mailto:owner@example\.test/);
    assert.match(
      publicSettingsPage,
      /href="https:\/\/github\.com\/test-owner"/,
    );

    const settingsRevision = await database.execute({
      sql: "SELECT id FROM content_revisions WHERE entity_type = 'site_settings' ORDER BY rowid DESC LIMIT 1",
    });
    const restoreSettings = await formRequest(
      origin,
      '/api/console/revisions/restore',
      {
        entityType: 'site_settings',
        entityId: 'primary',
        revisionId: String(settingsRevision.rows[0].id),
      },
      cookie,
    );
    assert.match(
      restoreSettings.headers.get('location') ?? '',
      /\/user\/settings\?notice=restored/,
    );
    const searchPage = await (await fetch(`${origin}/search`)).text();
    assert.match(searchPage, /<title>Search — Test Owner<\/title>/);
    assert.match(searchPage, /<a href="\/blog"[^>]*>Blog<\/a>/);

    const savedNow = await formRequest(
      origin,
      '/api/console/now',
      nowFields,
      cookie,
    );
    assert.equal(savedNow.headers.get('location'), '/user/now?saved=1');
    assert.match(
      await (await fetch(origin)).text(),
      /Testing private publishing/,
    );

    const projectFields = {
      slug: 'phase-13-test',
      title: 'Phase 13 Test',
      description: 'Temporary integration project.',
      status: 'Prototype',
      stack: 'Astro',
      caseStudyBody: 'A private draft body.',
    };
    const invalidProject = await formRequest(
      origin,
      '/api/console/projects/create',
      { ...projectFields, slug: 'invalid slug' },
      cookie,
    );
    assert.match(
      invalidProject.headers.get('location') ?? '',
      /error=validation/,
    );
    const created = await formRequest(
      origin,
      '/api/console/projects/create',
      projectFields,
      cookie,
    );
    assert.equal(
      created.headers.get('location'),
      '/user/projects?notice=created',
    );
    const project = await database.execute({
      sql: 'SELECT id, visible FROM project_records WHERE slug = ?',
      args: [projectFields.slug],
    });
    const id = String(project.rows[0].id);
    assert.equal(project.rows[0].visible, 0);
    assert.doesNotMatch(
      await (await fetch(`${origin}/projects`)).text(),
      /Phase 13 Test/,
    );

    const updated = await formRequest(
      origin,
      `/api/console/projects/${id}/update`,
      { ...projectFields, description: 'Edited integration project.' },
      cookie,
    );
    assert.equal(
      updated.headers.get('location'),
      '/user/projects?notice=updated',
    );
    const featured = await formRequest(
      origin,
      `/api/console/projects/${id}/toggle-featured`,
      { intent: 'toggle-featured' },
      cookie,
    );
    assert.match(featured.headers.get('location') ?? '', /notice=featured/);

    const deniedToggle = await formRequest(
      origin,
      `/api/console/projects/${id}/toggle-visible`,
      { intent: 'toggle-visible' },
      cookie,
      'https://untrusted.example',
    );
    assert.equal(deniedToggle.status, 403);
    const shown = await formRequest(
      origin,
      `/api/console/projects/${id}/toggle-visible`,
      { intent: 'toggle-visible' },
      cookie,
    );
    assert.match(shown.headers.get('location') ?? '', /notice=visibility/);
    const publicProjects = await (await fetch(`${origin}/projects`)).text();
    assert.match(publicProjects, /Phase 13 Test/);
    assert.doesNotMatch(publicProjects, /CSPAMS/);
    assert.match(await (await fetch(origin)).text(), /Phase 13 Test/);
    const newDetail = await fetch(`${origin}/projects/phase-13-test`);
    assert.equal(newDetail.status, 200);
    assert.match(await newDetail.text(), /A private draft body/);

    const archived = await formRequest(
      origin,
      `/api/console/projects/${id}/archive`,
      { intent: 'archive' },
      cookie,
    );
    assert.match(archived.headers.get('location') ?? '', /notice=archived/);
    assert.doesNotMatch(
      await (await fetch(`${origin}/projects`)).text(),
      /Phase 13 Test/,
    );
    assert.doesNotMatch(await (await fetch(origin)).text(), /Phase 13 Test/);
    assert.equal((await fetch(`${origin}/projects/phase-13-test`)).status, 404);
    assert.match(
      await (
        await fetch(`${origin}/user/projects/${id}`, { headers: { cookie } })
      ).text(),
      /Restore/,
    );
    const deniedRestore = await formRequest(
      origin,
      `/api/console/projects/${id}/restore`,
      { intent: 'restore' },
    );
    assert.equal(deniedRestore.status, 401);
    const restored = await formRequest(
      origin,
      `/api/console/projects/${id}/restore`,
      { intent: 'restore' },
      cookie,
    );
    assert.match(restored.headers.get('location') ?? '', /notice=restored/);
    const restoredProject = await database.execute({
      sql: 'SELECT status, archived, visible, featured FROM project_records WHERE id = ?',
      args: [id],
    });
    assert.equal(restoredProject.rows[0].status, 'Prototype');
    assert.equal(restoredProject.rows[0].archived, 0);
    assert.equal(restoredProject.rows[0].visible, 0);
    assert.equal(restoredProject.rows[0].featured, 0);

    const events = await database.execute(
      'SELECT action FROM audit_log ORDER BY created_at, rowid',
    );
    assert.deepEqual(
      events.rows.map((row) => row.action),
      [
        'site_settings.update',
        'site_settings.revision.restore',
        'now.update',
        'project.create',
        'project.update',
        'project.featured',
        'project.visibility',
        'project.archive',
        'project.restore',
      ],
    );
    await execFileAsync(
      process.execPath,
      ['scripts/db-maintenance.mjs', 'backup', backupFile],
      { cwd, env },
    );
    await execFileAsync(
      process.execPath,
      ['scripts/db-maintenance.mjs', 'restore', backupFile, restoredFile],
      { cwd, env },
    );
    const recovered = createClient({ url: `file:${restoredFile}` });
    try {
      const result = await recovered.execute(
        'SELECT count(*) AS total FROM audit_log',
      );
      assert.equal(result.rows[0].total, 9);
    } finally {
      recovered.close();
    }

    const dryRun = await execFileAsync(
      './node_modules/.bin/tsx',
      ['scripts/import-projects.ts'],
      { cwd, env },
    );
    assert.match(dryRun.stdout, /0 source projects, 0 existing slug conflicts/);
    const changedCaseStudy = await formRequest(
      origin,
      `/api/console/projects/${id}/update`,
      {
        slug: 'phase-13-test',
        title: 'Phase 13 Test',
        description: 'Edited from the private workspace.',
        status: 'In Progress',
        stack: 'Laravel\nPostgreSQL',
        caseStudyBody: '# Edited case study\n\n<script>alert(1)</script>',
        projectDate: '2026-06-12',
        visible: 'on',
      },
      cookie,
    );
    assert.equal(
      changedCaseStudy.headers.get('location'),
      '/user/projects?notice=updated',
    );
    const caseStudyDetail = await (
      await fetch(`${origin}/projects/phase-13-test`)
    ).text();
    assert.match(caseStudyDetail, /Edited case study/);
    assert.match(caseStudyDetail, /id="edited-case-study"/);
    assert.match(caseStudyDetail, /href="#edited-case-study"/);
    assert.doesNotMatch(caseStudyDetail, /<script>alert\(1\)<\/script>/);
    const movedCaseStudy = await formRequest(
      origin,
      `/api/console/projects/${id}/update`,
      {
        slug: 'phase-13-moved',
        title: 'Phase 13 Test',
        description: 'Edited from the private workspace.',
        status: 'In Progress',
        caseStudyBody: '# Edited case study',
        visible: 'on',
      },
      cookie,
    );
    assert.equal(
      movedCaseStudy.headers.get('location'),
      '/user/projects?notice=updated',
    );
    const oldCaseStudyUrl = await fetch(`${origin}/projects/phase-13-test`, {
      redirect: 'manual',
    });
    assert.equal(oldCaseStudyUrl.status, 308);
    assert.equal(
      oldCaseStudyUrl.headers.get('location'),
      '/projects/phase-13-moved',
    );
    const search = await (
      await fetch(`${origin}/api/search/projects?q=Edited`)
    ).json();
    assert(
      search.some(
        (result: { url: string }) => result.url === '/projects/phase-13-moved',
      ),
    );
    assert.match(
      await (await fetch(`${origin}/sitemap-projects.xml`)).text(),
      /\/projects\/phase-13-moved/,
    );
    const archivedCaseStudy = await formRequest(
      origin,
      `/api/console/projects/${id}/archive`,
      { intent: 'archive' },
      cookie,
    );
    assert.match(
      archivedCaseStudy.headers.get('location') ?? '',
      /notice=archived/,
    );
    assert.equal(
      (await fetch(`${origin}/projects/phase-13-moved`)).status,
      404,
    );

    const homepageFields: Record<string, string> = {
      heroName: 'Test Owner',
      heroRoles: 'Developer',
      portrait: '/91889584.jpeg',
      aboutParagraphs: 'Testing the homepage settings.',
      affiliations:
        'AMA Computer College – Santiago | Education | /affiliations/ama-computer-college.png',
      aboutMetadata: 'focus | Testing',
      projectLimit: '0',
      noteLimit: '0',
      blogLimit: '0',
      labLimit: '0',
      stackGroups: 'Frontend | Astro',
      activityStatus: defaultHomepageConfig.activityStatus,
      credentials: JSON.stringify([
        {
          id: 'test-credential',
          title: 'Test verified badge',
          issuer: 'Test Issuer',
          type: 'digital_badge',
          image: '/credentials/test-badge.webp',
          verificationUrl: 'https://www.credly.com/badges/test-assertion',
          credentialId: 'TEST-ID-123',
          source: 'credly',
          sourceUrl: 'https://www.credly.com/users/test-owner',
          issuedAt: '2025-04-12',
          expiresAt: null,
          featured: true,
          visible: true,
          order: 0,
        },
        {
          id: 'hidden-test-credential',
          title: 'Hidden test credential',
          issuer: 'Test Issuer',
          type: 'course',
          image: null,
          verificationUrl: null,
          source: 'manual',
          sourceUrl: null,
          issuedAt: null,
          expiresAt: null,
          featured: true,
          visible: false,
          order: 1,
        },
        {
          id: 'visible-nonfeatured-test-credential',
          title: 'Visible non-featured credential',
          issuer: 'Second Test Issuer',
          type: 'license',
          image: null,
          verificationUrl: null,
          source: 'manual',
          sourceUrl: null,
          issuedAt: '2024-05',
          expiresAt: null,
          featured: false,
          visible: true,
          order: 2,
        },
      ]),
    };
    for (const key of homepageCardKeys) {
      const card = defaultHomepageConfig.cards[key];
      homepageFields[`card_visible_${key}`] = 'on';
      homepageFields[`card_eyebrow_${key}`] = card.eyebrow;
      homepageFields[`card_title_${key}`] = card.title;
      homepageFields[`card_description_${key}`] = card.description;
    }
    const savedHomepage = await formRequest(
      origin,
      '/api/console/homepage',
      homepageFields,
      cookie,
    );
    assert.equal(
      savedHomepage.headers.get('location'),
      '/user/homepage?saved=1',
    );
    const publicHomepage = await (await fetch(`${origin}/`)).text();
    assert.match(publicHomepage, /Education &amp; Involvement/);
    assert.match(publicHomepage, /AMA Computer College – Santiago/);
    assert.match(publicHomepage, /\/affiliations\/ama-computer-college\.png/);
    assert.match(publicHomepage, /Test verified badge/);
    assert.doesNotMatch(publicHomepage, /ID: TEST-ID-123/);
    assert.match(
      publicHomepage,
      /https:\/\/www\.credly\.com\/badges\/test-assertion/,
    );
    assert.doesNotMatch(publicHomepage, /Hidden test credential/);
    const publicCredentialArchive = await (
      await fetch(`${origin}/credentials`)
    ).text();
    assert.match(publicCredentialArchive, /Test verified badge/);
    assert.match(publicCredentialArchive, /TEST-ID-123/);
    assert.match(publicCredentialArchive, /Visible non-featured credential/);
    assert.doesNotMatch(publicCredentialArchive, /Hidden test credential/);
    const credentialsSitemap = await (
      await fetch(`${origin}/sitemap-credentials.xml`)
    ).text();
    assert.match(
      credentialsSitemap,
      /<loc>https:\/\/[^<]+\/credentials<\/loc>/,
    );
    assert.doesNotMatch(publicHomepage, /about-metadata/);
    const homepageEditor = await (
      await fetch(`${origin}/user/homepage`, { headers: { cookie } })
    ).text();
    assert.match(homepageEditor, /name="blogLimit"/);
    assert.match(homepageEditor, /name="labLimit"/);
    assert.match(homepageEditor, /Credential collection/);
    assert.match(homepageEditor, /Add credential/);
    assert.match(homepageEditor, /Verification URL/);
    assert.match(homepageEditor, /Credential ID/);
    assert.match(homepageEditor, /Test verified badge/);
    assert.match(homepageEditor, /value="0"/);

    const logout = await formRequest(origin, '/user/logout', {}, cookie);
    assert.equal(logout.status, 303);
    const afterLogout = await fetch(`${origin}/user`, {
      headers: { cookie },
      redirect: 'manual',
    });
    assert.equal(afterLogout.status, 303);

    const recoverySessionLogin = await formRequest(
      origin,
      '/api/console/login',
      {
        email,
        password,
      },
    );
    const recoveryCookie = recoverySessionLogin.headers
      .get('set-cookie')
      ?.split(';')[0];
    assert(recoveryCookie);

    const envKeys = [
      'DATABASE_URL',
      'AUTH_SECRET',
      'PUBLIC_SITE_URL',
      'AUTH_TRUSTED_ORIGIN',
    ] as const;
    const previousEnv = Object.fromEntries(
      envKeys.map((key) => [key, process.env[key]]),
    );
    Object.assign(process.env, {
      DATABASE_URL: env.DATABASE_URL,
      AUTH_SECRET: env.AUTH_SECRET,
      PUBLIC_SITE_URL: origin,
      AUTH_TRUSTED_ORIGIN: origin,
    });
    let closeRecovery: (() => void) | undefined;
    try {
      const recovery = await import('../src/lib/server/accountRecovery');
      closeRecovery = recovery.closeRecoveryDatabase;
      await assert.rejects(
        recovery.recoverOwnerPassword('other@example.test', 'new-password-123'),
        /single existing owner account/,
      );
      await recovery.recoverOwnerPassword(email, 'phase-23-recovered-password');
    } finally {
      closeRecovery?.();
      for (const key of envKeys) {
        const value = previousEnv[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
    const revokedSession = await fetch(`${origin}/user`, {
      headers: { cookie: recoveryCookie },
      redirect: 'manual',
    });
    assert.equal(revokedSession.status, 303);
    const recoveredLogin = await formRequest(origin, '/api/console/login', {
      email,
      password: 'phase-23-recovered-password',
    });
    assert.equal(recoveredLogin.status, 303);
    const recoveryAudit = await database.execute(
      "SELECT action FROM audit_log WHERE action = 'owner.password.recover'",
    );
    assert.equal(recoveryAudit.rows.length, 1);
  } finally {
    database.close();
    if (server && server.exitCode === null) {
      server.kill('SIGTERM');
      await once(server, 'exit');
    }
    await rm(directory, { recursive: true, force: true });
  }
});
