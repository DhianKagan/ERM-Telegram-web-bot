// Назначение: тест обработчика processUploads на удаление несуществующего файла. Модули: jest.
import type { NextFunction, Request, Response } from 'express';

jest.mock('../src/db/model', () => ({
  File: { aggregate: jest.fn(async () => []), create: jest.fn() },
}));

const unlinkSpy = jest
  .spyOn(require('fs').promises, 'unlink')
  .mockRejectedValue(new Error('ENOENT'));

jest.mock('../src/services/antivirus', () => ({
  scanFile: jest.fn(async () => false),
}));

const mockWriteLog = jest.fn(async () => {});
jest.mock('../src/services/wgLogEngine', () => ({ writeLog: mockWriteLog }));

const { processUploads } = require('../src/routes/tasks');

test('возвращает 500 если файл нельзя удалить', async () => {
  const req = {
    files: [
      {
        destination: '/tmp',
        filename: 'nope',
        originalname: 'nope',
        mimetype: 'text/plain',
        size: 1,
      },
    ],
    user: { id: 1 },
    body: {},
  } as unknown as Request & {
    files: Array<{
      destination: string;
      filename: string;
      originalname: string;
      mimetype: string;
      size: number;
    }>;
    user: { id: number };
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    sendStatus: jest.fn(),
  } as unknown as Response;
  const next: NextFunction = jest.fn();
  await processUploads(req, res, next);
  expect(mockWriteLog).toHaveBeenCalled();
  expect(res.sendStatus).toHaveBeenCalledWith(500);
  expect(next).not.toHaveBeenCalled();
  unlinkSpy.mockRestore();
});
