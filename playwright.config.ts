/* Назначение файла: конфигурация Playwright для браузеров и устройств.
   Основные модули: @playwright/test. */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  workers: process.env.CI ? 1 : undefined,
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Pixel 7', use: { ...devices['Pixel 7'] } },
    { name: 'iPhone 14', use: { ...devices['iPhone 14'] } },
  ],
});
