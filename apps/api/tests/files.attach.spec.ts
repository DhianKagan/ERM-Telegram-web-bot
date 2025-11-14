// Назначение: unit-тесты роута привязки файлов к задачам. Модули: jest, supertest, express.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 's';
process.env.APP_URL = 'https://localhost';

import express from 'express';
import request from 'supertest';

jest.mock(
  '../src/middleware/auth',
  () => () => (req: any, _res: any, next: () => void) => {
    req.user = { id: 1, access: 1 };
    next();
  },
);

jest.mock('../src/db/model', () => ({
  File: { findById: jest.fn() },
  Task: {
    findById: jest.fn(),
    updateOne: jest.fn(),
    updateMany: jest.fn(() => ({
      exec: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));

jest.mock('../src/db/queries', () => ({
  syncTaskAttachments: jest.fn(),
}));

const { File, Task } = require('../src/db/model');
const { syncTaskAttachments } = require('../src/db/queries');
const router = require('../src/routes/files').default;

describe('POST /api/v1/files/:id/attach', () => {
  const app = express();
  app.use(express.json());
  app.use(router);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('привязывает собственный файл к задаче и синхронизирует вложения', async () => {
    const fileId = '64d000000000000000000001';
    const taskId = '64d0000000000000000000aa';
    const uploadedAt = new Date('2024-01-01T00:00:00.000Z');

    (File.findById as jest.Mock).mockReturnValue({
      lean: () =>
        Promise.resolve({
          _id: fileId,
          userId: 1,
          name: 'invoice.pdf',
          type: 'application/pdf',
          size: 2048,
          uploadedAt,
          thumbnailPath: 'thumbs/invoice.jpg',
        }),
    });

    (Task.findById as jest.Mock).mockReturnValue({
      lean: () =>
        Promise.resolve({
          _id: taskId,
          attachments: [],
          created_by: 1,
        }),
    });

    (Task.updateOne as jest.Mock).mockResolvedValue(undefined);
    (syncTaskAttachments as jest.Mock).mockResolvedValue(undefined);

    const response = await request(app)
      .post(`/${fileId}/attach`)
      .send({ taskId })
      .expect(200);

    expect(response.body).toEqual({ ok: true, taskId });
    expect(Task.updateOne).toHaveBeenCalledWith(
      { _id: taskId },
      {
        $set: {
          attachments: [
            {
              name: 'invoice.pdf',
              url: `/api/v1/files/${fileId}`,
              thumbnailUrl: '/uploads/thumbs/invoice.jpg',
              uploadedBy: 1,
              uploadedAt,
              type: 'application/pdf',
              size: 2048,
            },
          ],
        },
      },
    );
    expect(syncTaskAttachments).toHaveBeenCalledWith(
      taskId,
      expect.any(Array),
      1,
    );
  });

  it('отклоняет привязку чужого файла', async () => {
    (File.findById as jest.Mock).mockReturnValue({
      lean: () =>
        Promise.resolve({
          _id: '64d000000000000000000002',
          userId: 42,
          name: 'foreign.txt',
          type: 'text/plain',
          size: 100,
          uploadedAt: new Date(),
        }),
    });

    await request(app)
      .post('/64d000000000000000000002/attach')
      .send({ taskId: '64d0000000000000000000bb' })
      .expect(403);

    expect(Task.findById).not.toHaveBeenCalled();
    expect(Task.updateOne).not.toHaveBeenCalled();
    expect(syncTaskAttachments).not.toHaveBeenCalled();
  });

  it('возвращает 404, если задача не найдена', async () => {
    (File.findById as jest.Mock).mockReturnValue({
      lean: () =>
        Promise.resolve({
          _id: '64d000000000000000000003',
          userId: 1,
          name: 'report.docx',
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size: 512,
          uploadedAt: new Date(),
        }),
    });

    (Task.findById as jest.Mock).mockReturnValue({
      lean: () => Promise.resolve(null),
    });

    await request(app)
      .post('/64d000000000000000000003/attach')
      .send({ taskId: '64d0000000000000000000cc' })
      .expect(404);

    expect(Task.updateOne).not.toHaveBeenCalled();
    expect(syncTaskAttachments).not.toHaveBeenCalled();
  });

  it('проверяет обязательность taskId', async () => {
    await request(app)
      .post('/64d000000000000000000004/attach')
      .send({})
      .expect(400);
  });
});
