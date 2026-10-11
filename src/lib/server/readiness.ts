import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getDatabase } from './db/client';

interface MigrationJournal {
  entries?: Array<{ when?: unknown }>;
}

export async function isServiceReady(): Promise<boolean> {
  try {
    const journalPath = resolve(process.cwd(), 'drizzle/meta/_journal.json');
    const journal = JSON.parse(
      await readFile(journalPath, 'utf8'),
    ) as MigrationJournal;
    const latestMigration = journal.entries?.at(-1)?.when;
    if (typeof latestMigration !== 'number') return false;

    const client = getDatabase().$client;
    const [probe, migrations] = await Promise.all([
      client.execute('SELECT 1 AS ready'),
      client.execute(
        'SELECT MAX(created_at) AS latest FROM "__drizzle_migrations"',
      ),
    ]);
    return (
      Number(probe.rows[0]?.ready) === 1 &&
      Number(migrations.rows[0]?.latest) === latestMigration
    );
  } catch {
    return false;
  }
}
