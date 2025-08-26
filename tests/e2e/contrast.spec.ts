/**
 * Назначение файла: E2E-проверка контраста и фокусов базовых компонентов.
 * Основные модули: @playwright/test, @axe-core/playwright.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const markup = `<!DOCTYPE html><html><head><style>
body { padding: 1rem; }
button {
  background-color: #2563eb;
  color: #ffffff;
  border-radius: 0.375rem;
  padding: 0.5rem 1rem;
}
button:focus-visible {
  outline: 2px solid #1d4ed8;
  outline-offset: 2px;
}
label {
  display: block;
  margin-bottom: 0.25rem;
}
input {
  width: 100%;
  border: 1px solid #d1d5dd;
  border-radius: 0.375rem;
  padding: 0.5rem 1rem;
}
input:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}
.spacer { margin-top: 1rem; }
</style></head><body>
<button>Кнопка</button>
<div class="spacer">
<label for="input">Введите</label>
<input id="input" />
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
