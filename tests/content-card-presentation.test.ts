import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getProjectActions,
  getVisibleItems,
} from '../src/lib/data/cardPresentation';

test('preview item limits preserve source order and report all hidden items', () => {
  const source = ['Astro', 'TypeScript', 'SQLite', 'Svelte', 'Tailwind'];
  const preview = getVisibleItems(source, 3);

  assert.deepEqual(preview.visible, ['Astro', 'TypeScript', 'SQLite']);
  assert.deepEqual(preview.hidden, ['Svelte', 'Tailwind']);
  assert.deepEqual(getVisibleItems(source, 0), {
    visible: [],
    hidden: source,
  });
  assert.deepEqual(getVisibleItems(source), {
    visible: source,
    hidden: [],
  });
});

test('project actions use real destinations and suppress duplicates', () => {
  const actions = getProjectActions({
    href: '/projects/example',
    caseStudy: '/projects/example',
    demo: 'https://demo.example.test',
    github: 'https://github.com/owner/example',
    links: [
      {
        label: 'Live preview',
        href: 'https://demo.example.test',
        external: true,
      },
      {
        label: 'Documentation',
        href: 'https://docs.example.test',
        external: true,
      },
    ],
  });

  assert.deepEqual(
    actions.map(({ label, href }) => [label, href]),
    [
      ['Explore project', '/projects/example'],
      ['Live demo', 'https://demo.example.test'],
      ['GitHub', 'https://github.com/owner/example'],
      ['Documentation', 'https://docs.example.test'],
    ],
  );
  assert.equal(actions[0]?.variant, 'primary');
  assert.equal(actions[1]?.variant, 'secondary');
});

test('overview-only projects never receive a fabricated local detail action', () => {
  assert.deepEqual(getProjectActions({}), []);
  const links = getProjectActions({
    demo: 'https://demo.example.test',
    github: 'https://github.com/owner/example',
  });

  assert.deepEqual(
    links.map(({ label, variant }) => [label, variant]),
    [
      ['Live demo', 'primary'],
      ['GitHub', 'secondary'],
    ],
  );
});

test('an external case-study destination remains usable when no local detail exists', () => {
  assert.deepEqual(
    getProjectActions({ caseStudy: 'https://journal.example.test/work' }),
    [
      {
        href: 'https://journal.example.test/work',
        label: 'Case study',
        external: true,
        variant: 'primary',
      },
    ],
  );
});

test('Project card actions use the shared URL boundary for legacy links', () => {
  const actions = getProjectActions({
    href: '/projects/example',
    demo: 'https://example.com/demo',
    links: [
      {
        label: 'Unsafe internal',
        href: '/\\evil.example/path',
        external: false,
      },
      { label: 'Unsafe script', href: 'javascript:alert(1)', external: true },
      {
        label: 'Legacy docs',
        href: 'https://docs.example.com',
        external: false,
      },
      {
        label: 'Duplicate demo',
        href: 'https://example.com/demo',
        external: true,
      },
      { label: 'Internal docs', href: '/docs', external: false },
    ],
  });
  assert.deepEqual(
    actions.map(({ label, href, external }) => ({ label, href, external })),
    [
      { label: 'Explore project', href: '/projects/example', external: false },
      { label: 'Live demo', href: 'https://example.com/demo', external: true },
      {
        label: 'Legacy docs',
        href: 'https://docs.example.com',
        external: true,
      },
      { label: 'Internal docs', href: '/docs', external: false },
    ],
  );
});

test('malformed historical Project link items cannot break card rendering', () => {
  assert.deepEqual(
    getProjectActions({
      links: [
        null as never,
        { label: 'Malformed', href: null as never, external: false },
        { label: 'Documentation', href: '/docs', external: false },
      ],
    }),
    [
      {
        label: 'Documentation',
        href: '/docs',
        external: false,
        variant: 'primary',
      },
    ],
  );
});

test('a rejected duplicate cannot claim the variant of the first safe card link', () => {
  assert.deepEqual(
    getProjectActions({
      links: [
        { label: 'Rejected', href: '/docs', external: true },
        { label: 'Internal docs', href: '/docs', external: false },
      ],
    }),
    [
      {
        label: 'Internal docs',
        href: '/docs',
        external: false,
        variant: 'ghost',
      },
    ],
  );
});
