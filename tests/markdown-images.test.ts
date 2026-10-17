import assert from 'node:assert/strict';
import test from 'node:test';
import { renderProjectMarkdown } from '../src/lib/server/markdown';

const asset = '/media/123e4567-e89b-42d3-a456-426614174000.webp';

test('sanitized Markdown retains uploaded images and useful alt text', () => {
  const html = renderProjectMarkdown(
    `![Dashboard screenshot](${asset} "Preview")`,
  );
  assert.match(html, /<img/);
  assert.match(html, /src="\/media\//);
  assert.match(html, /alt="Dashboard screenshot"/);
  assert.match(html, /loading="lazy"/);
});

test('Markdown images reject unsafe schemes, protocol-relative, and private paths', () => {
  for (const source of [
    'javascript:alert(1)',
    'data:image/png;base64,abc',
    'file:///etc/passwd',
    '//example.com/x.png',
    '/api/console/media/upload',
  ]) {
    assert.doesNotMatch(
      renderProjectMarkdown(`![x](${source})`),
      /<img\b/i,
      source,
    );
  }
});

test('image attributes are restricted and ordinary links stay sanitized', () => {
  const html = renderProjectMarkdown(
    `<img src="${asset}" alt="ok" onerror="alert(1)" style="display:none">\n\n<a href="javascript:alert(1)" onclick="alert(1)">bad</a>`,
  );
  assert.doesNotMatch(html, /onerror|onclick|javascript:/i);
});
