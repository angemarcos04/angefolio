import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { createAuth } from '../src/lib/server/auth';
import {
  closeDatabase,
  getDatabase,
  migrateDatabase,
} from '../src/lib/server/db/client';
import { user } from '../src/lib/server/db/schema';
import { getSiteOrigin, requireServerEnv } from '../src/lib/server/env';

const email = requireServerEnv('ADMIN_EMAIL').toLowerCase();
const password = requireServerEnv('ADMIN_PASSWORD');
requireServerEnv('AUTH_SECRET');

if (!/^\S+@\S+\.\S+$/.test(email)) {
  throw new Error('ADMIN_EMAIL must be a valid email address.');
}

if (password.length < 12 || password.length > 128) {
  throw new Error('ADMIN_PASSWORD must contain between 12 and 128 characters.');
}

await migrateDatabase();

const existingUser = await getDatabase().query.user.findFirst({
  where: eq(user.email, email),
  columns: { id: true },
});

if (existingUser) {
  console.log('Admin account already exists; no changes were made.');
  closeDatabase();
  process.exit(0);
}

const anyUser = await getDatabase().query.user.findFirst({
  columns: { id: true },
});

if (anyUser) {
  throw new Error(
    'An account already exists. Phase 11 bootstrap will not create additional users.',
  );
}

const bootstrapAuth = createAuth({ allowSignUp: true });

await bootstrapAuth.api.signUpEmail({
  body: {
    name: 'Angellie Marcos',
    email,
    password,
  },
  headers: new Headers({ origin: getSiteOrigin() }),
});

console.log(
  'Initial console admin created. Remove ADMIN_EMAIL and ADMIN_PASSWORD.',
);
closeDatabase();
