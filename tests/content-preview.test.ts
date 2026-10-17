import assert from 'node:assert/strict';
import test from 'node:test';
import { POST } from '../src/pages/api/console/content-preview';

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
    const result = (await response.json()) as { bodyHtml: string };
    assert.match(result.bodyHtml, /Unsaved draft/);
    assert.match(result.bodyHtml, /<img/);
    assert.doesNotMatch(result.bodyHtml, /<script|alert\(1\)/i);
  } finally {
    if (prior === undefined) delete process.env.AUTH_TRUSTED_ORIGIN;
    else process.env.AUTH_TRUSTED_ORIGIN = prior;
  }
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
