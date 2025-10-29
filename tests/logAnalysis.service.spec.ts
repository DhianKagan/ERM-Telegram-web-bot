/**
 * Назначение файла: unit-тесты LogAnalysisService.
 * Основные модули: LogAnalysisService, jest мок node:fs/promises.
 */
import path from 'node:path';
import type { Dirent } from 'node:fs';
import LogAnalysisService from '../apps/api/src/system/logAnalysis.service';
import fs from 'node:fs/promises';

jest.mock('tsyringe', () => ({
  injectable: () => (target: unknown) => target,
}));

jest.mock('node:fs/promises', () => ({
  readdir: jest.fn(),
  stat: jest.fn(),
  readFile: jest.fn(),
}));

const mockedFs = fs as jest.Mocked<typeof fs>;

const createDirent = (name: string, file: boolean): Dirent =>
  ({
    name,
    isFile: () => file,
  } as unknown as Dirent);

describe('LogAnalysisService', () => {
  let service: LogAnalysisService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LogAnalysisService();
  });

  test('возвращает null если каталог анализа отсутствует', async () => {
    const error = Object.assign(new Error('not found'), { code: 'ENOENT' });
    mockedFs.readdir.mockRejectedValueOnce(error);
    await expect(service.getLatestSummary()).resolves.toBeNull();
  });

  test('возвращает null если нет JSON отчётов', async () => {
    mockedFs.readdir.mockResolvedValueOnce([
      createDirent('README.md', true),
      createDirent('subdir', false),
    ]);
    await expect(service.getLatestSummary()).resolves.toBeNull();
    expect(mockedFs.stat).not.toHaveBeenCalled();
  });

  test('нормализует данные последнего отчёта', async () => {
    mockedFs.readdir.mockResolvedValueOnce([
      createDirent('2024-01-01.json', true),
      createDirent('2024-02-02.json', true),
    ]);
    mockedFs.stat
      .mockResolvedValueOnce({ mtimeMs: 100 } as unknown as { mtimeMs: number })
      .mockResolvedValueOnce({ mtimeMs: 200 } as unknown as { mtimeMs: number });
    mockedFs.readFile.mockResolvedValueOnce(
      JSON.stringify({
        generatedAt: '2024-02-02T10:00:00.000Z',
        baseName: 'railway-report',
        logPath: '/tmp/log.txt',
        stats: {
          totalLines: '20',
          errors: '3',
          warnings: 4,
          infos: null,
        },
        errors: [
          {
            message: 'Ошибка подключения',
            count: '5',
            samples: ['ERR1', 42],
            context: ['ctx', { value: 1 }],
          },
          null,
        ],
        warnings: [
          { message: 'Предупреждение', count: undefined },
          { message: '', count: 2 },
        ],
        recommendations: [
          {
            id: 'restart',
            title: 'Перезапустить сервис',
            reason: 'Слишком много ошибок',
            autoRun: true,
            command: 'pnpm restart',
          },
          {
            id: '',
            title: 'broken',
            reason: '',
          },
        ],
      }),
    );

    const summary = await service.getLatestSummary();
    expect(summary).not.toBeNull();
    const dir = (service as unknown as { analysisDir: string }).analysisDir;
    expect(summary?.sourceFile).toBe(path.join(dir, '2024-02-02.json'));
    expect(summary?.generatedAt).toBe('2024-02-02T10:00:00.000Z');
    expect(summary?.baseName).toBe('railway-report');
    expect(summary?.stats).toEqual({
      totalLines: 20,
      errors: 3,
      warnings: 4,
      infos: 0,
    });
    expect(summary?.errors).toEqual([
      {
        message: 'Ошибка подключения',
        count: 5,
        samples: ['ERR1'],
        context: ['ctx'],
      },
    ]);
    expect(summary?.warnings).toEqual([
      {
        message: 'Предупреждение',
        count: 0,
        samples: undefined,
        context: undefined,
      },
    ]);
    expect(summary?.recommendations).toEqual([
      {
        id: 'restart',
        title: 'Перезапустить сервис',
        reason: 'Слишком много ошибок',
        autoRun: true,
        command: 'pnpm restart',
      },
    ]);
  });
});
