/**
 * Назначение файла: проверяет диагностику файлового хранилища через моковую модель файлов.
 * Основные модули: jest, StorageDiagnosticsService.
 */
import 'reflect-metadata';
import { Types } from 'mongoose';

import StorageDiagnosticsService from '../apps/api/src/services/storageDiagnostics.service';

type CollectAttachmentLinksMock = jest.MockedFunction<
  typeof import('../apps/api/src/services/dataStorage').collectAttachmentLinks
>;
type GetFileSyncSnapshotMock = jest.MockedFunction<
  typeof import('../apps/api/src/services/dataStorage').getFileSyncSnapshot
>;

type FileDoc = {
  _id: Types.ObjectId;
  taskId?: Types.ObjectId | null;
  name: string;
  path: string;
  size: number;
  uploadedAt: Date;
  userId: number;
};

type FileModelMock = {
  find: jest.Mock;
  updateOne: jest.Mock;
};

jest.mock('../apps/api/src/services/dataStorage', () => ({
  collectAttachmentLinks: jest.fn(),
  getFileSyncSnapshot: jest.fn(),
  deleteFile: jest.fn(),
}));

describe('StorageDiagnosticsService', () => {
  const dataStorageMocks = jest.requireMock(
    '../apps/api/src/services/dataStorage',
  ) as {
    collectAttachmentLinks: CollectAttachmentLinksMock;
    getFileSyncSnapshot: GetFileSyncSnapshotMock;
  };

  const linkedTaskId = new Types.ObjectId();
  const existingTaskId = new Types.ObjectId();
  const fallbackFileId = new Types.ObjectId();
  const detachedFileId = new Types.ObjectId();
  const linkedFileId = new Types.ObjectId();

  const createDocs = (): FileDoc[] => [
    {
      _id: fallbackFileId,
      taskId: null,
      name: 'паспорт.pdf',
      path: 'uploads/passport.pdf',
      size: 256,
      uploadedAt: new Date('2024-02-01T00:00:00Z'),
      userId: 7,
    },
    {
      _id: detachedFileId,
      taskId: null,
      name: 'разорванный.docx',
      path: 'uploads/detached.docx',
      size: 1024,
      uploadedAt: new Date('2024-02-02T00:00:00Z'),
      userId: 8,
    },
    {
      _id: linkedFileId,
      taskId: existingTaskId,
      name: 'отчёт.xlsx',
      path: 'uploads/report.xlsx',
      size: 2048,
      uploadedAt: new Date('2024-02-03T00:00:00Z'),
      userId: 9,
    },
  ];

  const buildFileModel = (docs: FileDoc[]): FileModelMock => {
    const find = jest.fn((filter: unknown) => {
      const applyFilter = () => {
        if (
          filter &&
          typeof filter === 'object' &&
          '$or' in (filter as Record<string, unknown>)
        ) {
          return docs.filter((doc) => !doc.taskId);
        }
        return docs.slice();
      };
      const selectedDocs = applyFilter();
      const select = jest.fn((fields: string[]) => {
        const fieldSet = new Set(fields);
        const lean = jest.fn(async () =>
          selectedDocs.map((doc) => {
            const result: Record<string, unknown> = {};
            fieldSet.forEach((field) => {
              result[field] = (doc as Record<string, unknown>)[field];
            });
            return result;
          }),
        );
        return { lean };
      });
      return { select };
    });

    const updateOne = jest.fn(
      (
        filter: { _id: string | Types.ObjectId },
        update: { $set?: { taskId?: Types.ObjectId } },
      ) => {
        const filterId =
          typeof filter._id === 'string'
            ? new Types.ObjectId(filter._id)
            : filter._id;
        const target = docs.find((doc) => doc._id.equals(filterId));
        if (target && update?.$set?.taskId) {
          target.taskId = update.$set.taskId;
        }
        return { exec: jest.fn().mockResolvedValue({}) };
      },
    );

    return { find, updateOne };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('уменьшает количество несвязанных файлов после восстановления привязок', async () => {
    const docs = createDocs();
    const fileModel = buildFileModel(docs);

    dataStorageMocks.collectAttachmentLinks.mockImplementation(
      async (candidates) => {
        const map = new Map<
          string,
          { taskId: string; number?: string; title?: string }
        >();
        candidates.forEach((candidate) => {
          if (
            candidate.id === fallbackFileId.toHexString() &&
            !candidate.hasTask
          ) {
            map.set(candidate.id, {
              taskId: linkedTaskId.toHexString(),
              number: 'ERM-1',
              title: 'Задача с вложением',
            });
          }
        });
        return map;
      },
    );

    dataStorageMocks.getFileSyncSnapshot.mockImplementation(async () => {
      const totalFiles = docs.length;
      const linkedFiles = docs.filter((doc) => doc.taskId).length;
      return {
        totalFiles,
        linkedFiles,
        detachedFiles: Math.max(totalFiles - linkedFiles, 0),
      };
    });

    const service = new StorageDiagnosticsService(fileModel as unknown as any);
    const report = await service.diagnose();

    expect(report.snapshot).toEqual(
      expect.objectContaining({
        totalFiles: 3,
        linkedFiles: 2,
        detachedFiles: 1,
      }),
    );
    expect(report.detachedFiles).toHaveLength(1);
    expect(report.detachedFiles[0]?.id).toBe(detachedFileId.toHexString());
    expect(dataStorageMocks.collectAttachmentLinks).toHaveBeenCalledTimes(1);
    expect(fileModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: expect.any(Types.ObjectId) }),
      { $set: { taskId: linkedTaskId } },
    );
    const [updateFilter] = fileModel.updateOne.mock.calls[0] ?? [];
    const appliedId = (updateFilter as { _id: Types.ObjectId })._id;
    expect(appliedId.equals(fallbackFileId)).toBe(true);

    const followUp = await service.diagnose();
    expect(followUp.snapshot.detachedFiles).toBe(1);
    expect(followUp.detachedFiles).toHaveLength(1);
    expect(dataStorageMocks.collectAttachmentLinks).toHaveBeenCalledTimes(2);
  });
});
