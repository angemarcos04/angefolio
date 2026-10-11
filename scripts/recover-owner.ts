import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import {
  closeRecoveryDatabase,
  recoverOwnerPassword,
} from '../src/lib/server/accountRecovery';
import { requireServerEnv } from '../src/lib/server/env';
import { promptSecret } from './prompt-secret';

async function main() {
  requireServerEnv('AUTH_SECRET');
  const prompt = createInterface({ input: stdin, output: stdout });
  let email: string;
  try {
    email = (await prompt.question('Owner email: ')).trim().toLowerCase();
  } finally {
    prompt.close();
  }

  const password = await promptSecret('New password (hidden): ');
  const confirmation = await promptSecret('Confirm new password: ');
  if (password !== confirmation) {
    throw new Error('Passwords did not match. No account changes were made.');
  }

  await recoverOwnerPassword(email, password);
  console.log('Owner password reset. All existing sessions were revoked.');
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Recovery failed.');
  process.exitCode = 1;
} finally {
  closeRecoveryDatabase();
}
