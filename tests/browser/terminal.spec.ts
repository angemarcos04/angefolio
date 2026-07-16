import { expect, test, type Page } from '@playwright/test';

const triggerName = 'Open the angefolio portfolio terminal';
const runtimeErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
});

test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page)).toEqual([]);
});

async function waitForTerminalHydration(page: Page) {
  await page.waitForFunction((label) => {
    const button = document.querySelector(`[aria-label="${label}"]`);
    return !button?.closest('astro-island')?.hasAttribute('ssr');
  }, triggerName);
}

async function openTerminal(page: Page) {
  const trigger = page.getByRole('button', { name: triggerName });
  await waitForTerminalHydration(page);
  await trigger.click();
  await expect(page.getByLabel('Terminal command input')).toBeFocused();
  return trigger;
}

async function runCommand(page: Page, command: string) {
  const input = page.getByLabel('Terminal command input');
  await input.fill(command);
  await input.press('Enter');
}

test('homepage server-renders the terminal preview without runtime errors', async ({
  page,
  request,
}) => {
  const response = await request.get('/');
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain(triggerName);
  expect(html).toContain('$ cat recent.log');

  await page.goto('/');
  await expect(page.getByRole('button', { name: triggerName })).toBeVisible();
});

test('dialog is natively modal and restores focus and body scroll', async ({
  page,
}) => {
  await page.goto('/');
  const trigger = await openTerminal(page);
  const dialog = page.getByRole('dialog');

  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(
    true,
  );
  expect(await page.evaluate(() => document.body.style.overflow)).toBe(
    'hidden',
  );

  await page.keyboard.press('Shift+Tab');
  expect(
    await page.evaluate(() =>
      document
        .querySelector('#portfolio-terminal-dialog')
        ?.contains(document.activeElement),
    ),
  ).toBe(true);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('failed modal opening restores focus, scroll, and expanded state', async ({
  page,
}) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: triggerName });
  await waitForTerminalHydration(page);
  await page.evaluate(() => {
    HTMLDialogElement.prototype.showModal = () => {
      throw new DOMException('Forced modal failure for testing.');
    };
  });

  await trigger.click();

  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('preview keyboard activation, close controls, backdrop, and shortcut work', async ({
  page,
}) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: triggerName });
  const dialog = page.getByRole('dialog');

  await waitForTerminalHydration(page);
  await trigger.focus();
  await trigger.press('Enter');
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'Close portfolio terminal' }).click();
  await expect(trigger).toBeFocused();

  await trigger.press('Space');
  await expect(dialog).toBeVisible();
  await dialog.click({ position: { x: 4, y: 4 } });
  await expect(trigger).toBeFocused();

  const themeToggle = page.getByRole('button', { name: /Current theme:/ });
  await themeToggle.focus();
  await page.keyboard.press('Control+Backquote');
  await expect(page.getByLabel('Terminal command input')).toBeFocused();
  await page.keyboard.press('Control+Backquote');
  await expect(themeToggle).toBeFocused();

  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.keyboard.press('Control+Backquote');
  await page.keyboard.press('Control+Backquote');
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('exit stops its chain and invalid commands and themes update visibly', async ({
  page,
}) => {
  await page.goto('/');
  await openTerminal(page);

  await runCommand(page, 'theme dim');
  await expect(
    page.getByRole('button', { name: /Current theme: Dim/ }),
  ).toBeVisible();
  expect(await page.locator('html').getAttribute('data-theme')).toBe('dim');

  await runCommand(page, 'invalid-command');
  await expect(page.locator('.line-error').last()).toContainText(
    "Command 'invalid-command' not found",
  );

  await runCommand(page, 'exit && pwd');
  await expect(page.getByRole('dialog')).toBeHidden();
  await openTerminal(page);
  await expect(
    page.locator('.output-line', { hasText: '/home/ange' }),
  ).toHaveCount(0);
});

test('navigation closes the terminal and stops the remaining chain', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('theme', 'light'));
  await page.reload();
  await openTerminal(page);
  await runCommand(page, 'open projects && theme dark');

  await page.waitForURL('**/projects');
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(
    'light',
  );
  expect(await page.locator('html').getAttribute('data-theme')).toBe('light');
});

for (const width of [320, 375, 768, 1440]) {
  test(`terminal remains usable without viewport overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await openTerminal(page);
    await expect(
      page.getByRole('button', { name: 'Close portfolio terminal' }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}
