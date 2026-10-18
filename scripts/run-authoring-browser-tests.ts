import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const cwd = resolve(import.meta.dirname, '..');
const directory = await mkdtemp(join(tmpdir(), 'angefolio-authoring-browser-'));
const portServer = createServer();
portServer.listen(0, '127.0.0.1');
await new Promise<void>((resolveListen, rejectListen) => {
  portServer.once('listening', resolveListen);
  portServer.once('error', rejectListen);
});
const address = portServer.address();
if (!address || typeof address === 'string') {
  throw new Error(
    'Could not reserve a local port for the authoring browser test.',
  );
}
const port = address.port;
await new Promise<void>((resolveClose, rejectClose) => {
  portServer.close((error) => (error ? rejectClose(error) : resolveClose()));
});
const origin = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  NODE_ENV: 'development',
  HOST: '127.0.0.1',
  PORT: String(port),
  PUBLIC_SITE_URL: origin,
  AUTH_TRUSTED_ORIGIN: origin,
  AUTH_SECRET: 'isolated-authoring-browser-secret-32-chars',
  DATABASE_URL: `file:${join(directory, 'portfolio.sqlite')}`,
  ADMIN_EMAIL: 'owner@authoring.test',
  ADMIN_PASSWORD: 'isolated-authoring-test-password',
  AUTHORING_TEST: '1',
  PLAYWRIGHT_TEST: 'true',
  PLAYWRIGHT_BASE_URL: origin,
};

function run(command: string, args: string[]) {
  return new Promise<void>((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: 'inherit',
    });
    child.once('error', rejectRun);
    child.once('exit', (code, signal) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${command} exited with ${code ?? signal}`));
    });
  });
}

try {
  await run('./node_modules/.bin/tsx', ['scripts/create-admin.ts']);
  await run('./node_modules/.bin/playwright', [
    'test',
    'tests/browser/authoring-reliability.spec.ts',
    '--workers=1',
    ...(process.env.AUTHORING_GREP
      ? ['--grep', process.env.AUTHORING_GREP]
      : []),
  ]);
} finally {
  await rm(directory, { recursive: true, force: true });
}
