/**
 * Назначение файла: e2e-тест работы клиента без Telegram WebApp.
 * Основные модули: @playwright/test, express.
 */
import { test, expect } from '@playwright/test';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

const markup = `<!DOCTYPE html><html><body>
<div id="root"></div>
<script type="module">
  const root = document.getElementById('root');
  const params = new URLSearchParams(location.search);
  const forceBrowser = params.get('browser') === '1';
  const app = window.Telegram?.WebApp;
  const platforms = ['android','ios','web','macos','tdesktop'];
  const minVersion = '6.0';
  function gte(a,b){
    const x=a.split('.').map(Number);const y=b.split('.').map(Number);
    for(let i=0;i<Math.max(x.length,y.length);i++){
      const xx=x[i]||0, yy=y[i]||0;
      if(xx>yy)return true; if(xx<yy)return false;
    }
    return true;
  }
  const isTelegram = !forceBrowser && app && platforms.includes(app.platform) && gte(app.version,minVersion);
  if(app && !isTelegram) alert('unsupported');
  root.textContent = isTelegram ? 'tg' : 'browser';
</script>
</body></html>`;

const app = express();
app.get('/', (_req, res) => res.send(markup));
const server: Server = app.listen(0);
const { port } = server.address() as AddressInfo;
const baseURL = `http://localhost:${port}`;

test.afterAll(() => {
  server.close();
});

test('клиент без WebApp использует браузерную версию без предупреждений', async ({
  page,
}) => {
  const dialogs: string[] = [];
  page.on('dialog', (d) => dialogs.push(d.message()));
  await page.goto(baseURL);
  await expect(page.locator('#root')).toHaveText('browser');
  expect(dialogs).toEqual([]);
});
