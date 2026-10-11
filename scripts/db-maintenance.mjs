import { createClient } from '@libsql/client';
import { constants } from 'node:fs';
import { access, copyFile, mkdir, stat, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

function localDatabasePath() {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith('file:')) {
    throw new Error('DATABASE_URL must point to a local SQLite file.');
  }
  const filename = url.slice('file:'.length);
  if (!filename || filename === ':memory:') {
    throw new Error('DATABASE_URL must point to a persistent SQLite file.');
  }
  return resolve(filename);
}

async function requireFile(filename) {
  const details = await stat(filename);
  if (!details.isFile() || details.size === 0) {
    throw new Error(`Not a nonempty file: ${filename}`);
  }
}

async function requireMissing(filename) {
  try {
    await access(filename, constants.F_OK);
    throw new Error(`Refusing to overwrite: ${filename}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

async function verify(filename) {
  await requireFile(filename);
  const client = createClient({ url: `file:${filename}` });
  try {
    const integrity = await client.execute('PRAGMA integrity_check');
    if (integrity.rows.length !== 1 || integrity.rows[0][0] !== 'ok') {
      throw new Error(`SQLite integrity check failed: ${filename}`);
    }
    const tables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );
    const names = new Set(tables.rows.map((row) => String(row.name)));
    for (const name of [
      'user',
      'session',
      'now_status',
      'project_records',
      'audit_log',
    ]) {
      if (!names.has(name))
        throw new Error(`Missing ${name} table: ${filename}`);
    }
  } finally {
    client.close();
  }
}

async function backup(destination) {
  const source = localDatabasePath();
  await requireFile(source);
  if (source === destination) throw new Error('Choose a separate backup path.');
  await requireMissing(destination);
  await mkdir(dirname(destination), { recursive: true });

  const client = createClient({ url: `file:${source}` });
  try {
    await client.execute({ sql: 'VACUUM INTO ?', args: [destination] });
  } catch (error) {
    await unlink(destination).catch(() => {});
    throw error;
  } finally {
    client.close();
  }
  await verify(destination);
  console.log(`Backup verified: ${destination}`);
}

async function restore(source, destination) {
  await verify(source);
  if (source === destination)
    throw new Error('Choose a separate restore path.');
  await requireMissing(destination);
  await requireMissing(`${destination}-wal`);
  await requireMissing(`${destination}-shm`);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination, constants.COPYFILE_EXCL);
  try {
    await verify(destination);
  } catch (error) {
    await unlink(destination);
    throw error;
  }
  console.log(`Restore verified: ${destination}`);
}

const [command, first, second] = process.argv.slice(2);
try {
  if (command === 'backup' && first && !second) {
    await backup(resolve(first));
  } else if (command === 'verify' && first && !second) {
    const filename = resolve(first);
    await verify(filename);
    console.log(`Database verified: ${filename}`);
  } else if (command === 'restore' && first && second) {
    await restore(resolve(first), resolve(second));
  } else {
    throw new Error(
      'Usage: db-maintenance.mjs backup <file> | verify <file> | restore <backup> <new-file>',
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
