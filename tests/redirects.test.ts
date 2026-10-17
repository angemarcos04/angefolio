import assert from 'node:assert/strict';
import test from 'node:test';
import {
  contentPath,
  isSlugUniqueConstraintError,
  publicRedirectTarget,
  type ContentRedirectRecord,
} from '../src/lib/server/redirects';

test('content redirect destinations are tied to their public owner and path', () => {
  const redirect: ContentRedirectRecord = {
    fromPath: '/blog/old-title',
    toPath: '/blog/current-title',
    entityType: 'blog',
    entityId: 'blog-1',
  };

  assert.equal(
    publicRedirectTarget(
      redirect,
      'blog',
      'blog-1',
      'current-title',
      '/blog/old-title',
    ),
    '/blog/current-title',
  );
  assert.equal(
    publicRedirectTarget(
      redirect,
      'blog',
      undefined,
      'current-title',
      '/blog/old-title',
    ),
    null,
  );
  assert.equal(
    publicRedirectTarget(
      redirect,
      'blog',
      'another-record',
      'current-title',
      '/blog/old-title',
    ),
    null,
  );
  assert.equal(
    publicRedirectTarget(
      { ...redirect, entityType: 'note' },
      'blog',
      'blog-1',
      'current-title',
      '/blog/old-title',
    ),
    null,
  );
  assert.equal(
    publicRedirectTarget(
      { ...redirect, toPath: 'https://evil.example' },
      'blog',
      'blog-1',
      'current-title',
      '/blog/old-title',
    ),
    null,
  );
  assert.equal(
    publicRedirectTarget(
      { ...redirect, toPath: '/user/login' },
      'blog',
      'blog-1',
      'current-title',
      '/blog/old-title',
    ),
    null,
  );
  assert.equal(
    publicRedirectTarget(
      { ...redirect, toPath: '/blog/old-title' },
      'blog',
      'blog-1',
      'old-title',
      '/blog/old-title',
    ),
    null,
  );
  assert.throws(() => contentPath('blog', 'bad//slug'));
});

test('redirect paths cannot cross content collection boundaries', () => {
  const redirect: ContentRedirectRecord = {
    fromPath: '/projects/old-project',
    toPath: '/projects/new-project',
    entityType: 'project',
    entityId: 'project-1',
  };

  assert.equal(
    publicRedirectTarget(
      { ...redirect, toPath: '/notes/new-project' },
      'project',
      'project-1',
      'new-project',
      '/projects/old-project',
    ),
    null,
  );
  assert.equal(
    publicRedirectTarget(
      redirect,
      'project',
      'project-1',
      'new-project',
      '/projects/unrelated-alias',
    ),
    null,
  );
});

test('catalog entries without a database owner cannot claim stored aliases', () => {
  for (const type of ['project', 'note', 'lab'] as const) {
    const section =
      type === 'project' ? 'projects' : type === 'note' ? 'notes' : 'lab';
    const redirect: ContentRedirectRecord = {
      fromPath: `/${section}/old-entry`,
      toPath: `/${section}/new-entry`,
      entityType: type,
      entityId: 'database-record-id',
    };

    assert.equal(
      publicRedirectTarget(
        redirect,
        type,
        undefined,
        'new-entry',
        redirect.fromPath,
      ),
      null,
    );
  }
});

test('database slug race classification matches only the relevant unique constraint', () => {
  assert.equal(
    isSlugUniqueConstraintError(
      new Error(
        'SQLITE_CONSTRAINT_UNIQUE: UNIQUE constraint failed: note_records.slug',
      ),
      'note',
    ),
    true,
  );
  assert.equal(
    isSlugUniqueConstraintError(
      new Error('UNIQUE constraint failed: blog_records.slug'),
      'blog',
    ),
    true,
  );
  assert.equal(
    isSlugUniqueConstraintError(
      new Error('UNIQUE constraint failed: user.email'),
      'blog',
    ),
    false,
  );
  assert.equal(
    isSlugUniqueConstraintError(new Error('database is locked'), 'project'),
    false,
  );
});
