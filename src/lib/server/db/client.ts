import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { getServerEnv, isProduction } from '../env';
import { schema } from './schema';

function getDatabaseUrl(): string {
  const configured = getServerEnv('DATABASE_URL');

  if (!configured && isProduction()) {
    throw new Error('DATABASE_URL is required in production.');
  }

  return configured ?? 'file:./data/angefolio.db';
}

function ensureLocalDatabaseDirectory(url: string): void {
  if (!url.startsWith('file:')) return;

  const filename = url.slice('file:'.length);
  if (!filename || filename === ':memory:') return;

  mkdirSync(dirname(resolve(filename)), { recursive: true });
}

function createDatabase() {
  const url = getDatabaseUrl();
  ensureLocalDatabaseDirectory(url);
  client = createClient({ url });
  return drizzle(client, { schema });
}

let client: Client | undefined;
let database: ReturnType<typeof createDatabase> | undefined;
let migration: Promise<void> | undefined;

export function getDatabase() {
  database ??= createDatabase();
  return database;
}

export async function migrateDatabase(): Promise<void> {
  migration ??= migrate(getDatabase(), {
    migrationsFolder: resolve(process.cwd(), 'drizzle'),
  }).catch((error: unknown) => {
    migration = undefined;
    throw error;
  });

  return migration;
}

export function closeDatabase(): void {
  client?.close();
  client = undefined;
  database = undefined;
  migration = undefined;
}
