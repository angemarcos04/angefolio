import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  access,
  chmod,
  mkdtemp,
  mkdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';

const cwd = resolve(import.meta.dirname, '..');
const tsx = resolve(cwd, 'node_modules/.bin/tsx');

interface ImporterCase {
  name: 'projects' | 'notes' | 'lab';
  script: string;
  table: string;
  conflictFilename: string;
  summary: RegExp;
  fixtures: Record<string, string>;
  conflictFixture: string;
}

const cases: ImporterCase[] = [
  {
    name: 'projects',
    script: 'scripts/import-projects.ts',
    table: 'project_records',
    conflictFilename: 'alpha-project.md',
    summary: /2 source projects, 0 existing slug conflicts\./,
    fixtures: {
      'zeta-project.md': `---\ntitle: Zeta Project\ndescription: Imported zeta fixture.\nstatus: Prototype\nfeatured: false\nvisible: false\nstack: [Astro]\ndate: '2026-10-17'\n---\n# Zeta project\n`,
      'alpha-project.mdx': `---\ntitle: Alpha Project\ndescription: Imported alpha fixture.\nstatus: Live\nfeatured: false\nvisible: false\nstack: [TypeScript]\ndate: '2026-10-17'\n---\n# Alpha project\n`,
    },
    conflictFixture: `---\ntitle: Duplicate Project\ndescription: Must not import.\nstatus: Prototype\nfeatured: false\nvisible: false\nstack: []\n---\n`,
  },
  {
    name: 'notes',
    script: 'scripts/import-notes.ts',
    table: 'note_records',
    conflictFilename: 'alpha-note.md',
    summary: /2 source notes, 0 existing slug conflicts\./,
    fixtures: {
      'zeta-note.md': `---\ntitle: Zeta Note\ndescription: Imported zeta fixture.\ncategory: Testing\ntags: [regression]\npublished: false\nfeatured: false\ncreatedAt: '2026-10-17'\n---\nZeta note body.\n`,
      'alpha-note.mdx': `---\ntitle: Alpha Note\ndescription: Imported alpha fixture.\ncategory: Testing\ntags: [regression]\npublished: false\nfeatured: false\ncreatedAt: '2026-10-17'\n---\nAlpha note body.\n`,
    },
    conflictFixture: `---\ntitle: Duplicate Note\ndescription: Must not import.\ncategory: Testing\ntags: []\npublished: false\nfeatured: false\ncreatedAt: '2026-10-17'\n---\n`,
  },
  {
    name: 'lab',
    script: 'scripts/import-lab.ts',
    table: 'lab_records',
    conflictFilename: 'alpha-lab.md',
    summary: /2 source Lab entries, 0 existing slug conflicts\./,
    fixtures: {
      'zeta-lab.md': `---\ntitle: Zeta Lab\ndescription: Imported zeta fixture.\nstatus: Prototype\nvisible: false\nfeatured: false\ntags: [regression]\ndate: '2026-10-17'\n---\nZeta lab body.\n`,
      'alpha-lab.mdx': `---\ntitle: Alpha Lab\ndescription: Imported alpha fixture.\nstatus: Testing\nvisible: false\nfeatured: false\ntags: [regression]\ndate: '2026-10-17'\n---\nAlpha lab body.\n`,
    },
    conflictFixture: `---\ntitle: Duplicate Lab\ndescription: Must not import.\nstatus: Prototype\nvisible: false\nfeatured: false\ntags: []\ndate: '2026-10-17'\n---\n`,
  },
];

function runImporter(
  script: string,
  root: string,
  databaseFile: string,
  args: string[] = [],
) {
  return spawnSync(tsx, [resolve(cwd, script), ...args], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: `file:${databaseFile}`,
    },
  });
}

async function countRows(databaseFile: string, table: string): Promise<number> {
  const database = createClient({ url: `file:${databaseFile}` });
  try {
    const result = await database.execute(
      `SELECT count(*) AS total FROM ${table}`,
    );
    return Number(result.rows[0].total);
  } finally {
    database.close();
  }
}

async function countImportHistory(
  databaseFile: string,
  entity: 'project' | 'note' | 'lab',
): Promise<{ audit: number; revisions: number }> {
  const database = createClient({ url: `file:${databaseFile}` });
  try {
    const [audit, revisions] = await Promise.all([
      database.execute({
        sql: 'SELECT count(*) AS total FROM audit_log WHERE action = ?',
        args: [`${entity}.import`],
      }),
      database.execute({
        sql: 'SELECT count(*) AS total FROM content_revisions WHERE entity_type = ?',
        args: [entity],
      }),
    ]);
    return {
      audit: Number(audit.rows[0].total),
      revisions: Number(revisions.rows[0].total),
    };
  } finally {
    database.close();
  }
}

for (const importer of cases) {
  test(`${importer.name} importer handles optional legacy directories safely`, async () => {
    const root = await mkdtemp(
      join(tmpdir(), `angefolio-import-${importer.name}-`),
    );
    const databaseFile = join(root, 'test.sqlite');
    const missingApplyDatabaseFile = join(root, 'missing-apply.sqlite');
    const emptyApplyDatabaseFile = join(root, 'empty-apply.sqlite');
    const backupFile = join(root, 'valid-import-backup.sqlite');
    const rejectedBackup = join(root, 'rejected-import-backup.sqlite');
    const sourceDirectory = join(root, 'src', 'content', importer.name);

    try {
      await symlink(join(cwd, 'drizzle'), join(root, 'drizzle'), 'dir');
      await symlink(join(cwd, 'scripts'), join(root, 'scripts'), 'dir');

      const missingDryRun = runImporter(importer.script, root, databaseFile);
      assert.equal(missingDryRun.status, 0, missingDryRun.stderr);
      assert.match(missingDryRun.stdout, /source directory not found/i);
      assert.match(
        missingDryRun.stdout,
        /0 source .*0 existing slug conflicts/,
      );
      assert.match(missingDryRun.stdout, /Dry run only/);
      assert.equal(await countRows(databaseFile, importer.table), 0);

      const missingApply = runImporter(
        importer.script,
        root,
        missingApplyDatabaseFile,
        ['--apply', '--backup', rejectedBackup],
      );
      assert.notEqual(missingApply.status, 0);
      assert.match(missingApply.stderr, /source directory is missing/i);
      assert.equal(await countRows(databaseFile, importer.table), 0);
      await assert.rejects(access(missingApplyDatabaseFile));
      await assert.rejects(access(rejectedBackup));

      await mkdir(sourceDirectory, { recursive: true });
      const emptyDryRun = runImporter(importer.script, root, databaseFile);
      assert.equal(emptyDryRun.status, 0, emptyDryRun.stderr);
      assert.match(
        emptyDryRun.stdout,
        /No \.md or \.mdx .*source files found/i,
      );
      assert.match(emptyDryRun.stdout, /0 source .*0 existing slug conflicts/);

      const emptyApply = runImporter(
        importer.script,
        root,
        emptyApplyDatabaseFile,
        ['--apply', '--backup', rejectedBackup],
      );
      assert.notEqual(emptyApply.status, 0);
      assert.match(emptyApply.stderr, /no \.md or \.mdx source files/i);
      assert.equal(await countRows(databaseFile, importer.table), 0);
      await assert.rejects(access(emptyApplyDatabaseFile));

      for (const [filename, contents] of Object.entries(importer.fixtures)) {
        await writeFile(join(sourceDirectory, filename), contents);
      }
      await writeFile(join(sourceDirectory, 'ignored.txt'), 'not Markdown');

      const validDryRun = runImporter(importer.script, root, databaseFile);
      assert.equal(validDryRun.status, 0, validDryRun.stderr);
      assert.match(validDryRun.stdout, importer.summary);
      const firstReady = validDryRun.stdout.indexOf(
        '/' + importer.name + '/alpha-',
      );
      const secondReady = validDryRun.stdout.indexOf(
        '/' + importer.name + '/zeta-',
      );
      assert.notEqual(firstReady, -1);
      assert.ok(
        firstReady < secondReady,
        'source files should be sorted by filename',
      );
      assert.equal(await countRows(databaseFile, importer.table), 0);

      const validApply = runImporter(importer.script, root, databaseFile, [
        '--apply',
        '--backup',
        backupFile,
      ]);
      assert.equal(validApply.status, 0, validApply.stderr);
      assert.match(validApply.stdout, /Imported 2/);
      assert.equal(await countRows(databaseFile, importer.table), 2);
      assert.deepEqual(
        await countImportHistory(
          databaseFile,
          importer.name === 'projects'
            ? 'project'
            : importer.name === 'notes'
              ? 'note'
              : 'lab',
        ),
        { audit: 2, revisions: 2 },
      );
      await assert.doesNotReject(access(backupFile));

      const malformedPath = join(sourceDirectory, 'invalid.md');
      await writeFile(malformedPath, '---\ntitle: [broken\n---\nBody\n');
      const malformed = runImporter(importer.script, root, databaseFile);
      assert.notEqual(malformed.status, 0);
      assert.match(malformed.stderr, /invalid\.md: invalid frontmatter/);
      assert.equal(await countRows(databaseFile, importer.table), 2);
      await rm(malformedPath);

      await rm(sourceDirectory, { recursive: true, force: true });
      await mkdir(sourceDirectory, { recursive: true });
      await writeFile(
        join(sourceDirectory, importer.conflictFilename),
        importer.conflictFixture,
      );
      await writeFile(
        join(sourceDirectory, 'new-entry.md'),
        Object.values(importer.fixtures)[0],
      );
      const conflictDryRun = runImporter(importer.script, root, databaseFile);
      assert.equal(conflictDryRun.status, 0, conflictDryRun.stderr);
      assert.match(conflictDryRun.stdout, /1 existing slug conflicts/);
      const conflictApply = runImporter(importer.script, root, databaseFile, [
        '--apply',
        '--backup',
        rejectedBackup,
      ]);
      assert.notEqual(conflictApply.status, 0);
      assert.match(conflictApply.stderr, /Resolve slug conflicts/);
      assert.equal(await countRows(databaseFile, importer.table), 2);
      await assert.rejects(access(rejectedBackup));

      await rm(sourceDirectory, { recursive: true, force: true });
      await writeFile(sourceDirectory, 'not-a-directory');
      const wrongPathType = runImporter(importer.script, root, databaseFile);
      assert.notEqual(wrongPathType.status, 0);
      assert.match(wrongPathType.stderr, /ENOTDIR/);

      await rm(sourceDirectory, { recursive: true, force: true });
      await mkdir(sourceDirectory, { recursive: true });
      await chmod(sourceDirectory, 0);
      try {
        const unreadable = runImporter(importer.script, root, databaseFile);
        assert.notEqual(unreadable.status, 0);
        assert.match(unreadable.stderr, /EACCES|permission denied/i);
      } finally {
        await chmod(sourceDirectory, 0o700);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}
