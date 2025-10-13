/**
 * Назначение файла: e2e-тест подтверждения удаления файла и обновления списка.
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
  taskId?: string;
  url: string;
};

const initialFiles: FileInfo[] = [
  {
    id: '64d000000000000000000001',
    path: 'docs/report.pdf',
    name: 'report.pdf',
    userId: 1,
    type: 'application/pdf',
    size: 1024,
    uploadedAt: '2024-05-01T10:00:00.000Z',
    taskId: 'A-1',
    url: 'https://example.com/report.pdf',
  },
  {
    id: '64d000000000000000000002',
    path: 'img/photo.jpg',
    name: 'photo.jpg',
    userId: 2,
    type: 'image/jpeg',
    size: 2048,
    uploadedAt: '2024-04-30T09:00:00.000Z',
    taskId: undefined,
    url: 'https://example.com/photo.jpg',
  },
];

const files: FileInfo[] = [];

const app = express();
app.use(express.json());

app.get('/api/v1/storage', (req, res) => {
  const { userId, type } = req.query as { userId?: string; type?: string };
  let filtered = [...files];
  if (userId) {
    const id = Number(userId);
    filtered = filtered.filter((file) => file.userId === id);
  }
  if (type) {
    filtered = filtered.filter((file) => file.type === type);
  }
  res.json(filtered);
});

app.get('/api/v1/storage/:id', (req, res) => {
  const file = files.find((f) => f.id === req.params.id);
  if (!file) {
    res.sendStatus(404);
    return;
  }
  res.json(file);
});

app.delete('/api/v1/storage/:id', (req, res) => {
  const fileId = decodeURIComponent(req.params.id);
  const index = files.findIndex((f) => f.id === fileId);
  if (index === -1) {
    res.sendStatus(404);
    return;
  }
  files.splice(index, 1);
  res.json({ ok: true });
});

app.get('/cp/storage', (_req, res) => {
  const columnTitles = ru.storage.columns;
  const script = `(() => {
    const confirmTemplate = ${JSON.stringify(ru.storage.deleteConfirm)};
    const successText = ${JSON.stringify(ru.storage.deleteSuccess)};
    const errorText = ${JSON.stringify(ru.storage.deleteError)};
    const deleteLabel = ${JSON.stringify(ru.storage.delete)};
    const deleteHint = ${JSON.stringify(ru.storage.deleteHint)};
    const userLabel = ${JSON.stringify(ru.storage.userLabel)};
    const taskLabel = ${JSON.stringify(ru.storage.taskLabel)};
    const taskMissing = ${JSON.stringify(ru.storage.taskMissing)};
    const filterEmpty = ${JSON.stringify(ru.storage.filters.empty)};
    const loadError = ${JSON.stringify(ru.storage.loadError)};
    const columns = ${JSON.stringify(columnTitles)};
    const toast = document.getElementById('toast');
    const tbody = document.getElementById('table-body');
    const count = document.getElementById('count');
    const applyBtn = document.getElementById('apply');
    const resetBtn = document.getElementById('reset');
    const userFilters = document.getElementById('user-filters');
    const typeFilters = document.getElementById('type-filters');

    function getChecked(container) {
      const box = container.querySelector('input[type="checkbox"]:checked');
      return box ? box.value : undefined;
    }

    function render(data) {
      tbody.innerHTML = '';
      if (!data.length) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.textContent = filterEmpty;
        cell.colSpan = 7;
        row.appendChild(cell);
        tbody.appendChild(row);
      }
      data.forEach((file) => {
        const row = document.createElement('tr');
        const cells = [
          file.name,
          userLabel.replace('{{id}}', String(file.userId)),
          file.type,
          String(file.size),
          file.taskId ? taskLabel.replace('{{id}}', String(file.taskId)) : taskMissing,
          file.uploadedAt,
        ];
        cells.forEach((value) => {
          const cell = document.createElement('td');
          cell.textContent = value;
          row.appendChild(cell);
        });
        const actions = document.createElement('td');
        const del = document.createElement('button');
        del.textContent = deleteLabel;
        del.title = deleteHint;
        del.addEventListener('click', async () => {
          const message = confirmTemplate.replace('{{name}}', file.name);
          if (!window.confirm(message)) return;
          try {
            const response = await fetch(
              '/api/v1/storage/' + encodeURIComponent(file.id),
              { method: 'DELETE' },
            );
            if (!response.ok) throw new Error('delete');
            toast.textContent = successText;
            toast.dataset.status = 'success';
            await refresh({
              userId: getChecked(userFilters),
              type: getChecked(typeFilters),
            });
          } catch (error) {
            toast.textContent = errorText;
            toast.dataset.status = 'error';
          }
        });
        actions.appendChild(del);
        row.appendChild(actions);
        tbody.appendChild(row);
      });
      count.textContent = String(data.length);
    }

    async function refresh(params = {}) {
      const search = new URLSearchParams();
      if (params.userId) search.set('userId', params.userId);
      if (params.type) search.set('type', params.type);
      try {
        const qs = search.toString();
        const endpoint = '/api/v1/storage' + (qs ? '?' + qs : '');
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error('list');
        const data = await res.json();
        render(data);
      } catch (err) {
        toast.textContent = loadError;
        toast.dataset.status = 'error';
      }
    }

    applyBtn.addEventListener('click', () => {
      refresh({
        userId: getChecked(userFilters),
        type: getChecked(typeFilters),
      });
    });

    resetBtn.addEventListener('click', () => {
      userFilters
        .querySelectorAll('input[type="checkbox"]')
        .forEach((input) => {
          input.checked = false;
        });
      typeFilters
        .querySelectorAll('input[type="checkbox"]')
        .forEach((input) => {
          input.checked = false;
        });
      refresh();
    });

    refresh();
  })();`;

  res.send(`<!DOCTYPE html>
  <html lang="ru">
    <head><meta charset="utf-8"><title>Storage test</title></head>
    <body>
      <div id="count"></div>
      <section>
        <fieldset id="user-filters">
          <legend>${ru.storage.filters.user}</legend>
          <label><input type="checkbox" value="1" />${ru.storage.userLabel.replace('{{id}}', '1')}</label>
          <label><input type="checkbox" value="2" />${ru.storage.userLabel.replace('{{id}}', '2')}</label>
        </fieldset>
        <fieldset id="type-filters">
          <legend>${ru.storage.filters.type}</legend>
          <label><input type="checkbox" value="application/pdf" />application/pdf</label>
          <label><input type="checkbox" value="image/jpeg" />image/jpeg</label>
        </fieldset>
        <button id="apply">${ru.find}</button>
        <button id="reset">${ru.reset}</button>
      </section>
      <table>
        <thead>
          <tr>
            <th>${columnTitles.name}</th>
            <th>${columnTitles.user}</th>
            <th>${columnTitles.type}</th>
            <th>${columnTitles.size}</th>
            <th>${columnTitles.task}</th>
            <th>${columnTitles.uploaded}</th>
            <th>actions</th>
          </tr>
        </thead>
        <tbody id="table-body"></tbody>
      </table>
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

test('подтверждает удаление, фильтрует список и отправляет DELETE-запрос', async ({ page }) => {
  await page.goto(`${baseUrl}/cp/storage`);
  await page.getByRole('cell', { name: 'report.pdf' }).waitFor();

  await page
    .locator('#user-filters input[value="1"]')
    .check();
  await page.click('#apply');
  await expect(page.getByText('report.pdf')).toBeVisible();
  await expect(page.getByText('photo.jpg')).not.toBeVisible();

  const messages: string[] = [];
  page.once('dialog', (dialog) => {
    messages.push(dialog.message());
    dialog.accept();
  });

  const requestPromise = page.waitForRequest(
    (request) => request.method() === 'DELETE' && request.url().includes('/api/v1/storage/'),
  );

  await page.getByRole('button', { name: ru.storage.delete }).click();

  const request = await requestPromise;
  expect(request.url()).toContain(encodeURIComponent('64d000000000000000000001'));

  await expect(page.locator('#toast')).toHaveText(ru.storage.deleteSuccess);
  await expect(page.locator('#toast')).toHaveAttribute('data-status', 'success');
  await expect(page.locator('#count')).toHaveText('0');

  expect(messages[0]).toBe(ru.storage.deleteConfirm.replace('{{name}}', 'report.pdf'));
});
