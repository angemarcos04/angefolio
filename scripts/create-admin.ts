import 'dotenv/config';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { eq } from 'drizzle-orm';
import { createAuth } from '../src/lib/server/auth';
import {
  closeDatabase,
  getDatabase,
  migrateDatabase,
} from '../src/lib/server/db/client';
import { user } from '../src/lib/server/db/schema';
import {
  getServerEnv,
  getSiteOrigin,
  requireServerEnv,
} from '../src/lib/server/env';
import { promptSecret } from './prompt-secret';

requireServerEnv('AUTH_SECRET');

let email = getServerEnv('ADMIN_EMAIL');
let password = getServerEnv('ADMIN_PASSWORD');

if (!email) {
  if (!stdin.isTTY) requireServerEnv('ADMIN_EMAIL');
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    email = (await prompt.question('Owner email: ')).trim();
  } finally {
    prompt.close();
  }
}

if (!password) {
  if (!stdin.isTTY) requireServerEnv('ADMIN_PASSWORD');
  password = await promptSecret('Owner password (hidden): ');
  const confirmation = await promptSecret('Confirm owner password: ');
  if (password !== confirmation) {
    throw new Error('Passwords did not match. No account was created.');
  }
}

email = email.toLowerCase();

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
  'Initial console admin created. Remove any ADMIN_EMAIL and ADMIN_PASSWORD environment values.',
);
closeDatabase();
