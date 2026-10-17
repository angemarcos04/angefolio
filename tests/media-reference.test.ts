import assert from 'node:assert/strict';
import test from 'node:test';
import { isSafeImageReference } from '../src/lib/data/mediaReference';

test('accepts uploaded, static image, and HTTPS image references', () => {
  assert.equal(
    isSafeImageReference('/media/123e4567-e89b-42d3-a456-426614174000.webp'),
    true,
  );
  assert.equal(isSafeImageReference('/og.png'), true);
  assert.equal(isSafeImageReference('https://example.com/photo.webp'), true);
});

test('rejects unsafe and private image references', () => {
  for (const value of [
    '//example.com/x.png',
    'javascript:alert(1)',
    'data:image/png,foo',
    'file:///tmp/x.png',
    '/api/private.png',
    '/images/%2e%2e/private.png',
    '/images/file.txt',
    'http://example.com/x.png',
  ]) {
    assert.equal(isSafeImageReference(value), false, value);
  }
});
