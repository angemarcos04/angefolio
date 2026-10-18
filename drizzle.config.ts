import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const url = process.env.DATABASE_URL ?? 'file:./data/angefolio.db';
const shared = {
  schema: './src/lib/server/db/schema.ts',
  out: './drizzle',
  strict: true,
  verbose: true,
};

function createConfig() {
  if (url.startsWith('file:'))
    return defineConfig({
      ...shared,
      dialect: 'sqlite',
      dbCredentials: { url },
    });

  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (!authToken)
    throw new Error('TURSO_AUTH_TOKEN is required for a remote database.');

  return defineConfig({
    ...shared,
    dialect: 'turso',
    dbCredentials: { url, authToken },
  });
}

export default createConfig();
