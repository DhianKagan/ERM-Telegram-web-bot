// Назначение: псевдо И-агент, координирующий обслуживание стека
// Основные модули: storageDiagnostics.service, di/tokens
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '../di/tokens';
import StorageDiagnosticsService, {
  type StorageDiagnosticsReport,
  type StorageFixAction,
  type StorageFixExecution,
  type StorageIssue,
} from '../storage/storageDiagnostics.service';
import LogAnalysisService, {
  type RailwayLogAnalysisSummary,
} from './logAnalysis.service';

export interface StackOverview {
  generatedAt: string;
  storage: StorageDiagnosticsReport;
  plannedActions: StorageFixAction[];
  logAnalysis: RailwayLogAnalysisSummary | null;
}

export interface StackExecutionResult {
  generatedAt: string;
  plan: StorageFixAction[];
  execution: StorageFixExecution;
  report: StorageDiagnosticsReport;
  logAnalysis: RailwayLogAnalysisSummary | null;
}

export interface CodexMaintenanceBrief {
  generatedAt: string;
  prompt: string;
  storageReport: StorageDiagnosticsReport;
  storagePlan: StorageFixAction[];
  logAnalysis: RailwayLogAnalysisSummary | null;
}

@injectable()
export default class StackOrchestratorService {
  constructor(
    @inject(TOKENS.StorageDiagnosticsService)
    private readonly storageDiagnostics: StorageDiagnosticsService,
    @inject(TOKENS.LogAnalysisService)
    private readonly logAnalysis: LogAnalysisService,
  ) {}

  async overview(): Promise<StackOverview> {
    const report = await this.storageDiagnostics.runDiagnostics();
    const plan = this.storageDiagnostics.buildFixPlan(report);
    const logAnalysis = await this.logAnalysis.getLatestSummary();
    return {
      generatedAt: new Date().toISOString(),
      storage: report,
      plannedActions: plan,
      logAnalysis,
    };
  }

  async executePlan(): Promise<StackExecutionResult> {
    const report = await this.storageDiagnostics.runDiagnostics();
    const plan = this.storageDiagnostics.buildFixPlan(report);
    const execution = await this.storageDiagnostics.applyFixes(plan);
    const updatedReport = await this.storageDiagnostics.runDiagnostics();
    const logAnalysis = await this.logAnalysis.getLatestSummary();
    return {
      generatedAt: new Date().toISOString(),
      plan,
      execution,
      report: updatedReport,
      logAnalysis,
    };
  }

  async latestLogAnalysis(): Promise<RailwayLogAnalysisSummary | null> {
    return this.logAnalysis.getLatestSummary();
  }

  async codexBrief(): Promise<CodexMaintenanceBrief> {
    const report = await this.storageDiagnostics.runDiagnostics();
    const plan = this.storageDiagnostics.buildFixPlan(report);
    const logAnalysis = await this.logAnalysis.getLatestSummary();

    const lines: string[] = [];
    lines.push('Контекст обслуживания инфраструктуры для Codex.');
    lines.push('');
    lines.push('Диагностика хранилища:');
    const { stats, summary, issues, recommendations } = report;
    lines.push(
      `- Записей в базе: ${stats.databaseEntries}, файлов на диске: ${stats.diskFiles}, общий объём: ${formatBytes(stats.diskSizeBytes)}.`,
    );
    if (typeof stats.diskFreeBytes === 'number' && typeof stats.diskTotalBytes === 'number') {
      lines.push(
        `- Свободно ${formatBytes(stats.diskFreeBytes)} из ${formatBytes(stats.diskTotalBytes)} (${formatBytes(
          stats.thresholdBytes,
        )} — порог предупреждения).`,
      );
    }
    if (summary.total === 0) {
      lines.push('- Проблем в хранилище не обнаружено.');
    } else {
      lines.push(`- Обнаружено ${summary.total} проблем.`);
      const issueSummary = Object.entries(summary)
        .filter(([key]) => key !== 'total')
        .filter(([, value]) => value > 0)
        .map(([key, value]) => `${translateIssueType(key as keyof typeof summary)} — ${value}`);
      if (issueSummary.length) {
        lines.push(`  Основные типы: ${issueSummary.join('; ')}.`);
      }
    }

    const detailedIssues = issues.slice(0, 5).map((issue) => describeIssue(issue));
    if (detailedIssues.length) {
      lines.push('- Примеры проблем:');
      detailedIssues.forEach((text) => {
        lines.push(`  • ${text}`);
      });
    }

    if (plan.length) {
      lines.push('- Рекомендованные действия с файлами:');
      plan.forEach((action) => {
        lines.push(`  • ${describeAction(action)}`);
      });
    } else if (recommendations.length) {
      lines.push('- Рекомендации к ручному выполнению:');
      recommendations.slice(0, 5).forEach((text) => {
        lines.push(`  • ${text}`);
      });
    }

    if (logAnalysis) {
      lines.push('');
      lines.push('Анализ логов Railway:');
      lines.push(
        `- Отчёт: ${logAnalysis.baseName}, ошибок: ${logAnalysis.stats.errors}, предупреждений: ${logAnalysis.stats.warnings}, информационных сообщений: ${logAnalysis.stats.infos}.`,
      );
      const topErrors = logAnalysis.errors.slice(0, 3);
      if (topErrors.length) {
        lines.push('- Ключевые ошибки:');
        topErrors.forEach((error) => {
          lines.push(`  • ${error.message} — ${error.count} повторов.`);
        });
      }
      const topWarnings = logAnalysis.warnings.slice(0, 3);
      if (topWarnings.length) {
        lines.push('- Основные предупреждения:');
        topWarnings.forEach((warning) => {
          lines.push(`  • ${warning.message} — ${warning.count} повторов.`);
        });
      }
      const autoCommands = logAnalysis.recommendations.filter((rec) => rec.autoRun && rec.command);
      const manualRecs = logAnalysis.recommendations.filter((rec) => !rec.autoRun);
      if (autoCommands.length) {
        lines.push('- Автоматические команды для запуска:');
        autoCommands.forEach((rec) => {
          lines.push(`  • ${rec.command} ← ${rec.reason}`);
        });
      }
      if (manualRecs.length) {
        lines.push('- Ручные рекомендации:');
        manualRecs.forEach((rec) => {
          lines.push(`  • ${rec.title}: ${rec.reason}`);
        });
      }
    } else {
      lines.push('');
      lines.push('Анализ логов Railway недоступен: отчёты не найдены.');
    }

    return {
      generatedAt: new Date().toISOString(),
      prompt: lines.join('\n'),
      storageReport: report,
      storagePlan: plan,
      logAnalysis,
    };
  }
}

function translateIssueType(type: keyof StorageDiagnosticsReport['summary']): string {
  switch (type) {
    case 'missing_on_disk':
      return 'запись без файла';
    case 'orphan_on_disk':
      return 'файл без записи';
    case 'duplicate_entry':
      return 'дублирующая запись';
    case 'stale_task_link':
      return 'устаревшая ссылка в задаче';
    case 'total':
    default:
      return 'прочее';
  }
}

function describeIssue(issue: StorageIssue): string {
  switch (issue.type) {
    case 'missing_on_disk': {
      const taskTitles = issue.tasks
        .map((task) => task.title || task.number || task.id)
        .filter(Boolean)
        .slice(0, 3)
        .join(', ');
      const taskPart = taskTitles ? `; задачи: ${taskTitles}` : '';
      return `запись ${issue.fileId} указывает на отсутствующий файл ${issue.path}${taskPart}`;
    }
    case 'orphan_on_disk':
      return `на диске найден файл ${issue.path} размером ${formatBytes(issue.size)} без записи в базе`;
    case 'duplicate_entry':
      return `файл ${issue.path} имеет дублирующиеся записи ${issue.fileIds.join(', ')}`;
    case 'stale_task_link': {
      const taskName = issue.task.title || issue.task.number || issue.task.id;
      return `задача ${taskName} содержит устаревшую ссылку ${issue.attachmentUrl}`;
    }
    default:
      return 'неизвестная проблема хранилища';
  }
}

function describeAction(action: StorageFixAction): string {
  switch (action.type) {
    case 'remove_file_entry':
      return `удалить запись файла ${action.fileId} из базы`;
    case 'delete_disk_file':
      return `удалить файл на диске по пути ${action.path}`;
    case 'unlink_task_reference':
      return `убрать ссылку ${action.attachmentUrl} из задачи ${action.taskId}`;
    default:
      return 'неизвестное действие';
  }
}

function formatBytes(value?: number): string {
  if (!value || Number.isNaN(value)) {
    return '0 Б';
  }
  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const formatted = size >= 10 || unitIndex === 0 ? Math.round(size).toString() : size.toFixed(1);
  return `${formatted} ${units[unitIndex]}`;
}
