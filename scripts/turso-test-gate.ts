import { createClient } from '@libsql/client';

export interface StagingConfig {
  url: string;
  token: string;
  host: string;
  identity: string;
  ownerEmail: string;
  ownerPassword: string;
}

/** Parse configuration without opening a database connection. */
export function readStagingConfig(env: NodeJS.ProcessEnv): StagingConfig {
  if (env.TURSO_INTEGRATION_TEST !== '1')
    throw new Error('BLOCKED: TURSO_INTEGRATION_TEST=1 is required.');
  const url = env.TEST_TURSO_DATABASE_URL?.trim();
  const token = env.TEST_TURSO_AUTH_TOKEN?.trim();
  const host = env.TEST_TURSO_EXPECTED_HOST?.trim().toLowerCase();
  const identity = env.TEST_TURSO_DATABASE_ID?.trim();
  if (!url || !token || !host || !identity)
    throw new Error(
      'BLOCKED: staging URL, token, host, and identity are required.',
    );
  if (identity !== env.TEST_TURSO_CONFIRM_DATABASE_ID?.trim())
    throw new Error('BLOCKED: staging identity confirmation does not match.');
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('BLOCKED: staging database URL is malformed.');
  }
  if (
    parsed.protocol !== 'libsql:' ||
    parsed.hostname.toLowerCase() !== host ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    (parsed.pathname !== '' && parsed.pathname !== '/') ||
    parsed.search ||
    parsed.hash ||
    !host.endsWith('.turso.io')
  )
    throw new Error(
      'BLOCKED: staging URL does not match the expected Turso host.',
    );
  for (const productionUrl of [env.DATABASE_URL, env.PRODUCTION_DATABASE_URL]) {
    if (!productionUrl) continue;
    let productionHost: string;
    try {
      productionHost = new URL(productionUrl).host.toLowerCase();
    } catch {
      throw new Error(
        'BLOCKED: configured production database URL is malformed.',
      );
    }
    if (productionHost === parsed.host.toLowerCase())
      throw new Error('BLOCKED: staging and production database hosts match.');
  }
  const ownerEmail = env.TEST_TURSO_OWNER_EMAIL?.trim().toLowerCase();
  const ownerPassword = env.TEST_TURSO_OWNER_PASSWORD;
  if (
    !ownerEmail?.endsWith('@example.test') ||
    !ownerPassword ||
    ownerPassword.length < 12 ||
    ownerPassword.length > 128
  )
    throw new Error('BLOCKED: a synthetic staging owner is required.');
  return { url, token, host, identity, ownerEmail, ownerPassword };
}

/** The marker must be created manually on the separate staging database. */
export async function verifyStagingIdentity(
  config: StagingConfig,
): Promise<void> {
  const client = createClient({ url: config.url, authToken: config.token });
  try {
    const [probe, marker] = await Promise.all([
      client.execute('SELECT 1 AS ready'),
      client.execute('SELECT database_id FROM h5_staging_identity'),
    ]);
    if (
      Number(probe.rows[0]?.ready) !== 1 ||
      marker.rows.length !== 1 ||
      marker.rows[0].database_id !== config.identity
    )
      throw new Error('BLOCKED: staging identity marker does not match.');
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('BLOCKED:'))
      throw error;
    throw new Error(
      'BLOCKED: staging identity could not be verified read-only.',
    );
  } finally {
    client.close();
  }
}
