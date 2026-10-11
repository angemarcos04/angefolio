import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);

function required(name) {
  const value = process.env[name]?.trim();
  if (!value)
    throw new Error(`${name} must be configured for off-host backups.`);
  return value;
}

async function run(command, args) {
  try {
    return await execFile(command, args, { maxBuffer: 1024 * 1024 });
  } catch (error) {
    throw new Error(`${command} failed (exit ${error?.code ?? 'unknown'}).`);
  }
}

const remote = required('BACKUP_REMOTE');
const recipient = required('BACKUP_AGE_RECIPIENT');
const stamp = new Date().toISOString().replaceAll(':', '-');
const name = `angefolio-${stamp}.sqlite.age`;
const workspace = await mkdtemp(join(tmpdir(), 'angefolio-backup-'));
const database = join(workspace, 'database.sqlite');
const encrypted = join(workspace, name);
const remoteFile = `${remote.replace(/\/$/, '')}/${name}`;

try {
  await run(process.execPath, [
    'scripts/db-maintenance.mjs',
    'backup',
    database,
  ]);
  await run('age', ['-r', recipient, '-o', encrypted, database]);
  const localSize = (await stat(encrypted)).size;
  if (!localSize) throw new Error('Encrypted backup is empty.');

  await run('rclone', ['copyto', encrypted, remoteFile]);
  await run('rclone', ['check', '--size-only', encrypted, remoteFile]);
  console.log(`Encrypted database backup uploaded and verified: ${name}`);
} finally {
  await rm(workspace, { recursive: true, force: true });
}
