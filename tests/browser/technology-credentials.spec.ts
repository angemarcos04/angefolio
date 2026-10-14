import { expect, test } from '@playwright/test';

test('technology chips keep their labels and load mapped local icons', async ({
  page,
}) => {
  await page.goto('/');

  const names = [
    'Astro',
    'Svelte',
    'TypeScript',
    'Tailwind CSS',
    'Laravel',
    'FastAPI',
    'PostgreSQL',
    'Gentoo Linux',
    'Bash/Zsh',
    'Neovim',
    'Git',
    'Podman/Docker',
    'Rust',
    'AI tools',
    'Data workflows',
  ];
  const chips = page.locator('.stack-group .stack-tag');
  await expect(chips).toHaveCount(names.length);
  for (const name of names)
    await expect(chips.filter({ hasText: name })).toHaveCount(1);

  const iconResults = await page
    .locator('.stack-group .stack-tag img')
    .evaluateAll((images) =>
      images.map((image) => ({
        path: (image as HTMLImageElement).getAttribute('src'),
        loaded: (image as HTMLImageElement).naturalWidth > 0,
      })),
    );
  expect(iconResults).toHaveLength(15);
  expect(iconResults.every((result) => result.loaded)).toBe(true);
  expect(
    iconResults.every((result) =>
      result.path?.startsWith('/technology-icons/'),
    ),
  ).toBe(true);
  const brandFills = await page.evaluate(async () => {
    const paths = Array.from(
      document.querySelectorAll<HTMLImageElement>(
        '.stack-group .stack-tag img',
      ),
      (image) => image.getAttribute('src')!,
    );
    return Promise.all(
      paths.map(async (path) => {
        const svg = await (await fetch(path)).text();
        return /<svg\b[^>]*\bfill="#(?:[0-9a-f]{3,8})"/i.test(svg);
      }),
    );
  });
  expect(brandFills.every(Boolean)).toBe(true);
  await expect(
    chips.filter({ hasText: 'AI tools' }).locator('img'),
  ).toHaveCount(0);
  await expect(
    chips.filter({ hasText: 'Data workflows' }).locator('img'),
  ).toHaveCount(0);
});

test('all listed credentials appear with Credly artwork and assertion links', async ({
  page,
}) => {
  await page.goto('/');
  const tiles = page.locator('.credential-tile');
  await expect(tiles).toHaveCount(18);
  await expect(
    tiles.filter({ hasText: 'CompTIA Tech+ Certification' }),
  ).toHaveCount(1);
  await expect(
    tiles.filter({ hasText: 'Prompt Like an Engineer' }),
  ).toHaveCount(1);
  await expect(
    tiles.filter({ hasText: 'Microsoft Azure Fundamentals (AZ-900)' }),
  ).toContainText('20180bff907b977398922ed27b8bf2dbb6429aa2');
  await expect(
    tiles.filter({ hasText: 'Microsoft Certified: Azure Fundamentals' }),
  ).toContainText('31DB658B399D15C5');
  await expect(tiles.filter({ hasText: 'Network Cable' })).toContainText(
    'LetsDefend',
  );
  const assets = await page.locator('.credential-image').evaluateAll((images) =>
    images.map((image) => ({
      src: (image as HTMLImageElement).getAttribute('src'),
      loaded: (image as HTMLImageElement).naturalWidth > 0,
    })),
  );
  expect(assets).toHaveLength(13);
  expect(
    assets.every(
      ({ src, loaded }) => loaded && src?.startsWith('/credentials/'),
    ),
  ).toBe(true);
  const verificationLinks = await page
    .locator('.credential-tile a')
    .evaluateAll((links) =>
      links.map((link) => (link as HTMLAnchorElement).href),
    );
  expect(verificationLinks).toHaveLength(13);
  expect(
    verificationLinks.every((href) =>
      /^https:\/\/www\.credly\.com\/badges\/[0-9a-f-]+$/.test(href),
    ),
  ).toBe(true);
});

test('stack and credential layouts do not cause horizontal overflow', async ({
  page,
}) => {
  await page.goto('/');
  for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({
      viewport: window.innerWidth,
      page: document.documentElement.scrollWidth,
      stack: Math.ceil(
        document.querySelector('.stack')?.getBoundingClientRect().right ?? 0,
      ),
    }));
    expect(dimensions.page, `page overflow at ${width}px`).toBeLessThanOrEqual(
      width,
    );
    expect(
      dimensions.stack,
      `stack extends beyond ${width}px`,
    ).toBeLessThanOrEqual(width);
  }
});

test('theme switching continues to apply all appearance modes', async ({
  page,
}) => {
  await page.goto('/');
  const toggle = page
    .locator('button[aria-label^="Current theme:"]:visible')
    .first();
  for (const theme of ['dark', 'light', 'dim']) {
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await toggle.click();
  }
});
