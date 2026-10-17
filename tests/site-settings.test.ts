import assert from 'node:assert/strict';
import test from 'node:test';
import { formatPageTitle } from '../src/lib/data/pageTitle';
import {
  defaultSiteSettings,
  normalizePublicSiteSettings,
} from '../src/lib/server/siteSettings';

test('public page titles use the configured identity once', () => {
  assert.equal(
    formatPageTitle('Projects', 'Sample Owner'),
    'Projects — Sample Owner',
  );
  assert.equal(
    formatPageTitle('Example Project — Sample Owner', 'Sample Owner'),
    'Example Project — Sample Owner',
  );
  assert.equal(
    formatPageTitle(' Notes ', ' Sample Owner '),
    'Notes — Sample Owner',
  );
});

test('page title formatting safely handles missing values', () => {
  assert.equal(formatPageTitle('Projects', '  '), 'Projects');
  assert.equal(formatPageTitle('  ', 'Sample Owner'), 'Sample Owner');
});

test('missing or whitespace-only public settings use established defaults', () => {
  assert.deepEqual(normalizePublicSiteSettings(undefined), defaultSiteSettings);
  assert.deepEqual(
    normalizePublicSiteSettings({
      siteName: '  ',
      name: '\n',
      seoDescription: '',
      github: ' ',
      email: null,
    }),
    defaultSiteSettings,
  );
});

test('valid settings retain supported identity characters and trim whitespace', () => {
  const normalized = normalizePublicSiteSettings({
    ...defaultSiteSettings,
    siteName: '  A & B Studio  ',
    name: "  Zoë O'Neil  ",
  });

  assert.equal(normalized.siteName, 'A & B Studio');
  assert.equal(normalized.name, "Zoë O'Neil");
});
