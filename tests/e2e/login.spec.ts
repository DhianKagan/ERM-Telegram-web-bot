/**
 * Назначение файла: e2e-тест формы входа и проверки отсутствия JS-ошибок.
 * Основные модули: @playwright/test.
 */
import { test, expect } from '@playwright/test';

const markup = `<!DOCTYPE html><html><body>
<form id="login">
  <input placeholder="Telegram ID" />
  <button type="submit">Отправить</button>
</form>
<script>console.log('loaded');</script>
</body></html>`;

test('форма входа загружается без JS-ошибок', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.setContent(markup);
  await expect(page.locator('form#login')).toBeVisible();
  expect(errors).toEqual([]);
});
