import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 20_000,
  retries: 0,
  use: { headless: true, trace: 'off', video: 'off' },
  reporter: [['list']],
  forbidOnly: true,
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
