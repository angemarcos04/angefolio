import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4321';
const port = new URL(baseURL).port || '4321';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `pnpm exec astro dev --force --host 127.0.0.1 --port ${port}`,
    env: {
      PLAYWRIGHT_TEST: 'true',
      ASTRO_DEV_BACKGROUND: '0',
    },
    url: `${baseURL}/`,
    reuseExistingServer: !process.env.CI && process.env.AUTHORING_TEST !== '1',
    timeout: 120_000,
  },
});
