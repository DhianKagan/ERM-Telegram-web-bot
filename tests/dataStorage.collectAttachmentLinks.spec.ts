/**
 * Назначение файла: проверяет повторную привязку файлов через collectAttachmentLinks без обращения к БД.
 * Основные модули: jest, collectAttachmentLinks.
 */
import { Types } from 'mongoose';

import type { Attachment } from '../apps/api/src/db/model';

process.env.MONGO_DATABASE_URL ||= 'mongodb://127.0.0.1:27017/ermdb';

type TaskModelMock = {
  find: jest.Mock;
};

type CollectAttachmentLinksFn = typeof import('../apps/api/src/services/dataStorage').collectAttachmentLinks;

jest.mock('../apps/api/src/db/model', () => {
  const { Types } = jest.requireActual('mongoose');
  return {
    __esModule: true,
    Task: {
      find: jest.fn(),
    },
    File: {
      updateOne: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
    },
    Types,
  } as { Task: TaskModelMock };
});

describe('collectAttachmentLinks', () => {
  let collectAttachmentLinks: CollectAttachmentLinksFn;
  let TaskModel: TaskModelMock;

  beforeAll(async () => {
    ({ collectAttachmentLinks } = await import('../apps/api/src/services/dataStorage'));
    const mockedModels = (await import('../apps/api/src/db/model')) as unknown as {
      Task: TaskModelMock;
    };
    ({ Task: TaskModel } = mockedModels);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('возвращает карту привязок и повторный вызов пропускает обновлённые документы', async () => {
    const fileId = new Types.ObjectId().toHexString();
    const taskId = new Types.ObjectId();
    const attachments: Attachment[] = [
      {
        name: 'паспорт',
        url: `/api/v1/files/${fileId}`,
        uploadedBy: 42,
        uploadedAt: new Date('2024-01-01T00:00:00Z'),
        type: 'application/pdf',
        size: 512,
      },
    ];

    const leanMock = jest.fn().mockResolvedValue([
      {
        _id: taskId,
        task_number: 'ERM-1',
        title: 'Задача с вложением',
        attachments,
      },
    ]);
    const selectMock = jest.fn().mockReturnValue({ lean: leanMock });
    TaskModel.find.mockReturnValue({ select: selectMock });

    const initialCandidates = [{ id: fileId, hasTask: false }];

    const firstLookup = await collectAttachmentLinks(initialCandidates);

    expect(TaskModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: [
          {
            'attachments.url': expect.objectContaining({
              $regex: expect.any(RegExp),
            }),
          },
        ],
      }),
    );
    const fallback = firstLookup.get(fileId);
    expect(fallback).toEqual(
      expect.objectContaining({
        taskId: taskId.toHexString(),
        number: 'ERM-1',
        title: 'Задача с вложением',
      }),
    );

    const updatedCandidates = [{ id: fileId, hasTask: true }];
    const secondLookup = await collectAttachmentLinks(updatedCandidates);

    expect(secondLookup.size).toBe(0);
    expect(TaskModel.find).toHaveBeenCalledTimes(1);
  });
});
