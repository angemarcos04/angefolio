import type { APIRoute } from 'astro';
import { getAuth } from '../../../lib/server/auth';
import { migrateDatabase } from '../../../lib/server/db/client';

export const ALL: APIRoute = async ({ request }) => {
  await migrateDatabase();
  return getAuth().handler(request);
};
