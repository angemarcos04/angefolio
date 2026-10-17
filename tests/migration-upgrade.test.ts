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
    journal.entries = journal.entries.filter((entry) => entry.idx !== 12);
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
