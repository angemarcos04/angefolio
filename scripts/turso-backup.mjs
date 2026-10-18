import { execFile as execFileCallback } from 'node:child_process';
import { constants } from 'node:fs';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { createClient } from '@libsql/client';

const execFile = promisify(execFileCallback);
const [databaseName, destinationArg] = process.argv.slice(2);

process.umask(0o077);

if (
  !databaseName ||
  !/^[a-z0-9][a-z0-9-]*$/.test(databaseName) ||
  !destinationArg
) {
  throw new Error(
    'Usage: node scripts/turso-backup.mjs <database-name> <new-backup.sqlite>',
  );
}

const destination = resolve(destinationArg);
try {
  await access(destination, constants.F_OK);
  throw new Error(`Refusing to overwrite: ${destination}`);
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const workspace = await mkdtemp(join(tmpdir(), 'angefolio-turso-export-'));
const exported = join(workspace, 'export.db');

try {
  // Turso exports a SQLite snapshot plus a WAL file. VACUUM INTO folds both
  // into one verified SQLite file that can be restored without a WAL peer.
  await execFile('turso', [
    'db',
    'export',
    databaseName,
    '--output-file',
    exported,
  ]);
  await execFile(
    process.execPath,
    ['scripts/db-maintenance.mjs', 'backup', destination],
    {
      env: { ...process.env, DATABASE_URL: `file:${exported}` },
    },
  );

  // Turso's file import accepts WAL-mode SQLite files. VACUUM INTO creates a
  // rollback-journal file, so switch the verified copy before storing it.
  const client = createClient({ url: `file:${destination}` });
  try {
    const mode = await client.execute('PRAGMA journal_mode=WAL');
    if (mode.rows[0]?.[0] !== 'wal') {
      throw new Error('Could not switch Turso backup to WAL mode.');
    }
    await client.execute('PRAGMA wal_checkpoint(TRUNCATE)');
  } finally {
    client.close();
  }
  await execFile(process.execPath, [
    'scripts/db-maintenance.mjs',
    'verify',
    destination,
  ]);
  console.log(`Turso backup verified: ${destination}`);
} finally {
  await rm(workspace, { recursive: true, force: true });
}
