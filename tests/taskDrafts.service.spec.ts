/**
 * Назначение файла: проверяет работу TaskDraftsService с вложениями.
 * Основные модули: TaskDraftsService, jest моки моделей.
 */
import { Types } from 'mongoose';

const updateManyMock = jest.fn(() => ({
  exec: jest.fn().mockResolvedValue({}),
}));
const findMock = jest.fn(() => ({
  select: jest.fn(() => ({
    lean: jest.fn().mockResolvedValue([]),
  })),
}));
const updateOneMock = jest.fn(() => ({
  exec: jest.fn().mockResolvedValue({}),
}));

jest.mock('../apps/api/src/db/model', () => {
  const draftId = new Types.ObjectId();
  return {
    __esModule: true,
    TaskDraft: {
      findOne: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue(null),
      })),
      findOneAndUpdate: jest.fn((filter, update) => ({
        exec: jest.fn().mockResolvedValue({
          _id: draftId,
          userId: filter.userId,
          kind: filter.kind,
          payload: update?.$set?.payload ?? {},
          attachments: update?.$set?.attachments ?? [],
          toObject() {
            return {
              _id: this._id,
              userId: this.userId,
              kind: this.kind,
              payload: this.payload,
              attachments: this.attachments,
            };
          },
        }),
      })),
      findOneAndDelete: jest.fn(() => ({
        exec: jest.fn().mockResolvedValue({
          attachments: [],
        }),
      })),
    },
    File: {
      updateMany: updateManyMock,
      find: findMock,
      updateOne: updateOneMock,
    },
  };
});

jest.mock('../apps/api/src/services/dataStorage', () => ({
  deleteFile: jest.fn(),
}));

jest.mock('../apps/api/src/services/wgLogEngine', () => ({
  writeLog: jest.fn(),
}));

const { deleteFile } = jest.requireMock(
  '../apps/api/src/services/dataStorage',
) as {
  deleteFile: jest.Mock;
};
const models = jest.requireMock('../apps/api/src/db/model') as {
  File: { updateMany: jest.Mock; find: jest.Mock; updateOne: jest.Mock };
  TaskDraft: { findOneAndDelete: jest.Mock };
};

let TaskDraftsService: typeof import('../apps/api/src/taskDrafts/taskDrafts.service').default;

beforeAll(async () => {
  ({ default: TaskDraftsService } = await import(
    '../apps/api/src/taskDrafts/taskDrafts.service'
  ));
});

describe('TaskDraftsService — вложения черновиков', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findMock.mockImplementation(() => ({
      select: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue([]),
      })),
    }));
    models.TaskDraft.findOneAndDelete.mockImplementation(() => ({
      exec: jest.fn().mockResolvedValue({
        attachments: [],
      }),
    }));
  });

  it('не снимает привязку taskId при сохранении черновика', async () => {
    const service = new TaskDraftsService();
    const fileId = new Types.ObjectId();
    const payload = {
      attachments: [
        {
          name: 'документ',
          url: `/api/v1/files/${fileId.toHexString()}`,
          type: 'application/pdf',
          size: 1024,
        },
      ],
    };

    await service.saveDraft(42, 'task', payload);

    expect(updateManyMock).toHaveBeenCalledTimes(1);
    const callArgs = updateManyMock.mock.calls[0] ?? [];
    const update = (callArgs as unknown[])[1] as
      | Record<string, unknown>
      | undefined;
    expect(update?.$set).toMatchObject({ draftId: expect.any(Types.ObjectId) });
    expect(update?.$unset).toBeUndefined();
  });

  it('не удаляет файл, связанный с задачей, при очистке черновика', async () => {
    const service = new TaskDraftsService();
    const linkedId = new Types.ObjectId();
    models.TaskDraft.findOneAndDelete.mockImplementation(() => ({
      exec: jest.fn().mockResolvedValue({
        attachments: [
          {
            name: 'скан',
            url: `/api/v1/files/${linkedId.toHexString()}`,
            type: 'image/png',
            size: 2048,
          },
        ],
      }),
    }));
    findMock.mockImplementation(() => ({
      select: jest.fn(() => ({
        lean: jest
          .fn()
          .mockResolvedValue([{ _id: linkedId, taskId: new Types.ObjectId() }]),
      })),
    }));

    await service.deleteDraft(7, 'task');

    expect(deleteFile).not.toHaveBeenCalled();
    expect(updateOneMock).toHaveBeenCalledWith(
      { _id: linkedId },
      { $unset: { draftId: '' } },
    );
  });
});
