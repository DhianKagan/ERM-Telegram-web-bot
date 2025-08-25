/**
 * Назначение файла: E2E-проверка контраста и фокусов базовых компонентов.
 * Основные модули: @playwright/test, @axe-core/playwright.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const tailwind = `https://cdn.tailwindcss.com?plugins=forms`;
const markup = `<!DOCTYPE html><html><head>
<script src="${tailwind}"></script>
</head><body class="p-4">
<button class="bg-blue-600 text-white rounded-md px-4 py-2 focus-visible:ring-2 focus-visible:ring-offset-2">
Кнопка
</button>
<div class="mt-4">
<label for="input" class="mb-1 block">Введите</label>
<input id="input" class="w-full rounded-md border border-gray-300 px-4 py-2 focus-visible:ring-2 focus-visible:ring-blue-500" />
</div>
</body></html>`;

test('контраст и фокусы компонентов', async ({ page }) => {
  await page.setContent(markup);
  await expect(page.getByLabel('Введите')).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['color-contrast'])
    .analyze();
  expect(results.violations).toEqual([]);

  await page.focus('button');
  const buttonRing = await page.$eval(
    'button',
    (el) => getComputedStyle(el).outlineStyle,
  );
  expect(buttonRing).not.toBe('none');

  await page.focus('#input');
  const inputRing = await page.$eval(
    '#input',
    (el) => getComputedStyle(el).outlineStyle,
  );
  expect(inputRing).not.toBe('none');
});
