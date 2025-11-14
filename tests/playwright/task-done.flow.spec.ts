/**
 * Назначение файла: проверка inline-клавиатур завершения задачи через Express.
 * Основные модули: @playwright/test, express, taskButtons.
 */
import { test, expect } from '@playwright/test';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import taskStatusKeyboard, {
  taskDoneConfirmKeyboard,
} from '../../apps/api/src/utils/taskButtons';

let server: Server;
let baseUrl = '';

const app = express();
app.get('/tasks/:id/status-keyboard', (req, res) => {
  const keyboard = taskStatusKeyboard(req.params.id);
  res.json(keyboard.reply_markup ?? null);
});
app.get('/tasks/:id/done-confirm', (req, res) => {
  const keyboard = taskDoneConfirmKeyboard(req.params.id);
  res.json(keyboard.reply_markup ?? null);
});

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

test('inline-клавиатура завершения содержит prompt и подтверждение', async ({
  request,
}) => {
  const status = await request.get(`${baseUrl}/tasks/77/status-keyboard`);
  expect(status.ok()).toBeTruthy();
  const statusMarkup = await status.json();
  expect(statusMarkup.inline_keyboard).toEqual(
    expect.arrayContaining([
      expect.arrayContaining([
        expect.objectContaining({ callback_data: 'task_accept_prompt:77' }),
        expect.objectContaining({ callback_data: 'task_done_prompt:77' }),
      ]),
      expect.arrayContaining([
        expect.objectContaining({ callback_data: 'task_history:77' }),
        expect.objectContaining({
          callback_data: 'task_cancel_request_prompt:77',
        }),
      ]),
    ]),
  );

  const confirm = await request.get(`${baseUrl}/tasks/77/done-confirm`);
  expect(confirm.ok()).toBeTruthy();
  const confirmMarkup = await confirm.json();
  expect(confirmMarkup.inline_keyboard).toEqual([
    [
      expect.objectContaining({ callback_data: 'task_done_confirm:77' }),
      expect.objectContaining({ callback_data: 'task_done_cancel:77' }),
    ],
  ]);
});
