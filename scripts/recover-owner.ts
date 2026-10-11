import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import {
  closeRecoveryDatabase,
  recoverOwnerPassword,
} from '../src/lib/server/accountRecovery';
import { requireServerEnv } from '../src/lib/server/env';

function promptSecret(label: string): Promise<string> {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('Run password recovery in an interactive terminal.');
  }

  stdout.write(label);
  stdin.setEncoding('utf8');
  stdin.setRawMode(true);
  stdin.resume();

  return new Promise((resolve, reject) => {
    let value = '';
    const finish = (error?: Error) => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: string | Buffer) => {
      for (const character of String(chunk)) {
        if (character === '\u0003') {
          finish(new Error('Recovery cancelled.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          finish();
          return;
        }
        if (character === '\u007f' || character === '\b') {
          value = Array.from(value).slice(0, -1).join('');
          continue;
        }
        if (character >= ' ' && character !== '\u007f') value += character;
      }
    };
    stdin.on('data', onData);
  });
}

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
