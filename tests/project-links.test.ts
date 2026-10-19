import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isSafeProjectExternalHref,
  isSafeProjectInternalHref,
  normalizeProjectDisplayLinks,
} from '../src/lib/data/projectLinks';

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

test('an internal Project action cannot resolve outside the page origin', () => {
  const origin = 'https://portfolio.example.test';
  const malicious = [
    '/\\evil.example/path',
    '/\\\\evil.example/path',
    '//evil.example/path',
    '///evil.example/path',
    '\\\\evil.example/path',
  ];
  const candidates = malicious.map((href, index) => ({
    label: `Candidate ${index}`,
    href,
    external: false,
  }));
  const accepted = normalizeProjectDisplayLinks(candidates);
  assert.deepEqual(
    accepted,
    [],
    JSON.stringify({
      candidates: malicious.map((href) => ({
        href,
        browserHref: new URL(href, origin).href,
        browserOrigin: new URL(href, origin).origin,
      })),
      accepted,
    }),
  );
});

test('accepted internal paths and fragments remain same-origin', () => {
  const origin = 'https://portfolio.example.test';
  const hrefs = [
    '/projects',
    '/projects/example',
    '/notes/example',
    '/blog/example?view=full#details',
    '/safe%20name',
    '/search?next=%2fdocs',
    '#overview',
    '#screenshots',
  ];
  for (const href of hrefs) {
    assert.equal(isSafeProjectInternalHref(href), true, href);
    const [link] = normalizeProjectDisplayLinks([
      { label: href, href, external: false },
    ]);
    assert.equal(link?.href, href);
    assert.equal(link?.external, false);
    assert.equal(new URL(link.href, origin).origin, origin);
  }
});

test('ambiguous internal syntax and malformed escapes are rejected', () => {
  const hrefs = [
    '/\\evil.example/path',
    '/\\\\evil.example/path',
    '\\evil.example/path',
    '\\\\evil.example/path',
    '//evil.example/path',
    '///evil.example/path',
    '/%5cevil.example/path',
    '/%5C%5Cevil.example/path',
    '/%2F%2Fevil.example/path',
    '/%252f%252fevil.example/path',
    '/%2e%2e//evil.example/path',
    '/%GG',
    '/%ff',
    '/%0aevil.example',
    '/\tevil.example',
    '/\nevil.example',
    '/\u0000evil.example',
    '/projects\\example',
    '#details\\unsafe',
    '#details\u007funsafe',
  ];
  for (const href of hrefs) {
    assert.equal(isSafeProjectInternalHref(href), false, JSON.stringify(href));
    assert.deepEqual(
      normalizeProjectDisplayLinks([
        { label: 'Unsafe', href, external: false },
      ]),
      [],
      JSON.stringify(href),
    );
  }
});

test('HTTP(S) links receive truthful external metadata and reject ambiguous syntax', () => {
  const accepted = [
    'https://github.com/example/project',
    'https://docs.example.com/project',
    'http://example.com/path',
    'HTTP://example.com/path',
  ];
  for (const href of accepted) {
    assert.equal(isSafeProjectExternalHref(href), true, href);
    const [link] = normalizeProjectDisplayLinks([
      { label: 'Documentation', href, external: false },
    ]);
    assert.equal(link?.href, href);
    assert.equal(link?.external, true);
    assert.match(new URL(link.href).protocol, /^https?:$/);
  }
  assert.equal(isSafeProjectExternalHref('  https://example.com/docs  '), true);
  assert.deepEqual(
    normalizeProjectDisplayLinks([
      {
        label: 'Trimmed URL',
        href: '  https://example.com/docs  ',
        external: true,
      },
    ]),
    [
      {
        label: 'Trimmed URL',
        href: 'https://example.com/docs',
        external: true,
      },
    ],
  );

  const rejected = [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,unsafe',
    'file:///etc/passwd',
    'blob:https://example.com/id',
    'vbscript:msgbox(1)',
    'https:example.com',
    'https://user:pass@example.com/path',
    'https://user@example.com/path',
    'https://example.com\\@evil.example/path',
    'https://example.com/%GG',
    'https://example.com/%ff',
    'https://example.com/%0a',
    'https://example.com/\nnext',
    'https://',
  ];
  for (const href of rejected) {
    assert.equal(isSafeProjectExternalHref(href), false, JSON.stringify(href));
    assert.deepEqual(
      normalizeProjectDisplayLinks([{ label: 'Unsafe', href, external: true }]),
      [],
      JSON.stringify(href),
    );
  }
});

test('unsafe candidates never consume a destination and frozen sources stay unchanged', () => {
  const source = Object.freeze([
    Object.freeze({
      label: 'Unsafe',
      href: '/\\evil.example/path',
      external: false,
    }),
    Object.freeze({
      label: 'Live demo',
      href: 'https://example.com/demo',
      external: true,
    }),
    Object.freeze({
      label: 'GitHub duplicate',
      href: 'https://example.com/demo',
      external: true,
    }),
    Object.freeze({ label: 'Docs', href: '/docs', external: false }),
  ]);
  const before = structuredClone([...source]);
  assert.deepEqual(normalizeProjectDisplayLinks(source), [
    { label: 'Live demo', href: 'https://example.com/demo', external: true },
    { label: 'Docs', href: '/docs', external: false },
  ]);
  assert.deepEqual(source, before);
});
