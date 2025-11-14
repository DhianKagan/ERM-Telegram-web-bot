// Назначение: проверка сборки сводки Codex в StackOrchestratorService
// Основные модули: jest, StackOrchestratorService
import 'reflect-metadata';
import StackOrchestratorService, {
  type CodexMaintenanceBrief,
} from '../apps/api/src/system/stackOrchestrator.service';
import type LogAnalysisService from '../apps/api/src/system/logAnalysis.service';
import type { RailwayLogAnalysisSummary } from '../apps/api/src/system/logAnalysis.service';
import { getFileSyncSnapshot } from '../apps/api/src/services/dataStorage';

jest.mock('../apps/api/src/services/dataStorage', () => ({
  getFileSyncSnapshot: jest.fn(),
}));

describe('StackOrchestratorService.codexBrief', () => {
  const getLatestSummaryMock = jest.fn<
    Promise<RailwayLogAnalysisSummary | null>,
    []
  >();
  const logAnalysisService = {
    getLatestSummary: getLatestSummaryMock,
  } as unknown as LogAnalysisService;

  const service = new StackOrchestratorService(logAnalysisService);
  const fileSyncMock = getFileSyncSnapshot as jest.MockedFunction<
    typeof getFileSyncSnapshot
  >;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2024-02-02T12:00:00Z'));
    fileSyncMock.mockReset();
    getLatestSummaryMock.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('возвращает сводку с информацией о файловом хранилище', async () => {
    fileSyncMock.mockResolvedValue({
      totalFiles: 12,
      linkedFiles: 12,
      detachedFiles: 0,
    });

    const logSummary: RailwayLogAnalysisSummary = {
      generatedAt: '2024-02-01T09:00:00Z',
      baseName: 'service-prod-20240201',
      logPath: 'Railway/logs/service-prod.log',
      stats: { totalLines: 1200, errors: 5, warnings: 7, infos: 20 },
      errors: [
        { message: 'TypeError: Cannot read properties of undefined', count: 3 },
        { message: 'ReferenceError: route is not defined', count: 2 },
      ],
      warnings: [{ message: 'Mongo connection slow', count: 4 }],
      recommendations: [
        {
          id: 'lint',
          title: 'Прогнать линтер',
          reason:
            'Ошибки уровня TypeError/ReferenceError часто выявляются линтером до деплоя.',
          autoRun: true,
          command: 'pnpm lint',
        },
        {
          id: 'review-validation',
          title: 'Проверить схемы валидации',
          reason:
            'Обнаружены ValidationError — требуется сверить схемы DTO и ответы API.',
          autoRun: false,
        },
      ],
      sourceFile: 'Railway/analysis/service-prod.json',
    };

    getLatestSummaryMock.mockResolvedValue(logSummary);

    const brief: CodexMaintenanceBrief = await service.codexBrief();

    expect(brief.generatedAt).toBe('2024-02-02T12:00:00.000Z');
    expect(brief.fileSync).toEqual({
      totalFiles: 12,
      linkedFiles: 12,
      detachedFiles: 0,
    });
    expect(brief.logAnalysis).toBe(logSummary);
    expect(brief.prompt).toContain('Контекст обслуживания инфраструктуры');
    expect(brief.prompt).toContain(
      'Всего файлов: 12, связанных с задачами: 12',
    );
    expect(brief.prompt).toContain('Автоматические команды');
    expect(brief.prompt).toContain('pnpm lint');
  });

  test('сообщает об отсутствии отчёта логов', async () => {
    fileSyncMock.mockResolvedValue({
      totalFiles: 4,
      linkedFiles: 3,
      detachedFiles: 1,
    });

    getLatestSummaryMock.mockResolvedValue(null);

    const brief = await service.codexBrief();

    expect(brief.logAnalysis).toBeNull();
    expect(brief.prompt).toContain('Анализ логов Railway недоступен');
    expect(brief.prompt).toContain(
      'файлы без задач, требуется ручная проверка',
    );
  });
});
