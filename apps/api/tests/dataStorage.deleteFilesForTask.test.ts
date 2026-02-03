// Назначение: тесты очистки ссылок на файлы при удалении задачи. Модули: jest.
import path from 'path';

process.env.STORAGE_DIR = path.resolve(__dirname, '../uploads');

const mockFileFind = jest.fn();
const mockFileDeleteMany = jest.fn(() => ({
  exec: jest.fn().mockResolvedValue(undefined),
}));
const mockTaskFind = jest.fn();
const mockTaskBulkWrite = jest.fn().mockResolvedValue(undefined);

jest.mock('fs', () => ({
  promises: {
    unlink: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../src/db/model', () => ({
  File: {
    find: (...args: unknown[]) => mockFileFind(...args),
    deleteMany: (...args: unknown[]) => mockFileDeleteMany(...args),
  },
  Task: {
    find: (...args: unknown[]) => mockTaskFind(...args),
    bulkWrite: (...args: unknown[]) => mockTaskBulkWrite(...args),
  },
}));

describe('deleteFilesForTask', () => {
  beforeEach(() => {
    mockFileFind.mockReset();
    mockFileDeleteMany.mockClear();
    mockTaskFind.mockReset();
    mockTaskBulkWrite.mockClear();
  });

  test('удаляет ссылки на файлы из задач перед чисткой файлов', async () => {
    const fileId1 = '64d000000000000000000001';
    const fileId2 = '64d000000000000000000002';
    const keepId = '64d000000000000000000099';
    const taskId = '64d0000000000000000000aa';

    mockFileFind.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { _id: fileId1, path: 'files/a.txt', thumbnailPath: 'thumbs/a.png' },
        { _id: fileId2, path: 'files/b.txt', thumbnailPath: null },
      ]),
    });

    const taskQuery = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        {
          _id: taskId,
          attachments: [
            { url: `/api/v1/files/${fileId1}`, name: 'delete-me' },
            { url: `/api/v1/files/${keepId}`, name: 'keep' },
          ],
          files: [
            `/api/v1/files/${fileId2}?mode=inline`,
            `/api/v1/files/${keepId}`,
          ],
        },
      ]),
    };
    mockTaskFind.mockReturnValue(taskQuery);

    const { deleteFilesForTask } = await import('../src/services/dataStorage');

    await deleteFilesForTask(taskId);

    expect(mockTaskBulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: { _id: taskId },
          update: {
            $set: {
              attachments: [{ url: `/api/v1/files/${keepId}`, name: 'keep' }],
              files: [`/api/v1/files/${keepId}`],
            },
          },
        },
      },
    ]);
    expect(mockFileDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: { $in: [fileId1, fileId2] },
      }),
    );
  });
});
