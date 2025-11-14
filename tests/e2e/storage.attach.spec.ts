/**
 * Назначение файла: e2e-тест привязки файла к задаче и обработки ошибок доступа.
 * Основные модули: @playwright/test, express.
 */
import { test, expect } from '@playwright/test';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import ru from '../../apps/web/src/locales/ru/translation.json';

type FileInfo = {
  id: string;
  name: string;
  taskId?: string | null;
  taskNumber?: string | null;
  userId: number;
};

type TaskInfo = {
  _id: string;
  task_number: string;
  title: string;
  changed_at: string;
};

const initialFiles: FileInfo[] = [
  {
    id: '64d000000000000000000001',
    name: 'invoice.pdf',
    taskId: null,
    taskNumber: null,
    userId: 1,
  },
  {
    id: '64d000000000000000000002',
    name: 'photo.jpg',
    taskId: null,
    taskNumber: null,
    userId: 1,
  },
];

const tasks: TaskInfo[] = [
  {
    _id: '64d0000000000000000000aa',
    task_number: 'T-1',
    title: 'Доставка документов',
    changed_at: '2024-05-01T10:00:00.000Z',
  },
  {
    _id: '64d0000000000000000000ab',
    task_number: 'T-2',
    title: 'Закупка расходников',
    changed_at: '2024-04-30T12:00:00.000Z',
  },
];

const files: FileInfo[] = [];

const app = express();
app.use(express.json());

app.get('/api/v1/storage', (_req, res) => {
  res.json(files);
});

app.get('/api/v1/tasks/mentioned', (_req, res) => {
  res.json(tasks);
});

app.post('/api/v1/files/:id/attach', (req, res) => {
  const file = files.find((entry) => entry.id === req.params.id);
  if (!file) {
    res.sendStatus(404);
    return;
  }
  if (file.id === '64d000000000000000000002') {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  file.taskId = req.body.taskId;
  const task = tasks.find((t) => t._id === req.body.taskId);
  file.taskNumber = task?.task_number ?? null;
  res.json({ ok: true, taskId: req.body.taskId });
});

app.get('/cp/storage', (_req, res) => {
  const attach = (ru as any).storage.attach;
  const taskLabel = (ru as any).storage.taskLabel as string;
  const taskNumberLabel = (ru as any).storage.taskNumberLabel as string;
  const taskMissing = (ru as any).storage.taskMissing as string;
  const success = attach.success as string;
  const error = attach.forbidden as string;
  const loadTasksError = attach.tasksLoadError as string;
  const buttonLabel = attach.button as string;
  const placeholder = attach.placeholder as string;

  const script = `(() => {
    const rowsContainer = document.getElementById('rows');
    const toast = document.getElementById('toast');
    let tasks = [];

    function formatTask(file) {
      if (file.taskNumber) {
        return ${JSON.stringify(taskNumberLabel)}.replace('{{number}}', file.taskNumber);
      }
      if (file.taskId) {
        return ${JSON.stringify(taskLabel)}.replace('{{id}}', file.taskId);
      }
      return ${JSON.stringify(taskMissing)};
    }

    function render(files) {
      rowsContainer.innerHTML = '';
      files.forEach((file) => {
        const row = document.createElement('div');
        row.dataset.rowId = file.id;
        row.className = 'row';
        const name = document.createElement('span');
        name.textContent = file.name;
        const taskCell = document.createElement('span');
        taskCell.className = 'task';
        taskCell.textContent = formatTask(file);
        const select = document.createElement('select');
        select.id = 'task-select-' + file.id;
        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = ${JSON.stringify(placeholder)};
        select.appendChild(placeholderOption);
        tasks.forEach((task) => {
          const option = document.createElement('option');
          option.value = task._id;
          const number = task.task_number ? String(task.task_number) : '';
          const title = task.title ? String(task.title) : '';
          option.textContent = number ? number + ' — ' + title : title;
          select.appendChild(option);
        });
        const button = document.createElement('button');
        button.id = 'attach-' + file.id;
        button.textContent = ${JSON.stringify(buttonLabel)};
        button.addEventListener('click', async () => {
          const taskId = select.value;
          if (!taskId) return;
          try {
            const res = await fetch('/api/v1/files/' + file.id + '/attach', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ taskId }),
            });
            if (!res.ok) throw res;
            const payload = await res.json();
            file.taskId = payload.taskId;
            const found = tasks.find((t) => t._id === payload.taskId);
            file.taskNumber = found ? found.task_number : null;
            taskCell.textContent = formatTask(file);
            toast.textContent = ${JSON.stringify(success)};
            toast.dataset.status = 'success';
          } catch (err) {
            toast.textContent = ${JSON.stringify(error)};
            toast.dataset.status = 'error';
          }
        });
        row.appendChild(name);
        row.appendChild(taskCell);
        row.appendChild(select);
        row.appendChild(button);
        rowsContainer.appendChild(row);
      });
    }

    fetch('/api/v1/tasks/mentioned')
      .then((res) => res.json())
      .then((list) => {
        tasks = Array.isArray(list) ? list : [];
        return fetch('/api/v1/storage');
      })
      .then((res) => res.json())
      .then((files) => {
        render(Array.isArray(files) ? files : []);
      })
      .catch(() => {
        toast.textContent = ${JSON.stringify(loadTasksError)};
        toast.dataset.status = 'error';
      });
  })();`;

  res.send(`<!DOCTYPE html>
  <html lang="ru">
    <head>
      <meta charset="utf-8" />
      <title>Storage attach test</title>
      <style>
        .row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 8px; align-items: center; }
        select { padding: 4px; }
        button { padding: 4px 8px; }
      </style>
    </head>
    <body>
      <div id="rows"></div>
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
      baseUrl = `http://127.0.0.1:${port}`;
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

test('привязывает файл к задаче и показывает ошибку при запрете', async ({
  page,
}) => {
  await page.goto(`${baseUrl}/cp/storage`);
  await page.waitForSelector(`[data-row-id="${initialFiles[0].id}"]`);

  await page.selectOption(`#task-select-${initialFiles[0].id}`, tasks[0]._id);
  const requestPromise = page.waitForRequest(
    (req) => req.method() === 'POST' && req.url().includes(initialFiles[0].id),
  );
  await page.click(`#attach-${initialFiles[0].id}`);
  const request = await requestPromise;
  expect(request.postDataJSON()).toEqual({ taskId: tasks[0]._id });
  await expect(page.locator('#toast')).toHaveText(ru.storage.attach.success);
  await expect(page.locator('#toast')).toHaveAttribute(
    'data-status',
    'success',
  );
  await expect(
    page.locator(`[data-row-id="${initialFiles[0].id}"] .task`),
  ).toHaveText(
    ru.storage.taskNumberLabel.replace('{{number}}', tasks[0].task_number),
  );

  await page.selectOption(`#task-select-${initialFiles[1].id}`, tasks[0]._id);
  await page.click(`#attach-${initialFiles[1].id}`);
  await expect(page.locator('#toast')).toHaveText(ru.storage.attach.forbidden);
  await expect(page.locator('#toast')).toHaveAttribute('data-status', 'error');
});
