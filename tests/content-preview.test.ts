import assert from 'node:assert/strict';
import test from 'node:test';
import { POST } from '../src/pages/api/console/content-preview';
import { normalizeContentPreview } from '../src/lib/data/contentPreview';

function context(
  body: URLSearchParams,
  origin: string | undefined = 'http://localhost:4321',
  user = true,
) {
  const request = new Request(
    'http://localhost:4321/api/console/content-preview',
    {
      method: 'POST',
      headers: { origin, 'content-type': 'application/x-www-form-urlencoded' },
      body,
    },
  );
  return {
    request,
    locals: { user: user ? { id: 'owner' } : undefined },
  } as never;
}

test('private full-page preview requires an owner session and trusted origin', async () => {
  const prior = process.env.AUTH_TRUSTED_ORIGIN;
  process.env.AUTH_TRUSTED_ORIGIN = 'http://localhost:4321';
  try {
    const values = new URLSearchParams({ kind: 'blog', body: '## draft' });
    const unauthenticated = await POST(context(values, undefined, false));
    assert.equal(unauthenticated.status, 401);
    const untrusted = await POST(context(values, 'https://untrusted.example'));
    assert.equal(untrusted.status, 403);
  } finally {
    if (prior === undefined) delete process.env.AUTH_TRUSTED_ORIGIN;
    else process.env.AUTH_TRUSTED_ORIGIN = prior;
  }
});

test('preview returns uncached sanitized Markdown without persistence', async () => {
  const prior = process.env.AUTH_TRUSTED_ORIGIN;
  process.env.AUTH_TRUSTED_ORIGIN = 'http://localhost:4321';
  try {
    const response = await POST(
      context(
        new URLSearchParams({
          kind: 'project',
          body: '## Unsaved draft\n\n<script>alert(1)</script>\n\n![screen](/media/123e4567-e89b-42d3-a456-426614174000.webp)',
        }),
      ),
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const result = (await response.json()) as {
      bodyHtml: string;
      preview: { kind: string; title: string };
    };
    assert.match(result.bodyHtml, /Unsaved draft/);
    assert.match(result.bodyHtml, /<img/);
    assert.doesNotMatch(result.bodyHtml, /<script|alert\(1\)/i);
    assert.equal(result.preview.kind, 'project');
    assert.equal(result.preview.title, 'Untitled');
  } finally {
    if (prior === undefined) delete process.env.AUTH_TRUSTED_ORIGIN;
    else process.env.AUTH_TRUSTED_ORIGIN = prior;
  }
});

test('preview endpoint returns normalized current unsaved form values', async () => {
  const prior = process.env.AUTH_TRUSTED_ORIGIN;
  process.env.AUTH_TRUSTED_ORIGIN = 'http://localhost:4321';
  try {
    const response = await POST(
      context(
        new URLSearchParams({
          kind: 'blog',
          title: 'Unsaved editorial title',
          description: 'Unsaved description',
          category: 'Engineering',
          createdAt: '2025-04-12',
          tags: 'Astro\nSSR',
          cover: 'https://images.example.test/cover.webp',
          summary: 'Current form summary',
          body: 'Current body words',
        }),
      ),
    );
    const result = (await response.json()) as {
      preview: {
        title: string;
        description: string;
        category: string;
        date: string;
        tags: string[];
        cover: string;
        summary: string;
      };
      bodyHtml: string;
    };
    assert.equal(response.status, 200);
    assert.equal(result.preview.title, 'Unsaved editorial title');
    assert.equal(result.preview.description, 'Unsaved description');
    assert.equal(result.preview.category, 'Engineering');
    assert.equal(result.preview.date, 'April 12, 2025');
    assert.deepEqual(result.preview.tags, ['Astro', 'SSR']);
    assert.equal(
      result.preview.cover,
      'https://images.example.test/cover.webp',
    );
    assert.equal(result.preview.summary, 'Current form summary');
    assert.match(result.bodyHtml, /Current body words/);
  } finally {
    if (prior === undefined) delete process.env.AUTH_TRUSTED_ORIGIN;
    else process.env.AUTH_TRUSTED_ORIGIN = prior;
  }
});

test('project preview normalizes unsaved metadata, actions, and screenshots like the public record', () => {
  const preview = normalizeContentPreview(
    'project',
    new URLSearchParams({
      title: 'A project',
      description: 'Current unsaved description',
      status: 'In Progress',
      category: 'Tools',
      projectDate: '2025-04-12',
      role: 'Developer',
      stack: 'Astro\nTypeScript\nastro',
      highlights: 'Fast\nAccessible',
      demo: 'https://example.com/demo',
      github: 'https://example.com/demo',
      links:
        'Documentation | https://example.com/docs\nInvalid | javascript:alert(1)',
      cover: 'https://images.example.test/cover.webp',
      screenshots: JSON.stringify([
        {
          src: '/media/123e4567-e89b-42d3-a456-426614174000.webp',
          alt: 'Dashboard',
          caption: 'Overview',
        },
        { src: 'javascript:alert(1)', alt: 'unsafe' },
      ]),
    }),
  );
  assert.equal(preview.title, 'A project');
  assert.equal(preview.date, 'April 12, 2025');
  assert.equal(preview.cover, 'https://images.example.test/cover.webp');
  assert.deepEqual(preview.stack, ['Astro', 'TypeScript']);
  assert.deepEqual(
    preview.links.map(({ label }) => label),
    ['Live demo', 'Documentation'],
  );
  assert.deepEqual(
    preview.links.map(({ href }) => href),
    ['https://example.com/demo', 'https://example.com/docs'],
  );
  assert.deepEqual(preview.screenshots, [
    {
      src: '/media/123e4567-e89b-42d3-a456-426614174000.webp',
      alt: 'Dashboard',
      caption: 'Overview',
    },
  ]);
});

test('Project preview keeps safe action priority without changing unsaved form data', () => {
  const form = new URLSearchParams({
    demo: 'https://example.com/demo',
    github: 'https://github.com/owner/project',
    links: [
      'Script | javascript:alert(1)',
      'Documentation | https://example.com/docs',
      'Duplicate | https://example.com/demo',
      'Manual | https://example.com/manual',
    ].join('\n'),
  });
  const before = form.toString();
  const preview = normalizeContentPreview('project', form);
  assert.deepEqual(
    preview.links.map(({ label, href, external }) => ({
      label,
      href,
      external,
    })),
    [
      {
        label: 'Live demo',
        href: 'https://example.com/demo',
        external: true,
      },
      {
        label: 'GitHub',
        href: 'https://github.com/owner/project',
        external: true,
      },
      {
        label: 'Documentation',
        href: 'https://example.com/docs',
        external: true,
      },
      {
        label: 'Manual',
        href: 'https://example.com/manual',
        external: true,
      },
    ],
  );
  assert.equal(form.toString(), before);
});

test('screenshot caption preview preserves over-limit text and warns consistently', () => {
  const source = '/media/123e4567-e89b-42d3-a456-426614174000.webp';
  const screenshot = (caption: string) =>
    JSON.stringify([{ src: source, alt: 'Application dashboard', caption }]);
  const validCaption = 'x'.repeat(200);
  const valid = normalizeContentPreview(
    'project',
    new URLSearchParams({ screenshots: screenshot(validCaption) }),
  );
  assert.equal(valid.screenshots[0]?.caption, validCaption);
  assert.deepEqual(valid.warnings, []);

  const overLimitCaption = 'x'.repeat(201);
  const form = new URLSearchParams({
    screenshots: screenshot(overLimitCaption),
  });
  const invalid = normalizeContentPreview('project', form);
  assert.equal(invalid.screenshots[0]?.caption, overLimitCaption);
  assert.match(invalid.warnings.join(' '), /200-character save limit/);
  assert.equal(
    JSON.parse(form.get('screenshots')!)[0].caption,
    overLimitCaption,
  );
});

test('blog, note, and lab previews normalize editorial metadata and omit unsafe links/images', () => {
  const blog = normalizeContentPreview(
    'blog',
    new URLSearchParams({
      title: 'Draft post',
      category: 'Engineering',
      createdAt: '2025-01-02',
      updatedAt: 'bad-date',
      tags: 'Astro\nSSR\nAstro',
      cover: '//images.example.test/unsafe.webp',
      body: 'one two three',
    }),
  );
  assert.equal(blog.cover, '');
  assert.deepEqual(blog.tags, ['Astro', 'SSR', 'Astro']);
  assert.equal(blog.date, 'January 2, 2025');
  assert.equal(blog.updatedAt, '');
  assert.equal(blog.readingTime, '1 min read');

  const note = normalizeContentPreview(
    'note',
    new URLSearchParams({
      title: 'Note',
      category: 'Systems',
      createdAt: '2025-01-02',
    }),
  );
  assert.equal(note.category, 'Systems');
  assert.equal(note.cover, '');

  const lab = normalizeContentPreview(
    'lab',
    new URLSearchParams({
      title: 'Experiment',
      status: 'Testing',
      risk: 'Medium',
      date: '2025-02-03',
      tools: 'Node\nPlaywright\nNode',
      lessons: 'Keep records',
      repo: 'https://example.com/repo',
      relatedProject: '/projects/example-project',
    }),
  );
  assert.deepEqual(lab.tools, ['Node', 'Playwright']);
  assert.equal(lab.date, 'February 3, 2025');
  assert.deepEqual(
    lab.links.map((link) => link.label),
    ['Repository', 'Related project'],
  );
  assert.equal(lab.links[1]?.external, false);
});

test('malformed screenshot values and unsafe cover references are omitted without failing preview', () => {
  const malformed = normalizeContentPreview(
    'project',
    new URLSearchParams({
      screenshots: '{broken',
      cover: 'javascript:alert(1)',
    }),
  );
  assert.equal(malformed.cover, '');
  assert.deepEqual(malformed.screenshots, []);
  assert.match(malformed.warnings.join(' '), /Screenshot data is malformed/);

  const unsafeItems = normalizeContentPreview(
    'project',
    new URLSearchParams({
      screenshots: JSON.stringify([
        { src: '/user/private.webp', alt: 'Private route' },
        {
          src: '/media/123e4567-e89b-42d3-a456-426614174000.webp',
          alt: 'Allowed',
        },
      ]),
    }),
  );
  assert.equal(unsafeItems.screenshots.length, 1);
  assert.match(unsafeItems.warnings.join(' '), /invalid screenshot entry/);
});

test('bounded preview metadata warns without rewriting form values', () => {
  const longStackEntry = 'x'.repeat(41);
  const tooManyLinks = Array.from(
    { length: 9 },
    (_, index) => `Doc ${index} | https://example.test/${index}`,
  ).join('\n');
  const form = new URLSearchParams({
    stack: `${longStackEntry}\n${Array.from({ length: 20 }, (_, i) => `item-${i}`).join('\n')}`,
    highlights: 'h'.repeat(161),
    links: tooManyLinks,
  });
  const preview = normalizeContentPreview('project', form);
  assert.ok(preview.stack.length <= 20);
  assert.ok(preview.highlights.length <= 12);
  assert.match(preview.warnings.join(' '), /stack/);
  assert.match(preview.warnings.join(' '), /highlights/);
  assert.match(preview.warnings.join(' '), /links/);
  assert.equal(form.get('stack')?.includes(longStackEntry), true);
  assert.equal(form.get('highlights'), 'h'.repeat(161));
});

test('preview date labels use strict UTC calendar dates without inventing replacements', () => {
  const leapDay = normalizeContentPreview(
    'note',
    new URLSearchParams({ createdAt: '2024-02-29' }),
  );
  assert.equal(leapDay.date, 'February 29, 2024');

  const invalidLeapDay = normalizeContentPreview(
    'note',
    new URLSearchParams({ createdAt: '2025-02-29' }),
  );
  assert.equal(invalidLeapDay.date, '');
  assert.match(
    invalidLeapDay.warnings.join(' '),
    /createdAt is not a valid calendar date/,
  );

  const missingProjectDate = normalizeContentPreview(
    'project',
    new URLSearchParams(),
  );
  assert.equal(missingProjectDate.date, '');
  assert.deepEqual(missingProjectDate.warnings, []);
});

test('preview does not present unsupported project or experiment enum values as published metadata', () => {
  const project = normalizeContentPreview(
    'project',
    new URLSearchParams({ status: 'Unknown status' }),
  );
  const lab = normalizeContentPreview(
    'lab',
    new URLSearchParams({ status: 'Successful', risk: 'Extreme' }),
  );
  assert.equal(project.status, '');
  assert.equal(lab.status, '');
  assert.equal(lab.risk, '');
});

test('preview rejects unsupported content kinds and oversized markdown', async () => {
  const prior = process.env.AUTH_TRUSTED_ORIGIN;
  process.env.AUTH_TRUSTED_ORIGIN = 'http://localhost:4321';
  try {
    assert.equal(
      (await POST(context(new URLSearchParams({ kind: 'toString', body: '' }))))
        .status,
      400,
    );
    assert.equal(
      (
        await POST(
          context(
            new URLSearchParams({ kind: 'blog', body: 'x'.repeat(200001) }),
          ),
        )
      ).status,
      400,
    );
  } finally {
    if (prior === undefined) delete process.env.AUTH_TRUSTED_ORIGIN;
    else process.env.AUTH_TRUSTED_ORIGIN = prior;
  }
});
