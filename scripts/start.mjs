const required = ['AUTH_SECRET', 'DATABASE_URL'];

for (const name of required) {
  if (!process.env[name]?.trim()) {
    throw new Error(
      `${name} is required before starting angefolio in production.`,
    );
  }
}

if (process.env.AUTH_SECRET.trim().length < 32) {
  throw new Error('AUTH_SECRET must contain at least 32 random characters.');
}

const origin =
  process.env.AUTH_TRUSTED_ORIGIN?.split(',')[0] ?? process.env.PUBLIC_SITE_URL;

if (!origin) {
  throw new Error('AUTH_TRUSTED_ORIGIN or PUBLIC_SITE_URL is required.');
}

new URL(origin);

await import('../dist/server/entry.mjs');
