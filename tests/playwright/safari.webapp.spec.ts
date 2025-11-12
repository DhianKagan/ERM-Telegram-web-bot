/**
 * Назначение файла: e2e-проверка работы Telegram WebApp в Safari (WebKit).
 * Основные модули: @playwright/test, express.
 */
import { test, expect } from '@playwright/test';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

const app = express();

const markup = `<!DOCTYPE html><html><body>
<div id="mode"></div>
<script type="module">
  const root = document.getElementById('mode');
  const params = new URLSearchParams(location.search);
  const forceBrowser = params.get('browser') === '1';
  const webApp = window.Telegram?.WebApp;
  const supportedPlatforms = ['android', 'ios', 'web', 'macos', 'tdesktop'];
  const minVersion = '6.0';
  function versionAtLeast(current, min) {
    const a = current.split('.').map(Number);
    const b = min.split('.').map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const x = a[i] || 0;
      const y = b[i] || 0;
      if (x > y) return true;
      if (x < y) return false;
    }
    return true;
  }
  let isTelegram = false;
  if (!forceBrowser && webApp) {
    isTelegram = supportedPlatforms.includes(webApp.platform) && versionAtLeast(webApp.version, minVersion);
    if (!isTelegram) {
      window.__ALERT_MESSAGE__ = 'fallback';
    }
  }
  root.textContent = isTelegram ? 'telegram:' + webApp.platform : 'browser';
</script>
</body></html>`;

app.get('/', (_req, res) => {
  res.send(markup);
});

let server: Server;
let baseURL = '';

test.beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      baseURL = `http://localhost:${port}`;
      resolve();
    });
  });
});

test.afterAll(() => {
  server.close();
});

test('Safari определяет Telegram WebApp по платформе macos', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== 'webkit',
    'Тест запускается только в Safari (WebKit).',
  );

  await page.addInitScript(() => {
    window.Telegram = {
      WebApp: {
        platform: 'macos',
        version: '6.5',
      },
    } as any;
  });

  await page.goto(baseURL);
  await expect(page.locator('#mode')).toHaveText('telegram:macos');

  const alertMessage = await page.evaluate(
    () => (window as any).__ALERT_MESSAGE__ ?? null,
  );
  expect(alertMessage).toBeNull();
});
