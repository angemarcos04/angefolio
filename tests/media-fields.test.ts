import assert from 'node:assert/strict';
import test from 'node:test';
import { isSafeImageReference } from '../src/lib/data/mediaReference';
import { validateBlogForm } from '../src/lib/server/validation/blog';
import { validateLabForm } from '../src/lib/server/validation/lab';
import { validateProjectForm } from '../src/lib/server/validation/projects';

const date = '2026-10-17';
function blog(cover = '') {
  return new URLSearchParams({
    slug: 'media-test',
    title: 'Media test',
    description: 'Description',
    category: 'Tech',
    createdAt: date,
    body: '# Body',
    cover,
  });
}
function project(screenshots = '[]', cover = '') {
  return new URLSearchParams({
    slug: 'media-test',
    title: 'Media test',
    description: 'Description',
    status: 'Prototype',
    screenshots,
    cover,
  });
}

test('Blog cover is optional and accepts safe media references', () => {
  assert.equal(validateBlogForm(blog()).success, true);
  assert.equal(
    validateBlogForm(blog('/media/123e4567-e89b-42d3-a456-426614174000.webp'))
      .success,
    true,
  );
  assert.equal(validateBlogForm(blog('javascript:alert(1)')).success, false);
});

test('Project cover uses the shared safe image-reference policy', () => {
  const references = [
    '',
    '/media/123e4567-e89b-42d3-a456-426614174000.webp',
    '/images/project-cover.webp',
    'https://images.example.com/project.webp',
    'http://images.example.com/project.webp',
    'javascript:alert(1)',
    'data:image/svg+xml;base64,PHN2Zz4=',
    'file:///etc/passwd',
    'ftp://example.com/project.webp',
    '//example.com/project.webp',
    '/user/login',
    '/user/private.webp',
    '/api/console/example.webp',
    '/auth/example.webp',
    '/admin/example.webp',
    '/images/../user/private.webp',
    '/images/%2e%2e/private.webp',
    '/images/%2fuser.webp',
    '/images\\private.webp',
    '/media/not-a-uuid.webp',
    `https://images.example.com/${'a'.repeat(2049)}.webp`,
  ];

  for (const reference of references) {
    const expected = reference === '' || isSafeImageReference(reference);
    const result = validateProjectForm(project('[]', reference));
    assert.equal(
      result.success,
      expected,
      `Unexpected Project cover validation for ${reference}`,
    );
    if (!expected && !result.success) {
      assert.match(result.errors.cover ?? '', /uploaded image|HTTPS image/i);
    }
  }
});

test('Project, Blog, and shared policy agree for cover references', () => {
  const references = [
    '/media/123e4567-e89b-42d3-a456-426614174000.webp',
    '/images/project-cover.webp',
    'https://images.example.com/project.webp',
    'http://images.example.com/project.webp',
    '/user/private.webp',
    'javascript:alert(1)',
  ];

  for (const reference of references) {
    const expected = isSafeImageReference(reference);
    assert.equal(
      validateProjectForm(project('[]', reference)).success,
      expected,
    );
    assert.equal(validateBlogForm(blog(reference)).success, expected);
  }
});

test('Project screenshot captions use the shared 200-character save limit', () => {
  const screenshot = (caption?: string) =>
    JSON.stringify([
      {
        src: '/media/123e4567-e89b-42d3-a456-426614174000.webp',
        alt: 'Application dashboard',
        ...(caption === undefined ? {} : { caption }),
      },
    ]);

  assert.equal(validateProjectForm(project(screenshot())).success, true);
  assert.equal(
    validateProjectForm(project(screenshot('x'.repeat(200)))).success,
    true,
  );
  const overLimit = validateProjectForm(project(screenshot('x'.repeat(201))));
  assert.equal(overLimit.success, false);
  if (!overLimit.success)
    assert.match(overLimit.errors.screenshots ?? '', /screenshots/i);
});

test('Project and Lab save validators reject credentialed public URLs', () => {
  const projectForm = project();
  projectForm.set('github', 'https://owner:secret@example.com/repo');
  const projectResult = validateProjectForm(projectForm);
  assert.equal(projectResult.success, false);
  if (!projectResult.success) assert.ok(projectResult.errors.github);

  const labResult = validateLabForm(
    new URLSearchParams({
      slug: 'url-test',
      title: 'URL test',
      description: 'URL validation test.',
      status: 'Prototype',
      date,
      repo: 'https://owner:secret@example.com/repo',
      body: '# Test',
    }),
  );
  assert.equal(labResult.success, false);
  if (!labResult.success) assert.ok(labResult.errors.repo);
});

test('project screenshot references validate count, uniqueness, and alt text', () => {
  const entry = {
    src: '/media/123e4567-e89b-42d3-a456-426614174000.webp',
    alt: 'Dashboard screen',
    caption: 'Overview',
  };
  assert.equal(
    validateProjectForm(project(JSON.stringify([entry]))).success,
    true,
  );
  assert.equal(
    validateProjectForm(project(JSON.stringify([{ ...entry, alt: '' }])))
      .success,
    false,
  );
  assert.equal(
    validateProjectForm(project(JSON.stringify([entry, entry]))).success,
    false,
  );
  assert.equal(
    validateProjectForm(project(JSON.stringify(Array(9).fill(entry)))).success,
    false,
  );
});
