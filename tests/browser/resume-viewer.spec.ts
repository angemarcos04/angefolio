import { expect, test } from '@playwright/test';

test('resume action opens an accessible in-page PDF dialog and restores focus', async ({
  page,
  request,
}) => {
  await page.goto('/');

  const trigger = page.getByRole('button', { name: 'Resume' });
  const dialog = page.locator('#resume-preview-dialog');
  await expect(trigger).toBeVisible();
  const actions = page.locator('#introduction .actions');
  await expect(actions.getByRole('link', { name: 'Projects' })).toHaveAttribute(
    'href',
    '/projects',
  );
  await expect(actions.getByRole('link', { name: 'Email' })).toHaveAttribute(
    'href',
    /^mailto:/,
  );
  await expect(page.locator('.resume-pdf')).not.toHaveAttribute('src', /.+/);

  const originalUrl = page.url();
  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'angelliemarcos-resume2026.pdf' }),
  ).toBeVisible();
  expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(
    true,
  );
  expect(page.url()).toBe(originalUrl);
  await expect(page.locator('.resume-pdf')).toHaveAttribute(
    'src',
    '/resume/angelliemarcos-resume2026.pdf',
  );
  await expect(
    page.getByRole('link', { name: 'Download PDF' }),
  ).toHaveAttribute('download', 'Angellie-Marcos-Resume-2026.pdf');
  expect(await page.evaluate(() => document.body.style.overflow)).toBe(
    'hidden',
  );

  const pdfResponse = await request.get(
    '/resume/angelliemarcos-resume2026.pdf',
  );
  expect(pdfResponse.status()).toBe(200);
  expect(pdfResponse.headers()['content-type']).toContain('application/pdf');
  expect((await pdfResponse.body()).subarray(0, 5).toString()).toBe('%PDF-');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('resume dialog fits small screens and closes from its controls or backdrop', async ({
  page,
}) => {
  await page.goto('/');
  for (const width of [
    320, 360, 375, 390, 430, 768, 820, 1023, 1024, 1280, 1366, 1440, 1920,
  ]) {
    await page.setViewportSize({ width, height: 740 });

    const trigger = page.getByRole('button', { name: 'Resume' });
    const dialog = page.locator('#resume-preview-dialog');
    await trigger.click();
    await expect(dialog).toBeVisible();

    const dialogBox = await page.locator('.resume-window').boundingBox();
    expect(dialogBox).not.toBeNull();
    expect(dialogBox!.width).toBeLessThanOrEqual(width);
    expect(dialogBox!.height).toBeLessThanOrEqual(740);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);

    await page.getByRole('button', { name: 'Close resume preview' }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  }

  await page.setViewportSize({ width: 1280, height: 800 });
  const trigger = page.getByRole('button', { name: 'Resume' });
  const dialog = page.locator('#resume-preview-dialog');
  await trigger.click();
  await expect(dialog).toBeVisible();
  await dialog.click({ position: { x: 4, y: 4 } });
  await expect(dialog).toBeHidden();
});

test('resume window adapts to Dark, Dim, and Light theme surfaces', async ({
  page,
}) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Resume' });
  const colors = new Set<string>();

  for (const theme of ['dark', 'dim', 'light']) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    await trigger.click();
    colors.add(
      await page
        .locator('.resume-window')
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    );
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  }

  expect(colors.size).toBe(3);
});

test('resume and terminal dialogs can be opened sequentially without scroll-lock residue', async ({
  page,
}) => {
  await page.goto('/');

  const resumeTrigger = page.getByRole('button', { name: 'Resume' });
  await resumeTrigger.click();
  await page.keyboard.press('Escape');
  await expect(resumeTrigger).toBeFocused();

  const terminalTrigger = page.getByRole('button', {
    name: 'Open the angefolio portfolio terminal',
  });
  await terminalTrigger.click();
  await expect(page.locator('#portfolio-terminal-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(terminalTrigger).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});
