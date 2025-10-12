// Назначение: проверка сборки сводки Codex в StackOrchestratorService
// Основные модули: jest, StackOrchestratorService
import "reflect-metadata";
import StackOrchestratorService, {
  type CodexMaintenanceBrief,
} from "../apps/api/src/system/stackOrchestrator.service";
import type StorageDiagnosticsService from "../apps/api/src/storage/storageDiagnostics.service";
import type LogAnalysisService from "../apps/api/src/system/logAnalysis.service";
import type {
  StorageDiagnosticsReport,
  StorageFixAction,
  StorageFixExecution,
} from "../apps/api/src/storage/storageDiagnostics.service";
import type { RailwayLogAnalysisSummary } from "../apps/api/src/system/logAnalysis.service";

const noopExecution: StorageFixExecution = { performed: [], errors: [] };

describe("StackOrchestratorService.codexBrief", () => {
  const runDiagnosticsMock = jest.fn<Promise<StorageDiagnosticsReport>, []>();
  const buildFixPlanMock = jest.fn<StorageFixAction[], [StorageDiagnosticsReport]>();
  const applyFixesMock = jest.fn<Promise<StorageFixExecution>, [StorageFixAction[]]>(() =>
    Promise.resolve(noopExecution),
  );
  const storageDiagnostics = {
    runDiagnostics: runDiagnosticsMock,
    buildFixPlan: buildFixPlanMock,
    applyFixes: applyFixesMock,
  } as unknown as StorageDiagnosticsService;

  const getLatestSummaryMock = jest.fn<Promise<RailwayLogAnalysisSummary | null>, []>();
  const logAnalysisService = {
    getLatestSummary: getLatestSummaryMock,
  } as unknown as LogAnalysisService;

  const service = new StackOrchestratorService(storageDiagnostics, logAnalysisService);

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2024-02-02T12:00:00Z"));
    runDiagnosticsMock.mockReset();
    buildFixPlanMock.mockReset();
    getLatestSummaryMock.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("возвращает сводку с текстовой подсказкой", async () => {
    const report: StorageDiagnosticsReport = {
      scannedAt: "2024-02-02T10:00:00Z",
      stats: {
        databaseEntries: 3,
        diskFiles: 2,
        diskSizeBytes: 4096,
        diskFreeBytes: 2048,
        diskTotalBytes: 8192,
        thresholdBytes: 1024,
      },
      issues: [
        {
          type: "missing_on_disk",
          fileId: "aaaaaaaaaaaaaaaaaaaaaaaa",
          path: "uploads/1.dat",
          userId: 101,
          tasks: [
            { id: "task-1", title: "Задача №1" },
            { id: "task-2", number: "T-2" },
          ],
          recommended: { type: "remove_file_entry", fileId: "aaaaaaaaaaaaaaaaaaaaaaaa" },
        },
        {
          type: "orphan_on_disk",
          path: "tmp/orphan.tmp",
          size: 512,
          recommended: { type: "delete_disk_file", path: "tmp/orphan.tmp" },
        },
        {
          type: "duplicate_entry",
          path: "docs/report.pdf",
          fileIds: ["bbbbbbbbbbbbbbbbbbbbbbbb", "cccccccccccccccccccccccc"],
          recommended: [
            { type: "remove_file_entry", fileId: "bbbbbbbbbbbbbbbbbbbbbbbb" },
            { type: "remove_file_entry", fileId: "cccccccccccccccccccccccc" },
          ],
        },
        {
          type: "stale_task_link",
          task: { id: "task-3", number: "T-3" },
          attachmentUrl: "/api/v1/files/dddddddddddddddddddddddd",
          recommended: {
            type: "unlink_task_reference",
            taskId: "task-3",
            attachmentUrl: "/api/v1/files/dddddddddddddddddddddddd",
          },
        },
      ],
      summary: {
        missing_on_disk: 1,
        orphan_on_disk: 1,
        duplicate_entry: 1,
        stale_task_link: 1,
        total: 4,
      },
      recommendations: [
        "Удалить временный файл tmp/orphan.tmp",
        "Удалить запись файла aaaaaaaaaaaaaaaaaaaaaaaa",
      ],
      recommendedFixes: [
        { type: "remove_file_entry", fileId: "aaaaaaaaaaaaaaaaaaaaaaaa" },
      ],
    };

    const plan: StorageFixAction[] = [
      { type: "remove_file_entry", fileId: "aaaaaaaaaaaaaaaaaaaaaaaa" },
      { type: "unlink_task_reference", taskId: "task-3", attachmentUrl: "/api/v1/files/dddddddddddddddddddddddd" },
    ];

    const logSummary: RailwayLogAnalysisSummary = {
      generatedAt: "2024-02-01T09:00:00Z",
      baseName: "service-prod-20240201",
      logPath: "Railway/logs/service-prod.log",
      stats: { totalLines: 1200, errors: 5, warnings: 7, infos: 20 },
      errors: [
        { message: "TypeError: Cannot read properties of undefined", count: 3 },
        { message: "ReferenceError: route is not defined", count: 2 },
      ],
      warnings: [{ message: "Mongo connection slow", count: 4 }],
      recommendations: [
        {
          id: "lint",
          title: "Прогнать линтер",
          reason: "Ошибки уровня TypeError/ReferenceError часто выявляются линтером до деплоя.",
          autoRun: true,
          command: "pnpm lint",
        },
        {
          id: "review-validation",
          title: "Проверить схемы валидации",
          reason: "Обнаружены ValidationError — требуется сверить схемы DTO и ответы API.",
          autoRun: false,
        },
      ],
      sourceFile: "Railway/analysis/service-prod.json",
    };

    runDiagnosticsMock.mockResolvedValue(report);
    buildFixPlanMock.mockReturnValue(plan);
    getLatestSummaryMock.mockResolvedValue(logSummary);

    const brief: CodexMaintenanceBrief = await service.codexBrief();

    expect(brief.generatedAt).toBe("2024-02-02T12:00:00.000Z");
    expect(brief.storageReport).toBe(report);
    expect(brief.storagePlan).toEqual(plan);
    expect(brief.logAnalysis).toBe(logSummary);
    expect(brief.prompt).toContain("Контекст обслуживания инфраструктуры");
    expect(brief.prompt).toContain("Записей в базе: 3");
    expect(brief.prompt).toContain("запись aaaaaaaaaaaaaaaaaaaaaaaa указывает на отсутствующий файл uploads/1.dat");
    expect(brief.prompt).toContain("Автоматические команды для запуска");
    expect(brief.prompt).toContain("pnpm lint");
    expect(brief.prompt).toContain("Проверить схемы валидации");
  });

  test("сообщает об отсутствии отчёта логов", async () => {
    const emptyReport: StorageDiagnosticsReport = {
      scannedAt: "2024-02-02T10:00:00Z",
      stats: {
        databaseEntries: 0,
        diskFiles: 0,
        diskSizeBytes: 0,
        diskFreeBytes: undefined,
        diskTotalBytes: undefined,
        thresholdBytes: 1024,
      },
      issues: [],
      summary: {
        missing_on_disk: 0,
        orphan_on_disk: 0,
        duplicate_entry: 0,
        stale_task_link: 0,
        total: 0,
      },
      recommendations: [],
      recommendedFixes: [],
    };

    runDiagnosticsMock.mockResolvedValue(emptyReport);
    buildFixPlanMock.mockReturnValue([]);
    getLatestSummaryMock.mockResolvedValue(null);

    const brief = await service.codexBrief();

    expect(brief.logAnalysis).toBeNull();
    expect(brief.prompt).toContain("Анализ логов Railway недоступен");
  });
});
