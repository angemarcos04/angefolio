import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { createClient } from '@libsql/client';

const root = resolve(import.meta.dirname, '..');

async function createDatabase(filename) {
  const client = createClient({ url: `file:${filename}` });
  try {
    await client.batch(
      [
        'CREATE TABLE user (id TEXT PRIMARY KEY)',
        'CREATE TABLE session (id TEXT PRIMARY KEY)',
        'CREATE TABLE now_status (id TEXT PRIMARY KEY)',
        'CREATE TABLE project_records (id TEXT PRIMARY KEY)',
        'CREATE TABLE audit_log (id TEXT PRIMARY KEY)',
        "INSERT INTO user (id) VALUES ('owner')",
      ],
      'write',
    );
  } finally {
    client.close();
  }
}

test('off-host job snapshots, encrypts, uploads, verifies, and cleans temporary files', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'angefolio-offsite-test-'));
  const bin = join(workspace, 'bin');
  const database = join(workspace, 'portfolio.sqlite');
  const remoteFile = join(workspace, 'uploaded.sqlite.age');

  try {
    await mkdir(bin);
    await createDatabase(database);
    await writeFile(
      join(bin, 'age'),
      `#!/usr/bin/env node
import { copyFile, readFile, writeFile } from 'node:fs/promises';
const [recipientFlag, recipient, outputFlag, output, source] = process.argv.slice(2);
if (recipientFlag !== '-r' || !recipient || outputFlag !== '-o' || !output || !source) process.exit(2);
await writeFile(output, Buffer.concat([Buffer.from('test-encrypted:'), await readFile(source)]));
`,
    );
    await writeFile(
      join(bin, 'rclone'),
      `#!/usr/bin/env node
import assert from 'node:assert/strict';
import { copyFile, readFile } from 'node:fs/promises';
const [operation, ...args] = process.argv.slice(2);
if (operation === 'copyto') {
  assert.ok(args[1].startsWith(process.env.TEST_REMOTE_PATH + '/'));
  await copyFile(args[0], process.env.TEST_REMOTE_FILE);
} else if (operation === 'check') {
  assert.ok(args.includes('--size-only'));
  assert.ok(args.at(-1).startsWith(process.env.TEST_REMOTE_PATH + '/'));
  assert.deepEqual(await readFile(args.at(-2)), await readFile(process.env.TEST_REMOTE_FILE));
} else process.exit(2);
`,
    );
    await Promise.all([
      chmod(join(bin, 'age'), 0o755),
      chmod(join(bin, 'rclone'), 0o755),
    ]);

    const env = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      TMPDIR: workspace,
      DATABASE_URL: `file:${database}`,
      BACKUP_REMOTE: 'testremote:backups/angefolio',
      BACKUP_AGE_RECIPIENT: 'age1testrecipient',
      TEST_REMOTE_PATH: 'testremote:backups/angefolio',
      TEST_REMOTE_FILE: remoteFile,
    };
    const result = spawnSync(process.execPath, ['scripts/offsite-backup.mjs'], {
      cwd: root,
      env,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stdout,
      /uploaded and verified: angefolio-.*\.sqlite\.age/,
    );
    assert.match((await readFile(remoteFile)).toString(), /^test-encrypted:/);
    assert.deepEqual(
      (await readdir(workspace)).filter((entry) =>
        entry.startsWith('angefolio-backup-'),
      ),
      [],
    );
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('off-host job refuses to run without a remote destination', () => {
  const result = spawnSync(process.execPath, ['scripts/offsite-backup.mjs'], {
    cwd: root,
    env: { ...process.env, BACKUP_REMOTE: '', BACKUP_AGE_RECIPIENT: '' },
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BACKUP_REMOTE must be configured/);
});
