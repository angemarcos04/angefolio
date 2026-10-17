import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import sharp from 'sharp';

test.skip(
  process.env.AUTHORING_TEST !== '1',
  'Runs against an isolated CMS database.',
);

const email = 'owner@authoring.test';
const password = 'isolated-authoring-test-password';
const image = {
  name: 'pixel.png',
  mimeType: 'image/png',
  buffer: await sharp({
    create: {
      width: 4,
      height: 4,
      channels: 3,
      background: { r: 192, g: 112, b: 64 },
    },
  })
    .png()
    .toBuffer(),
};
let ownerCookies: Awaited<ReturnType<BrowserContext['cookies']>> = [];

async function openEditor(page: Page, collection: string) {
  await page.goto(`/user/${collection}/new`);
  await expect(page.locator('form[id$="-editor"]')).toBeVisible();
  await waitForIslands(page);
  await expect(page.locator('#authoring-status')).toHaveText('');
}

async function waitForIslands(page: Page) {
  await page.waitForFunction(() =>
    [...document.querySelectorAll('astro-island')].every(
      (island) => !island.hasAttribute('ssr'),
    ),
  );
}

async function fillRequiredFields(
  page: Page,
  collection: string,
  unique: string,
) {
  const form = page.locator('form[id$="-editor"]');
  await form.locator('[name="title"]').fill(`R2 ${collection} ${unique}`);
  await form.locator('[name="slug"]').fill(`r2-${collection}-${unique}`);
  await form
    .locator('[name="description"]')
    .fill('Isolated authoring reliability test.');
  if (collection === 'blog' || collection === 'notes') {
    await form.locator('details.authoring-section').evaluate((section) => {
      (section as HTMLDetailsElement).open = true;
    });
    await form.locator('[name="category"]').fill('Testing');
  }
}

test.describe('authoring form reliability', () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${process.env.PLAYWRIGHT_BASE_URL}/user/login`);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/user$/);
    ownerCookies = await context.cookies();
    await context.close();
  });

  test.beforeEach(async ({ context }) => {
    await context.addCookies(ownerCookies);
  });

  test('typing and restoring the original Markdown updates the dirty state', async ({
    page,
  }) => {
    for (const [collection, field] of [
      ['projects', 'caseStudyBody'],
      ['blog', 'body'],
      ['notes', 'body'],
      ['lab', 'body'],
    ]) {
      await openEditor(page, collection);
      const editor = page.locator(`textarea[name="${field}"]`);
      await editor.fill('Temporary Markdown');
      await expect(page.locator('#authoring-status')).toHaveText(
        'Unsaved changes',
      );
      await editor.fill('');
      await expect(page.locator('#authoring-status')).toHaveText('');
    }
  });

  test('toolbar and starter edits notify the controller without cancelling changes', async ({
    page,
  }) => {
    await openEditor(page, 'projects');
    const editor = page.locator('textarea[name="caseStudyBody"]');
    await editor.fill('Selected text');
    await editor.selectText();
    await page.getByRole('button', { name: 'Bold' }).click();
    await expect(editor).toHaveValue('**Selected text**');
    await expect(page.locator('#authoring-status')).toHaveText(
      'Unsaved changes',
    );

    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Insert starter' }).click();
    await expect(editor).toHaveValue('**Selected text**');

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Insert starter' }).click();
    await expect(editor).toHaveValue(/## Overview/);
    await expect(page.locator('#authoring-status')).toHaveText(
      'Unsaved changes',
    );
  });

  test('uploaded Markdown images are inserted at the selection and mark the form dirty', async ({
    page,
  }) => {
    await openEditor(page, 'blog');
    const editor = page.locator('textarea[name="body"]');
    await editor.fill('Before after');
    await editor.evaluate((element: HTMLTextAreaElement) => {
      element.setSelectionRange(7, 7);
    });
    await page.getByRole('button', { name: 'Insert Image' }).click();
    await page
      .locator('.markdown-editor input[type="file"]')
      .setInputFiles(image);
    const altText = page.getByRole('textbox', { name: 'Alternative text' });
    await expect(altText).toBeVisible();
    await altText.fill('Test pixel');
    await page.getByRole('button', { name: 'Insert Markdown image' }).click();
    await expect(editor).toHaveValue(
      /Before !\[Test pixel\]\(\/media\/.+\)after/,
    );
    await expect(page.locator('#authoring-status')).toHaveText(
      'Unsaved changes',
    );
  });

  test('project screenshots serialize after add, reorder, edit, and remove', async ({
    page,
  }) => {
    await openEditor(page, 'projects');
    await page.locator('.authoring-section > summary').click();
    const upload = page.locator('.screenshots input[type="file"]');
    await upload.setInputFiles(image);
    await expect(page.locator('.screenshots .entry')).toHaveCount(1);
    await page
      .locator('.screenshots input[placeholder^="Describe"]')
      .fill('First screenshot');
    await expect(page.locator('input[name="screenshots"]')).toHaveValue(
      /First screenshot/,
    );
    await expect(page.locator('#authoring-status')).toHaveText(
      'Unsaved changes',
    );

    await upload.setInputFiles(image);
    await expect(page.locator('.screenshots .entry')).toHaveCount(2);
    const before = await page.locator('input[name="screenshots"]').inputValue();
    await page.getByRole('button', { name: 'Move up' }).nth(1).click();
    const after = await page.locator('input[name="screenshots"]').inputValue();
    expect(after).not.toBe(before);
    await expect(page.locator('#authoring-status')).toHaveText(
      'Unsaved changes',
    );
    await page.getByRole('button', { name: 'Remove' }).first().click();
    await expect(page.locator('.screenshots .entry')).toHaveCount(1);
  });

  test('cover assignment updates the submitted field and dirty state', async ({
    page,
  }) => {
    await openEditor(page, 'blog');
    await page.locator('.authoring-section > summary').click();
    await page.locator('.cover-field input[type="file"]').setInputFiles(image);
    await page.getByRole('button', { name: 'Upload and use image' }).click();
    await expect(page.locator('#blog-cover')).toHaveValue(/^\/media\//);
    await expect(page.locator('#authoring-status')).toHaveText(
      'Unsaved changes',
    );
    await page.getByRole('button', { name: 'Clear image reference' }).click();
    await expect(page.locator('#blog-cover')).toHaveValue('');
    await expect(page.locator('#authoring-status')).toHaveText('');
  });

  test('native validation opens a collapsed section and focuses its invalid field', async ({
    page,
  }) => {
    await openEditor(page, 'blog');
    const form = page.locator('#blog-editor');
    await form.locator('[name="title"]').fill('Native validation test');
    await form.locator('[name="slug"]').fill(`native-validation-${Date.now()}`);
    await form
      .locator('[name="description"]')
      .fill('Test collapsed validation.');
    const details = page.locator('details.authoring-section');
    await expect(details).not.toHaveAttribute('open', '');
    await page.getByRole('button', { name: 'Save post' }).click();
    await expect(details).toHaveAttribute('open', '');
    await expect(form.locator('[name="category"]')).toBeFocused();
  });

  test('server slug conflict preserves the draft and focuses the slug', async ({
    page,
  }) => {
    await openEditor(page, 'notes');
    await fillRequiredFields(page, 'notes', `conflict-${Date.now()}`);
    await page.locator('[name="body"]').fill('Content that must be retained');
    await page.route('**/api/console/notes/save', (route) =>
      route.fulfill({
        status: 303,
        headers: { location: '/user/notes/new?error=slug&field=slug' },
      }),
    );
    await page
      .locator('#note-editor')
      .evaluate((form: HTMLFormElement) => form.requestSubmit());
    await expect(page.locator('#authoring-status')).toContainText('slug');
    await expect(page.locator('[name="body"]')).toHaveValue(
      'Content that must be retained',
    );
    await expect(page.locator('[name="slug"]')).toBeFocused();
    await expect(page.locator('#authoring-status')).toHaveText(
      /Unsaved changes|slug/,
    );
  });

  test('validation recovery expands the section, preserves help references, and focuses the field', async ({
    page,
  }) => {
    await openEditor(page, 'blog');
    await fillRequiredFields(page, 'blog', `server-validation-${Date.now()}`);
    const category = page.locator('#blog-editor [name="category"]');
    await category.evaluate((element) =>
      element.setAttribute('aria-describedby', 'category-help'),
    );
    await page.route('**/api/console/blog/save', async (route) => {
      await route.fulfill({
        status: 303,
        headers: {
          location: `/user/blog/new?error=validation&field=category`,
        },
      });
    });
    await page.getByRole('button', { name: 'Save post' }).click();
    await expect(page.locator('details.authoring-section')).toHaveAttribute(
      'open',
      '',
    );
    await expect(category).toBeFocused();
    await expect(category).toHaveAttribute('aria-invalid', 'true');
    await expect(category).toHaveAttribute(
      'aria-describedby',
      /category-help.*authoring-status|authoring-status.*category-help/,
    );
    await expect(category).toHaveValue('Testing');
    await expect(page.locator('#authoring-status')).toContainText(
      'Your edits are still here',
    );
    await expect(page.locator('#blog-editor')).not.toHaveAttribute('inert', '');
  });

  test('network failure preserves content and prevents duplicate saves', async ({
    page,
  }) => {
    await openEditor(page, 'notes');
    await fillRequiredFields(page, 'notes', `network-${Date.now()}`);
    const body = page.locator('#note-editor [name="body"]');
    await body.fill('Keep this draft after the request fails.');
    let requests = 0;
    let releaseRequest!: () => void;
    let markRequestStarted!: () => void;
    const responseGate = new Promise<void>((resolveGate) => {
      releaseRequest = resolveGate;
    });
    const requestStarted = new Promise<void>((resolveStarted) => {
      markRequestStarted = resolveStarted;
    });
    await page.route('**/api/console/notes/save', async (route) => {
      requests += 1;
      markRequestStarted();
      await responseGate;
      await route.fulfill({ status: 503, body: 'Unavailable' });
    });
    await page.getByRole('button', { name: 'Save note' }).click();
    await requestStarted;
    await page
      .locator('#note-editor')
      .evaluate((form: HTMLFormElement) => form.requestSubmit());
    releaseRequest();
    await expect(page.locator('#authoring-status')).toContainText(
      'could not be confirmed',
    );
    expect(requests).toBe(1);
    await expect(body).toHaveValue('Keep this draft after the request fails.');
    await expect(page.locator('#note-editor')).not.toHaveAttribute('inert', '');
    await expect(page.locator('#authoring-status')).toHaveClass(/warning/);
  });

  test('an unrecognized redirect or expired session is never reported as saved', async ({
    page,
  }) => {
    await openEditor(page, 'blog');
    await fillRequiredFields(page, 'blog', `session-${Date.now()}`);
    const body = page.locator('#blog-editor [name="body"]');
    await body.fill('Retain this content through a session failure.');
    let requests = 0;
    await page.route('**/api/console/blog/save', async (route) => {
      requests += 1;
      if (requests === 1) {
        await route.fulfill({
          status: 303,
          headers: { location: '/user' },
        });
      } else {
        await route.fulfill({ status: 401, body: 'Authentication required.' });
      }
    });
    await page
      .locator('#blog-editor')
      .evaluate((form: HTMLFormElement) => form.requestSubmit());
    await expect(page.locator('#authoring-status')).toContainText(
      'could not be confirmed',
    );
    await expect(page).toHaveURL(/\/user\/blog\/new$/);
    await page
      .locator('#blog-editor')
      .evaluate((form: HTMLFormElement) => form.requestSubmit());
    await expect(page.locator('#authoring-status')).toContainText(
      'session expired',
    );
    await expect(body).toHaveValue(
      'Retain this content through a session failure.',
    );
    await expect(page.locator('#blog-editor')).not.toHaveAttribute('inert', '');
    await expect(page.locator('#authoring-status')).toHaveClass(/warning/);
  });

  test('closing the private preview leaves current values and dirty state intact', async ({
    page,
  }) => {
    await openEditor(page, 'lab');
    const editor = page.locator('#lab-editor [name="body"]');
    await editor.fill('Previewed draft content.');
    await page.getByRole('button', { name: 'Preview Page' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.getByRole('button', { name: 'Close page preview' }).click();
    await expect(dialog).toBeHidden();
    await expect(editor).toHaveValue('Previewed draft content.');
    await expect(page.locator('#authoring-status')).toHaveText(
      'Unsaved changes',
    );
  });

  test('private page previews reflect the current unsaved presentation data for every collection', async ({
    page,
  }) => {
    for (const collection of ['projects', 'blog', 'notes', 'lab'] as const) {
      const unique = `${collection}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      await openEditor(page, collection);
      await fillRequiredFields(page, collection, unique);
      const form = page.locator('form[id$="-editor"]');
      const title = `Unsaved preview ${collection} ${unique}`;
      await form.locator('[name="title"]').fill(title);
      const bodyName = collection === 'projects' ? 'caseStudyBody' : 'body';
      await form
        .locator(`[name="${bodyName}"]`)
        .fill('Current private preview article.');

      if (collection === 'projects') {
        await form.locator('details.authoring-section').evaluate((section) => {
          (section as HTMLDetailsElement).open = true;
        });
        await form.locator('[name="status"]').selectOption('In Progress');
        await form.locator('[name="category"]').fill('Preview category');
        await form.locator('[name="stack"]').fill('Astro\nTypeScript');
        await form.locator('[name="problem"]').fill('Preview problem');
        await form.locator('[name="demo"]').fill('https://example.com/demo');
        await form
          .locator('[name="links"]')
          .fill('Documentation | https://example.com/docs');
      } else if (collection === 'blog' || collection === 'notes') {
        await form.locator('details.authoring-section').evaluate((section) => {
          (section as HTMLDetailsElement).open = true;
        });
        await form.locator('[name="summary"]').fill('Preview summary');
        await form.locator('[name="tags"]').fill('Astro\nSSR');
      } else {
        await form.locator('details.authoring-section').evaluate((section) => {
          (section as HTMLDetailsElement).open = true;
        });
        await form.locator('[name="category"]').fill('Preview category');
        await form.locator('[name="status"]').selectOption('Testing');
        await form.locator('[name="risk"]').selectOption('Medium');
        await form.locator('[name="tools"]').fill('Node\nPlaywright');
        await form
          .locator('[name="lessons"]')
          .fill('Keep the preview current.');
      }

      await page.getByRole('button', { name: 'Preview Page' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole('heading', { name: title, level: 1 }),
      ).toBeVisible();
      await expect(
        dialog.getByText('Current private preview article.'),
      ).toBeVisible();
      for (const width of [
        320, 360, 390, 430, 768, 820, 1024, 1280, 1366, 1440,
      ]) {
        await page.setViewportSize({ width, height: 900 });
        await expect(dialog).toBeVisible();
        const overflows = await dialog.evaluate(
          (element) => element.scrollWidth > element.clientWidth,
        );
        expect(overflows, `${collection} preview overflows at ${width}px`).toBe(
          false,
        );
      }
      if (collection === 'projects') {
        await expect(
          dialog.getByRole('link', { name: /Live demo/ }),
        ).toHaveAttribute('href', 'https://example.com/demo');
        await expect(
          dialog.getByRole('link', { name: 'Documentation' }),
        ).toHaveAttribute('href', 'https://example.com/docs');
        await expect(dialog.getByText('Preview problem')).toBeVisible();
      } else if (collection === 'blog' || collection === 'notes') {
        await expect(dialog.getByText('Preview summary')).toBeVisible();
        await expect(
          dialog.getByLabel(collection === 'blog' ? 'Post tags' : 'Note tags'),
        ).toContainText('Astro');
      } else {
        await expect(
          dialog
            .getByLabel('Experiment metadata')
            .getByText('Preview category'),
        ).toBeVisible();
        await expect(dialog.getByText('Medium')).toBeVisible();
        await expect(dialog.getByText('Playwright')).toBeVisible();
        await expect(
          dialog.getByText('Keep the preview current.'),
        ).toBeVisible();
      }
      await page.getByRole('button', { name: 'Close page preview' }).click();
      await expect(page.locator('#authoring-status')).toHaveText(
        'Unsaved changes',
      );
    }
  });

  test('all four collections save successfully and navigate only after confirmation', async ({
    page,
  }) => {
    for (const collection of ['projects', 'blog', 'notes', 'lab'] as const) {
      const unique = `${collection}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      await openEditor(page, collection);
      await fillRequiredFields(page, collection, unique);
      const bodyField = collection === 'projects' ? 'caseStudyBody' : 'body';
      const title = `R2 ${collection} ${unique}`;
      await page.locator(`[name="${bodyField}"]`).fill('Saved private draft.');
      if (collection === 'projects') {
        await page.locator('.authoring-section > summary').click();
        await page
          .locator('.screenshots input[type="file"]')
          .setInputFiles(image);
        await expect(page.locator('.screenshots .entry')).toHaveCount(1);
        await page
          .locator('.screenshots input[placeholder^="Describe"]')
          .fill('Saved screenshot');
      }
      await page
        .locator('form[id$="-editor"]')
        .evaluate((form: HTMLFormElement) => form.requestSubmit());
      const destination = {
        projects: /\/user\/projects\?notice=created$/,
        blog: /\/user\/blog\/[^/]+\?notice=saved$/,
        notes: /\/user\/notes\/[^/]+\?notice=saved$/,
        lab: /\/user\/lab\/[^/]+\?notice=saved$/,
      }[collection];
      await expect(page).toHaveURL(destination);
      if (collection === 'projects') {
        const editHref = await page
          .getByRole('link', { name: title })
          .getAttribute('href');
        expect(editHref).toMatch(/^\/user\/projects\//);
        await page.goto(editHref!);
        await expect(page).toHaveURL(/\/user\/projects\/[^/]+$/);
        await waitForIslands(page);
        await expect(page.locator('#authoring-status')).toHaveText('');
        await expect(
          page.locator('#project-editor [name="caseStudyBody"]'),
        ).toHaveValue('Saved private draft.');
        await expect(page.locator('.screenshots .entry')).toHaveCount(1);
        await expect(
          page.locator('.screenshots input[placeholder^="Describe"]'),
        ).toHaveValue('Saved screenshot');
      }
    }
  });
});
