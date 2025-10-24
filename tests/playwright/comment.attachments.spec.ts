/**
 * Назначение файла: e2e-тест присвоения taskId файлам после инлайн-загрузки.
 * Основные модули: @playwright/test, express, utils/attachments.
 */
import { test, expect } from '@playwright/test';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import type { Attachment } from '../../apps/api/src/db/model';
import {
  buildAttachmentsFromCommentHtml,
  extractAttachmentIds,
} from '../../apps/api/src/utils/attachments';

interface StoredFile {
  id: string;
  name: string;
  taskId?: string;
}

const files = new Map<string, StoredFile>();
let storedAttachments: Attachment[] = [];

const app = express();
app.use(express.json());

app.post('/bot/comment', (req, res) => {
  const { commentHtml, taskId } = req.body as {
    commentHtml: string;
    taskId: string;
  };
  storedAttachments = buildAttachmentsFromCommentHtml(commentHtml, {
    existing: storedAttachments,
  });
  const assigned: string[] = [];
  const attachmentIds = extractAttachmentIds(storedAttachments);
  attachmentIds.forEach((objectId) => {
    const fileId = objectId.toHexString();
    const file = files.get(fileId);
    if (file) {
      file.taskId = taskId;
      assigned.push(fileId);
    }
  });
  res.json({
    ok: true,
    attachments: storedAttachments.map((item) => ({ url: item.url })),
    assigned,
    files: Array.from(files.values()),
  });
});

let server: Server;
let baseUrl: string;

test.beforeAll(() => {
  server = app.listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(() => {
  server.close();
});

test.beforeEach(() => {
  files.clear();
  storedAttachments = [];
});

test.describe('Инлайн-загрузка файла через комментарий', () => {
  test('назначает taskId файлу после обработки комментария', async ({ request }) => {
    const fileId = '64d0a9f5a5b4c6d7e8f90123';
    const taskId = 'T-1024';
    files.set(fileId, { id: fileId, name: 'inline.png' });
    const commentHtml = `<p><strong>Инженер</strong><br>Файл: https://demo.local/api/v1/files/${fileId}?mode=inline&amp;preview=1</p>`;

    const firstResponse = await request.post(`${baseUrl}/bot/comment`, {
      data: { commentHtml, taskId },
    });

    expect(firstResponse.ok()).toBeTruthy();
    const firstBody = await firstResponse.json();
    expect(firstBody.attachments).toEqual([
      { url: `/api/v1/files/${fileId}` },
    ]);
    expect(firstBody.assigned).toContain(fileId);
    const stored = firstBody.files.find((entry: StoredFile) => entry.id === fileId);
    expect(stored?.taskId).toBe(taskId);

    const secondResponse = await request.post(`${baseUrl}/bot/comment`, {
      data: { commentHtml, taskId },
    });

    expect(secondResponse.ok()).toBeTruthy();
    const secondBody = await secondResponse.json();
    expect(secondBody.attachments).toEqual([
      { url: `/api/v1/files/${fileId}` },
    ]);
    expect(secondBody.assigned).toContain(fileId);
  });
});
