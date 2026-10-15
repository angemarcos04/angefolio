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

test('homepage spotlights one credential and links to the full archive', async ({
  page,
}) => {
  await page.goto('/');
  const spotlight = page.locator('.credential-spotlight');
  await expect(spotlight).toHaveCount(1);
  await expect(spotlight).toContainText(
    'Microsoft Azure Fundamentals (AZ-900)',
  );
  await expect(spotlight).toContainText('Microsoft');
  await expect(spotlight).toContainText('Certification');
  await expect(spotlight.locator('.credential-verify')).toHaveAttribute(
    'href',
    'https://learn.microsoft.com/api/credentials/share/en-us/angelliemarcos/31DB658B399D15C5?sharingId=8A574B58CC54B2D7',
  );
  await expect(
    spotlight.locator('.credential-spotlight-art img'),
  ).toHaveAttribute(
    'src',
    '/credentials/microsoft-certified-fundamentals-badge.svg',
  );
  await expect(
    page.getByRole('link', { name: 'All credentials →' }),
  ).toHaveAttribute('href', '/credentials');
});

test('credential archive renders public records, filters types, and expands details', async ({
  page,
}) => {
  await page.goto('/credentials');
  await expect(
    page.getByRole('heading', { name: 'Credentials' }),
  ).toBeVisible();
  await expect(page.locator('.credential-eyebrow')).toHaveText('~/credentials');
  await expect(page.locator('.credential-result-count')).toHaveCount(1);
  await expect(page.locator('.archive-count')).toHaveCount(0);
  const rows = page.locator('.credential-row');
  await expect(rows).toHaveCount(18);
  await expect(
    rows.filter({ hasText: '20180bff907b977398922ed27b8bf2dbb6429aa2' }),
  ).toContainText('20180bff907b977398922ed27b8bf2dbb6429aa2');
  await expect(rows.filter({ hasText: '31DB658B399D15C5' })).toContainText(
    'Microsoft Azure Fundamentals (AZ-900)',
  );
  await expect(rows.filter({ hasText: 'Network Cable' })).toContainText(
    'LetsDefend',
  );
  const assets = await page
    .locator('.credential-thumb img')
    .evaluateAll((images) =>
      images.map((image) => ({
        src: (image as HTMLImageElement).getAttribute('src'),
        loaded: (image as HTMLImageElement).naturalWidth > 0,
      })),
    );
  expect(assets).toHaveLength(14);
  expect(
    assets.every(
      ({ src, loaded }) => loaded && src?.startsWith('/credentials/'),
    ),
  ).toBe(true);
  const verificationLinks = await page
    .locator(
      '.credential-row .credential-actions a[href*="credly.com/badges/"]',
    )
    .evaluateAll((links) =>
      links.map((link) => (link as HTMLAnchorElement).href),
    );
  expect(verificationLinks).toHaveLength(13);
  expect(
    verificationLinks.every((href) =>
      /^https:\/\/www\.credly\.com\/badges\/[0-9a-f-]+$/.test(href),
    ),
  ).toBe(true);
  const courseFilter = page.getByRole('button', { name: 'Courses' });
  await courseFilter.click();
  await expect(courseFilter).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.credential-result-count')).toHaveText(
    '3 credentials',
  );
  await expect(
    rows.filter({ hasText: 'Foundations of Project Management' }),
  ).toBeVisible();
  await expect(
    rows.filter({ hasText: 'Prompt Like an Engineer' }),
  ).toBeHidden();
  await rows
    .filter({ hasText: 'Foundations of Project Management' })
    .locator('summary')
    .click();
  const foundations = rows.filter({
    hasText: 'Foundations of Project Management',
  });
  await expect(foundations).toHaveAttribute('open', '');
  await expect(foundations.locator('.credential-detail-copy h2')).toHaveCount(
    0,
  );
  await expect(
    foundations.locator('.credential-detail-copy'),
  ).not.toContainText('Google');
  await expect(
    foundations.locator('.credential-detail-copy'),
  ).not.toContainText('Issued');
  await expect(foundations.locator('.credential-detail-copy')).toContainText(
    'Course completion',
  );
  await expect(
    page.getByRole('link', { name: 'Source listing ↗' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await rows
    .filter({ hasText: 'Prompt Like an Engineer' })
    .locator('summary')
    .click();
  await expect(
    rows.filter({ hasText: 'Foundations of Project Management' }),
  ).toHaveAttribute('open', '');
  await expect(
    rows.filter({ hasText: 'Prompt Like an Engineer' }),
  ).toHaveAttribute('open', '');
  for (const width of [
    320, 360, 375, 390, 430, 768, 820, 1023, 1024, 1280, 1366, 1440, 1920,
  ]) {
    await page.setViewportSize({ width, height: 850 });
    const widths = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      listRight: Math.ceil(
        document.querySelector('.credential-list')?.getBoundingClientRect()
          .right ?? 0,
      ),
    }));
    expect(
      widths.document,
      `archive overflow at ${width}px`,
    ).toBeLessThanOrEqual(width);
    expect(
      widths.listRight,
      `archive list overflow at ${width}px`,
    ).toBeLessThanOrEqual(width);
  }
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
