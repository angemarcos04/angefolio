import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

const cwd = resolve(import.meta.dirname, '..');

test('Phase 3 additive migration preserves pre-existing content', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'angefolio-migration-test-'));
  const migrationDirectory = join(directory, 'drizzle');
  const databaseFile = join(directory, 'upgrade.sqlite');
  const client = createClient({ url: `file:${databaseFile}` });

  try {
    await cp(join(cwd, 'drizzle'), migrationDirectory, { recursive: true });
    const journalPath = join(migrationDirectory, 'meta', '_journal.json');
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as {
      entries: Array<Record<string, unknown>>;
    };
    journal.entries = journal.entries.filter((entry) => Number(entry.idx) < 12);
    await writeFile(journalPath, JSON.stringify(journal, null, 2));

    await migrate(drizzle(client), { migrationsFolder: migrationDirectory });
    const timestamp = Date.now();
    await client.execute({
      sql: `INSERT INTO blog_records
        (id, slug, title, description, summary, category, tags_json, body,
         published, featured, archived, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'pre-phase3-blog',
        'pre-phase3-blog',
        'Existing Blog',
        'Preserved description',
        null,
        'Testing',
        '[]',
        '# Existing article',
        1,
        0,
        0,
        timestamp,
        timestamp,
      ],
    });
    await client.execute({
      sql: `INSERT INTO project_records
        (id, slug, title, description, status, stack_json, links_json,
         highlights_json, replaces_mdx, featured, visible, archived,
         order_index, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'pre-phase3-project',
        'pre-phase3-project',
        'Existing Project',
        'Preserved project description',
        'Prototype',
        '["Astro"]',
        '[]',
        '[]',
        0,
        1,
        1,
        0,
        0,
        timestamp,
        timestamp,
      ],
    });

    const completeJournal = JSON.parse(
      await readFile(join(cwd, 'drizzle/meta/_journal.json'), 'utf8'),
    ) as { entries: Array<Record<string, unknown>> };
    await writeFile(journalPath, JSON.stringify(completeJournal, null, 2));
    await migrate(drizzle(client), { migrationsFolder: migrationDirectory });

    const blog = await client.execute(
      `SELECT title, description, body, cover FROM blog_records WHERE id = 'pre-phase3-blog'`,
    );
    assert.equal(blog.rows.length, 1);
    assert.equal(blog.rows[0].title, 'Existing Blog');
    assert.equal(blog.rows[0].description, 'Preserved description');
    assert.equal(blog.rows[0].body, '# Existing article');
    assert.equal(blog.rows[0].cover, null);

    const project = await client.execute(
      `SELECT title, description, stack_json, screenshots_json FROM project_records WHERE id = 'pre-phase3-project'`,
    );
    assert.equal(project.rows.length, 1);
    assert.equal(project.rows[0].title, 'Existing Project');
    assert.equal(project.rows[0].description, 'Preserved project description');
    assert.equal(project.rows[0].stack_json, '["Astro"]');
    assert.equal(project.rows[0].screenshots_json, '[]');
  } finally {
    client.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('H3 upgrade preserves rows and starts publication history without invented aliases', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'angefolio-h3-upgrade-'));
  const migrations = join(directory, 'drizzle');
  const databaseFile = join(directory, 'upgrade.sqlite');
  const client = createClient({ url: `file:${databaseFile}` });
  try {
    await cp(join(cwd, 'drizzle'), migrations, { recursive: true });
    const journalPath = join(migrations, 'meta', '_journal.json');
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as {
      entries: Array<{ idx: number }>;
    };
    journal.entries = journal.entries.filter((entry) => entry.idx !== 13);
    await writeFile(journalPath, JSON.stringify(journal, null, 2));
    await migrate(drizzle(client), { migrationsFolder: migrations });

    const timestamp = Math.floor(Date.now() / 1000);
    await client.execute({
      sql: `INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        'h3-upgrade-owner',
        'Owner',
        'h3-upgrade@example.test',
        1,
        timestamp,
        timestamp,
      ],
    });
    for (const [id, slug, published] of [
      ['h3-existing-public', 'h3-existing-alpha', 1],
      ['h3-existing-private', 'h3-existing-private-name', 0],
    ] as const) {
      await client.execute({
        sql: `INSERT INTO blog_records
          (id, slug, title, description, category, tags_json, body,
           published, featured, archived, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          slug,
          'Existing post',
          'Existing description',
          'Testing',
          '[]',
          '# Body',
          published,
          0,
          0,
          timestamp,
          timestamp,
        ],
      });
    }
    await client.execute({
      sql: `INSERT INTO content_redirects
        (from_path, to_path, entity_type, entity_id, created_at)
        VALUES (?, ?, ?, ?, ?)`,
      args: [
        '/blog/h3-existing-earlier',
        '/blog/h3-existing-alpha',
        'blog',
        'h3-existing-public',
        timestamp,
      ],
    });
    const before = (
      await client.execute('SELECT * FROM blog_records ORDER BY id')
    ).rows;
    const aliasBefore = (
      await client.execute('SELECT * FROM content_redirects')
    ).rows;
    const completeJournal = JSON.parse(
      await readFile(join(cwd, 'drizzle/meta/_journal.json'), 'utf8'),
    );
    await writeFile(journalPath, JSON.stringify(completeJournal, null, 2));
    await migrate(drizzle(client), { migrationsFolder: migrations });
    assert.deepEqual(
      (await client.execute('SELECT * FROM blog_records ORDER BY id')).rows,
      before,
    );
    assert.deepEqual(
      (await client.execute('SELECT * FROM content_redirects')).rows,
      aliasBefore,
    );
    assert.equal(
      (await client.execute('SELECT * FROM content_public_slugs')).rows.length,
      0,
    );

    // The first lifecycle write observes the existing public canonical URL.
    client.close();
    delete process.env.TURSO_AUTH_TOKEN;
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = `file:${databaseFile}`;
    const { saveBlogPost } = await import('../src/lib/server/blog');
    const { closeDatabase } = await import('../src/lib/server/db/client');
    try {
      const input = (slug: string, published: boolean) => ({
        slug,
        title: 'Existing post',
        description: 'Existing description',
        summary: null,
        cover: null,
        category: 'Testing',
        tags: [],
        body: '# Body',
        published,
        featured: false,
        archived: false,
        createdAt: new Date(timestamp * 1000),
      });
      await saveBlogPost(
        'h3-existing-public',
        input('h3-existing-alpha', false),
        'h3-upgrade-owner',
      );
      await saveBlogPost(
        'h3-existing-public',
        input('h3-existing-beta', false),
        'h3-upgrade-owner',
      );
      const inspect = createClient({ url: `file:${databaseFile}` });
      try {
        assert.deepEqual(
          (
            await inspect.execute('SELECT path FROM content_public_slugs')
          ).rows.map((row) => row.path),
          ['/blog/h3-existing-alpha'],
        );
        assert.deepEqual(
          (
            await inspect.execute(
              "SELECT from_path, to_path FROM content_redirects WHERE entity_id = 'h3-existing-public' ORDER BY from_path",
            )
          ).rows,
          [
            {
              from_path: '/blog/h3-existing-alpha',
              to_path: '/blog/h3-existing-beta',
            },
            {
              from_path: '/blog/h3-existing-earlier',
              to_path: '/blog/h3-existing-beta',
            },
          ],
        );
      } finally {
        inspect.close();
      }
    } finally {
      closeDatabase();
    }
  } finally {
    client.close();
    await rm(directory, { recursive: true, force: true });
  }
});
