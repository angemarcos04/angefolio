import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasMdxSlug,
  isMdxSlugClaimConflict,
  mdxSlugFromId,
} from '../src/lib/data/mdxSlug';

test('MDX slug ownership includes hidden source entries and strips supported extensions', () => {
  const fixtureEntries = [
    { id: 'legacy-project.mdx', published: false },
    { id: 'nested/old-note.md', published: false },
    { id: 'visible-lab.mdx', published: true },
  ];
  const sourceSlugs = fixtureEntries.map((entry) => mdxSlugFromId(entry.id));

  assert.equal(hasMdxSlug(sourceSlugs, 'legacy-project'), true);
  assert.equal(hasMdxSlug(sourceSlugs, 'nested/old-note'), true);
  assert.equal(hasMdxSlug(sourceSlugs, 'visible-lab'), true);
  assert.equal(hasMdxSlug(sourceSlugs, 'unused-content'), false);
  assert.equal(mdxSlugFromId('UPPER.MDX'), 'UPPER');
});

test('MDX source slugs require explicit replacement intent', () => {
  const sourceSlugs = ['legacy-project'];

  assert.equal(
    isMdxSlugClaimConflict(sourceSlugs, 'legacy-project', {
      replacesMdx: false,
    }),
    true,
  );
  assert.equal(
    isMdxSlugClaimConflict(sourceSlugs, 'legacy-project', {
      replacesMdx: true,
    }),
    false,
  );
  assert.equal(
    isMdxSlugClaimConflict(sourceSlugs, 'legacy-project', {
      replacesMdx: false,
      currentSlug: 'legacy-project',
    }),
    false,
  );
  assert.equal(
    isMdxSlugClaimConflict(sourceSlugs, 'unused', { replacesMdx: false }),
    false,
  );
});
