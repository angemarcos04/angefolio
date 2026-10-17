import assert from 'node:assert/strict';
import test from 'node:test';
import { validateBlogForm } from '../src/lib/server/validation/blog';
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
function project(screenshots = '[]') {
  return new URLSearchParams({
    slug: 'media-test',
    title: 'Media test',
    description: 'Description',
    status: 'Prototype',
    screenshots,
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
