/**
 * Назначение файла: e2e-тест подтверждения удаления файла и обновления списка.
 * Основные модули: @playwright/test, express.
 */
import { test, expect } from '@playwright/test';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import ru from '../../apps/web/src/locales/ru/translation.json';

type FileInfo = { path: string; name: string };

const initialFiles: FileInfo[] = [
  { path: 'docs/report.pdf', name: 'report.pdf' },
  { path: 'img/photo.jpg', name: 'photo.jpg' },
];

const files: FileInfo[] = [];

const app = express();
app.use(express.json());

app.get('/api/v1/storage', (_req, res) => {
  res.json(files);
});

app.delete('/api/v1/storage/:filePath', (req, res) => {
  const filePath = decodeURIComponent(req.params.filePath);
  const index = files.findIndex((f) => f.path === filePath);
  if (index === -1) {
    res.sendStatus(404);
    return;
  }
  files.splice(index, 1);
  res.json({ ok: true });
});

app.get('/cp/storage', (_req, res) => {
  const script = `(() => {
    const confirmTemplate = ${JSON.stringify(ru.storage.deleteConfirm)};
    const successText = ${JSON.stringify(ru.storage.deleteSuccess)};
    const errorText = ${JSON.stringify(ru.storage.deleteError)};
    const deleteLabel = ${JSON.stringify(ru.storage.delete)};
    const deleteHint = ${JSON.stringify(ru.storage.deleteHint)};
    const toast = document.getElementById('toast');
    const list = document.getElementById('files');
    const count = document.getElementById('count');

    async function refresh() {
      try {
        const res = await fetch('/api/v1/storage');
        if (!res.ok) throw new Error('list');
        const data = await res.json();
        list.innerHTML = '';
        data.forEach((file) => {
          const button = document.createElement('button');
          button.textContent = `${deleteLabel}: ${'$'}{file.name}`;
          button.setAttribute('data-path', file.path);
          button.title = deleteHint;
          button.addEventListener('click', async () => {
            const message = confirmTemplate.replace('{{name}}', file.name);
            if (!window.confirm(message)) return;
            try {
              const response = await fetch(`/api/v1/storage/${'$'}{encodeURIComponent(file.path)}`, { method: 'DELETE' });
              if (!response.ok) throw new Error('delete');
              toast.textContent = successText;
              toast.dataset.status = 'success';
              await refresh();
            } catch (error) {
              toast.textContent = errorText;
              toast.dataset.status = 'error';
            }
          });
          list.appendChild(button);
        });
        count.textContent = String(data.length);
      } catch (err) {
        toast.textContent = errorText;
        toast.dataset.status = 'error';
      }
    }

    refresh();
  })();`;

  res.send(`<!DOCTYPE html>
  <html lang="ru">
    <head><meta charset="utf-8"><title>Storage test</title></head>
    <body>
      <div id="count"></div>
      <div id="files"></div>
      <div id="toast" data-status=""></div>
      <script>${script}</script>
    </body>
  </html>`);
});

let server: Server;
let baseUrl = '';

test.beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

test.afterAll(() => {
  server.close();
});

test.beforeEach(() => {
  files.splice(0, files.length, ...initialFiles.map((f) => ({ ...f })));
});

test('подтверждает удаление и отправляет DELETE-запрос', async ({ page }) => {
  await page.goto(`${baseUrl}/cp/storage`);
  await page.waitForSelector('[data-path="docs/report.pdf"]');

  const messages: string[] = [];
  page.once('dialog', (dialog) => {
    messages.push(dialog.message());
    dialog.accept();
  });

  const requestPromise = page.waitForRequest(
    (request) => request.method() === 'DELETE' && request.url().includes('/api/v1/storage/'),
  );

  await page.click('[data-path="docs/report.pdf"]');

  const request = await requestPromise;
  expect(request.url()).toContain(encodeURIComponent('docs/report.pdf'));

  await expect(page.locator('#toast')).toHaveText(ru.storage.deleteSuccess);
  await expect(page.locator('#toast')).toHaveAttribute('data-status', 'success');
  await expect(page.locator('#count')).toHaveText('1');

  expect(messages[0]).toBe(ru.storage.deleteConfirm.replace('{{name}}', 'report.pdf'));
});
