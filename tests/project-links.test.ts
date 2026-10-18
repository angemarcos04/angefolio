import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeProjectDisplayLinks } from '../src/lib/data/projectLinks';

test('empty and unique Project action candidates preserve their order', () => {
  assert.deepEqual(normalizeProjectDisplayLinks([]), []);

  const candidates = [
    { label: 'Live demo', href: 'https://example.test/app', external: true },
    {
      label: 'GitHub',
      href: 'https://github.com/owner/project',
      external: true,
    },
    { label: 'Documentation', href: '/docs/project', external: false },
    { label: 'Section', href: '#details', external: false },
  ] as const;

  assert.deepEqual(normalizeProjectDisplayLinks(candidates), [
    { label: 'Live demo', href: 'https://example.test/app', external: true },
    {
      label: 'GitHub',
      href: 'https://github.com/owner/project',
      external: true,
    },
    { label: 'Documentation', href: '/docs/project', external: false },
    { label: 'Section', href: '#details', external: false },
  ]);
});

test('first safe occurrence wins and retains its label and position', () => {
  const candidates = [
    { label: 'Live demo', href: 'https://example.test/app', external: true },
    { label: 'GitHub', href: 'https://example.test/app', external: true },
    {
      label: 'Documentation',
      href: 'https://docs.example.test',
      external: true,
    },
    { label: 'Manual', href: 'https://docs.example.test', external: true },
    {
      label: 'Source Code',
      href: 'https://github.com/owner/project',
      external: true,
    },
  ] as const;

  assert.deepEqual(normalizeProjectDisplayLinks(candidates), [
    { label: 'Live demo', href: 'https://example.test/app', external: true },
    {
      label: 'Documentation',
      href: 'https://docs.example.test',
      external: true,
    },
    {
      label: 'Source Code',
      href: 'https://github.com/owner/project',
      external: true,
    },
  ]);
});

test('unsafe destinations are excluded and similar distinct destinations remain', () => {
  const candidates = [
    { label: 'Script', href: 'javascript:alert(1)', external: true },
    { label: 'Data', href: 'data:text/html,unsafe', external: true },
    {
      label: 'Protocol relative',
      href: '//example.test/path',
      external: false,
    },
    { label: 'Valid HTTP', href: 'http://example.test/path', external: true },
    {
      label: 'Without slash',
      href: 'https://example.test/path',
      external: true,
    },
    {
      label: 'With slash',
      href: 'https://example.test/path/',
      external: true,
    },
  ] as const;

  assert.deepEqual(normalizeProjectDisplayLinks(candidates), [
    { label: 'Valid HTTP', href: 'http://example.test/path', external: true },
    {
      label: 'Without slash',
      href: 'https://example.test/path',
      external: true,
    },
    {
      label: 'With slash',
      href: 'https://example.test/path/',
      external: true,
    },
  ]);
});

test('normalization does not mutate candidates or their values', () => {
  const candidate = {
    label: ' Docs ',
    href: ' https://example.test/docs ',
    external: true,
  };
  const source = [candidate];
  const before = structuredClone(source);

  assert.deepEqual(normalizeProjectDisplayLinks(source), [
    { label: ' Docs ', href: 'https://example.test/docs', external: true },
  ]);
  assert.deepEqual(source, before);
  assert.equal(source[0], candidate);
});
