import assert from 'node:assert/strict';
import test from 'node:test';
import { readStagingConfig } from '../scripts/turso-test-gate';

const configured = {
  TURSO_INTEGRATION_TEST: '1',
  TEST_TURSO_DATABASE_URL: 'libsql://h5-staging.example.turso.io',
  TEST_TURSO_AUTH_TOKEN: 'synthetic-token-never-used',
  TEST_TURSO_EXPECTED_HOST: 'h5-staging.example.turso.io',
  TEST_TURSO_DATABASE_ID: 'isolated-fixture-id',
  TEST_TURSO_CONFIRM_DATABASE_ID: 'isolated-fixture-id',
  TEST_TURSO_OWNER_EMAIL: 'h5-owner@example.test',
  TEST_TURSO_OWNER_PASSWORD: 'synthetic-owner-password',
};

test('remote gate requires opt-in, separate credentials, and two matching identities', () => {
  assert.equal(
    readStagingConfig(configured).host,
    configured.TEST_TURSO_EXPECTED_HOST,
  );
  for (const key of [
    'TURSO_INTEGRATION_TEST',
    'TEST_TURSO_DATABASE_URL',
    'TEST_TURSO_AUTH_TOKEN',
    'TEST_TURSO_EXPECTED_HOST',
    'TEST_TURSO_DATABASE_ID',
    'TEST_TURSO_CONFIRM_DATABASE_ID',
  ] as const) {
    assert.throws(() => readStagingConfig({ ...configured, [key]: '' }));
  }
});

test('remote gate rejects production matches and URL identity ambiguity', () => {
  const invalid = [
    { DATABASE_URL: configured.TEST_TURSO_DATABASE_URL },
    { PRODUCTION_DATABASE_URL: configured.TEST_TURSO_DATABASE_URL },
    { PRODUCTION_DATABASE_URL: 'not a valid URL' },
    { TEST_TURSO_EXPECTED_HOST: 'another.turso.io' },
    { TEST_TURSO_DATABASE_URL: 'file:./data/angefolio.db' },
    { TEST_TURSO_DATABASE_URL: 'libsql://h5-staging.example.turso.io/path' },
    { TEST_TURSO_DATABASE_URL: 'libsql://h5-staging.example.turso.io?x=1' },
    { TEST_TURSO_OWNER_EMAIL: 'real-owner@gmail.com' },
  ];
  for (const extra of invalid)
    assert.throws(() => readStagingConfig({ ...configured, ...extra }));
});
