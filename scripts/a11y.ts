/**
 * Назначение файла: проверка контраста страницы bot/web/index.html через Playwright.
 * Основные модули: @playwright/test, @axe-core/playwright, path.
 */
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const filePath = path.resolve('bot/web/index.html');
  await page.goto(`file://${filePath}`);
  const results = await new AxeBuilder({ page })
    .withTags(['color-contrast'])
    .analyze();
  await browser.close();

  if (results.violations.length > 0) {
    console.error('Найдены нарушения контраста:', results.violations);
    process.exit(1);
  }
  console.log('Нарушения контраста не обнаружены.');
})();
