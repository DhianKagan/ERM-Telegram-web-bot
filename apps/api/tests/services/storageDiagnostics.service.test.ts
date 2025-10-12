// Назначение: тесты диагностики хранилища StorageDiagnosticsService
// Основные модули: fs, os, path, storageDiagnostics.service
import 'reflect-metadata';
import fs from 'fs';
import os from 'os';
import path from 'path';
import StorageDiagnosticsService from '../../src/storage/storageDiagnostics.service';

type FileDoc = {
  _id: string;
  path?: string | null;
  userId?: number;
};

type TaskDoc = {
  _id: string;
  attachments?: Array<{ url?: string | null }>;
  files?: string[];
  task_number?: string;
  title?: string;
};

describe('StorageDiagnosticsService', () => {
  let tmpDir: string;
  let files: FileDoc[];
  let tasks: TaskDoc[];
  let service: StorageDiagnosticsService;

  const missingId = '64d000000000000000000001';
  const duplicateA = '64d000000000000000000002';
  const duplicateB = '64d000000000000000000003';
  const presentId = '64d000000000000000000004';
  const staleId = '64d000000000000000000099';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-diag-'));
    const existingDir = path.join(tmpDir, 'existing');
    fs.mkdirSync(existingDir, { recursive: true });
    fs.writeFileSync(path.join(existingDir, 'keep.txt'), 'ok');
    fs.writeFileSync(path.join(tmpDir, 'orphan.bin'), 'ghost');

    files = [
      { _id: missingId, path: 'missing.txt', userId: 1 },
      { _id: duplicateA, path: 'existing/keep.txt', userId: 2 },
      { _id: duplicateB, path: 'existing/keep.txt', userId: 3 },
      { _id: presentId, path: 'existing/keep.txt', userId: 4 },
    ];

    tasks = [
      {
        _id: '74d000000000000000000111',
        attachments: [
          { url: `/api/v1/files/${missingId}` },
          { url: `/api/v1/files/${staleId}` },
        ],
        files: [`/api/v1/files/${duplicateA}`],
        task_number: 'REQ-42',
        title: 'Проверка',
      },
    ];

    const fileModel = createFileModel(files);
    const taskModel = createTaskModel(tasks);
    service = new StorageDiagnosticsService(
      tmpDir,
      fileModel as any,
      taskModel as any,
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('runDiagnostics обнаруживает типовые проблемы', async () => {
    const report = await service.runDiagnostics();
    expect(report.summary.missing_on_disk).toBe(1);
    expect(report.summary.orphan_on_disk).toBe(1);
    expect(report.summary.duplicate_entry).toBe(1);
    expect(report.summary.stale_task_link).toBe(1);
    expect(report.recommendedFixes).toEqual(
      expect.arrayContaining([
        { type: 'remove_file_entry', fileId: missingId },
        { type: 'delete_disk_file', path: 'orphan.bin' },
        { type: 'remove_file_entry', fileId: duplicateB },
        {
          type: 'unlink_task_reference',
          taskId: tasks[0]._id,
          attachmentUrl: `/api/v1/files/${staleId}`,
        },
      ]),
    );
  });

  test('applyFixes удаляет записи и очищает задачи', async () => {
    const initial = await service.runDiagnostics();
    const result = await service.applyFixes(initial.recommendedFixes);
    expect(result.errors).toHaveLength(0);
    expect(files.find((item) => item._id === missingId)).toBeUndefined();
    expect(fs.existsSync(path.join(tmpDir, 'orphan.bin'))).toBe(false);
    expect(
      tasks[0].attachments?.some(
        (attachment) => attachment?.url === `/api/v1/files/${staleId}`,
      ),
    ).toBe(false);
  });
});

function createFileModel(data: FileDoc[]) {
  return {
    find: jest.fn(() => ({
      lean: async () => clone(data),
    })),
    findById: jest.fn((id: string) => ({
      lean: async () => clone(data.find((doc) => doc._id === id) ?? null),
    })),
    deleteOne: jest.fn((filter: { _id: string }) => ({
      exec: async () => {
        const index = data.findIndex((doc) => doc._id === filter._id);
        if (index >= 0) data.splice(index, 1);
        return { acknowledged: true };
      },
    })),
  };
}

function createTaskModel(data: TaskDoc[]) {
  return {
    find: jest.fn(() => ({
      lean: async () => clone(data),
    })),
    updateMany: jest.fn((filter: any, update: any) => ({
      exec: async () => {
        filterTasks(data, filter).forEach((task) => applyUpdate(task, update));
      },
    })),
    updateOne: jest.fn((filter: any, update: any) => ({
      exec: async () => {
        const [task] = filterTasks(data, filter);
        if (task) applyUpdate(task, update);
      },
    })),
  };
}

function filterTasks(tasks: TaskDoc[], filter: any): TaskDoc[] {
  if (!filter || Object.keys(filter).length === 0) {
    return tasks;
  }
  if (filter._id) {
    return tasks.filter((task) => task._id === filter._id);
  }
  if (Array.isArray(filter.$or)) {
    return tasks.filter((task) =>
      filter.$or.some((entry: any) => matchesCondition(task, entry)),
    );
  }
  return tasks;
}

function matchesCondition(task: TaskDoc, entry: any): boolean {
  if (entry['attachments.url'] && entry['attachments.url'].$in) {
    const urls: string[] = entry['attachments.url'].$in;
    return (
      task.attachments?.some((attachment) =>
        attachment?.url ? urls.includes(attachment.url) : false,
      ) ?? false
    );
  }
  if (entry.files && entry.files.$in) {
    const urls: string[] = entry.files.$in;
    return task.files?.some((item) => urls.includes(item)) ?? false;
  }
  return false;
}

function applyUpdate(task: TaskDoc, update: any): void {
  if (!update || typeof update !== 'object') return;
  if (update.$pull?.attachments?.url) {
    const target: string = update.$pull.attachments.url;
    task.attachments = (task.attachments || []).filter(
      (attachment) => attachment?.url !== target,
    );
  }
  if (update.$pull?.files) {
    const value: string = update.$pull.files;
    task.files = (task.files || []).filter((item) => item !== value);
  }
}

function clone<T>(value: T): T {
  return value === null ? value : JSON.parse(JSON.stringify(value));
}
