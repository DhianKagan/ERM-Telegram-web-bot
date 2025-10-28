/**
 * Назначение файла: e2e-smoke-тест баннера очистки хранилища.
 * Основные модули: @playwright/test, express.
 */
import { test, expect } from '@playwright/test';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import ru from '../../apps/web/src/locales/ru/translation.json';

type FileInfo = {
  id: string;
  path: string;
  name: string;
  userId: number;
  type: string;
  size: number;
  uploadedAt: string;
  taskId?: string | null;
};

const initialFiles: FileInfo[] = [
  {
    id: '64d000000000000000000010',
    path: 'docs/linked.pdf',
    name: 'linked.pdf',
    userId: 1,
    type: 'application/pdf',
    size: 1024,
    uploadedAt: '2024-05-20T10:00:00.000Z',
    taskId: 'A-10',
  },
  {
    id: '64d000000000000000000011',
    path: 'tmp/orphan.txt',
    name: 'orphan.txt',
    userId: 2,
    type: 'text/plain',
    size: 256,
    uploadedAt: '2024-03-01T09:00:00.000Z',
    taskId: null,
  },
];

const files: FileInfo[] = [];
const diagnosticsTexts = ru.storage.diagnostics;

const app = express();
app.use(express.json());

app.get('/api/v1/storage', (_req, res) => {
  res.json(files);
});

app.get('/api/v1/storage/diagnostics', (_req, res) => {
  const kept = files.filter((file) => file.taskId);
  files.splice(0, files.length, ...kept);
  const snapshot = {
    totalFiles: files.length,
    linkedFiles: kept.length,
    detachedFiles: files.length - kept.length,
  };
  res.json({
    generatedAt: '2024-07-01T03:00:00.000Z',
    snapshot,
    detachedFiles: [],
  });
});

app.get('/cp/storage', (_req, res) => {
  const syncOk = ru.storage.sync.ok;
  const syncWarning = ru.storage.sync.warning;
  const diagnostics = diagnosticsTexts;
  const script = `(() => {
    const status = document.getElementById('status');
    const report = document.getElementById('report');
    const button = document.getElementById('check');

    report.textContent = ${JSON.stringify(diagnostics.placeholder)};

    async function refresh() {
      const res = await fetch('/api/v1/storage');
      const data = await res.json();
      const detached = data.filter((file) => !file.taskId).length;
      if (detached === 0) {
        status.textContent = ${JSON.stringify(syncOk)}.replace('{{count}}', String(data.length));
      } else {
        status.textContent = ${JSON.stringify(syncWarning)}.replace('{{count}}', String(detached));
      }
    }

    refresh();

    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const res = await fetch('/api/v1/storage/diagnostics');
        if (!res.ok) throw new Error('diagnostics');
        const payload = await res.json();
        const summary = ${JSON.stringify(diagnostics.snapshot)}
          .replace('{{total}}', String(payload.snapshot.totalFiles))
          .replace('{{linked}}', String(payload.snapshot.linkedFiles))
          .replace('{{detached}}', String(payload.snapshot.detachedFiles));
        const stamp = ${JSON.stringify(diagnostics.lastRun)}.replace('{{date}}', payload.generatedAt);
        report.textContent = stamp + ' ' + summary;
      } catch (error) {
        report.textContent = ${JSON.stringify(diagnostics.error)};
      } finally {
        await refresh();
        button.disabled = false;
      }
    });
  })();`;

  res.send(`<!DOCTYPE html>
  <html lang="ru">
    <head><meta charset="utf-8"><title>Storage cleanup test</title></head>
    <body>
      <div id="status"></div>
      <button id="check">${diagnostics.cta}</button>
      <div id="report"></div>
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
  files.splice(0, files.length, ...initialFiles.map((file) => ({ ...file })));
});

test('[cleanup] обновляет счётчик после имитации крон-очистки', async ({ page }) => {
  await page.goto(`${baseUrl}/cp/storage`);
  const warningText = ru.storage.sync.warning.replace('{{count}}', '1');
  await expect(page.locator('#status')).toHaveText(warningText);

  const requestPromise = page.waitForRequest((request) =>
    request.method() === 'GET' && request.url().includes('/api/v1/storage/diagnostics'),
  );

  await page.getByRole('button', { name: diagnosticsTexts.cta }).click();
  await requestPromise;

  const okText = ru.storage.sync.ok.replace('{{count}}', '1');
  await expect(page.locator('#status')).toHaveText(okText);
  const snapshotText = ru.storage.diagnostics.snapshot
    .replace('{{total}}', '1')
    .replace('{{linked}}', '1')
    .replace('{{detached}}', '0');
  await expect(page.locator('#report')).toContainText(snapshotText);
});
