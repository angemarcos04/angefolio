import assert from 'node:assert/strict';
import test from 'node:test';
import { initialCredentials } from '../src/lib/data/credentials';
import {
  credentialDateLabel,
  credentialIsExpired,
  getCredentialSpotlight,
  getVisibleCredentials,
} from '../src/lib/data/credentialPresentation';

test('spotlight selects the first visible featured credential with stable ties', () => {
  const [base] = initialCredentials;
  const selected = getCredentialSpotlight([
    { ...base, id: 'hidden-first', order: 0, featured: true, visible: false },
    { ...base, id: 'b', order: 1, featured: true, visible: true },
    { ...base, id: 'a', order: 1, featured: true, visible: true },
    { ...base, id: 'not-featured', order: 0, featured: false, visible: true },
  ]);
  assert.equal(selected?.id, 'a');
});

test('public credential collection includes visible non-featured records only', () => {
  const [base] = initialCredentials;
  const records = [
    { ...base, id: 'hidden', visible: false, order: 0 },
    {
      ...base,
      id: 'public-nonfeatured',
      visible: true,
      featured: false,
      order: 1,
    },
    { ...base, id: 'public-featured', visible: true, featured: true, order: 1 },
  ];
  assert.deepEqual(
    getVisibleCredentials(records).map((credential) => credential.id),
    ['public-featured', 'public-nonfeatured'],
  );
});

test('credential date labels and expiry handle month precision and invalid dates', () => {
  assert.equal(credentialDateLabel('2026-08'), 'Aug 2026');
  assert.equal(credentialDateLabel('2026-08-17'), 'Aug 17, 2026');
  assert.equal(credentialDateLabel('2026-13'), undefined);
  assert.equal(
    credentialIsExpired('2026-08', new Date('2026-09-01T00:00:00.000Z')),
    true,
  );
  assert.equal(
    credentialIsExpired('2026-08-31', new Date('2026-08-31T12:00:00.000Z')),
    false,
  );
});
