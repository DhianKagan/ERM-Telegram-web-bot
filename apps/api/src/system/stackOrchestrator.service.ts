// Назначение: псевдо И-агент, координирующий обслуживание стека
// Основные модули: dataStorage, logAnalysis.service
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '../di/tokens';
import LogAnalysisService, {
  type RailwayLogAnalysisSummary,
} from './logAnalysis.service';
import {
  getFileSyncSnapshot,
  type FileSyncSnapshot,
} from '../services/dataStorage';

export interface StackOverview {
  generatedAt: string;
  fileSync: FileSyncSnapshot;
  logAnalysis: RailwayLogAnalysisSummary | null;
}

export interface StackExecutionResult {
  generatedAt: string;
  fileSync: FileSyncSnapshot;
  logAnalysis: RailwayLogAnalysisSummary | null;
}

export interface CodexMaintenanceBrief {
  generatedAt: string;
  prompt: string;
  fileSync: FileSyncSnapshot;
  logAnalysis: RailwayLogAnalysisSummary | null;
}

@injectable()
export default class StackOrchestratorService {
  constructor(
    @inject(TOKENS.LogAnalysisService)
    private readonly logAnalysis: LogAnalysisService,
  ) {}

  private async collectSnapshot(): Promise<
    [FileSyncSnapshot, RailwayLogAnalysisSummary | null]
  > {
    return Promise.all([
      getFileSyncSnapshot(),
      this.logAnalysis.getLatestSummary(),
    ]);
  }

  async overview(): Promise<StackOverview> {
    const [fileSync, logAnalysis] = await this.collectSnapshot();
    return {
      generatedAt: new Date().toISOString(),
      fileSync,
      logAnalysis,
    };
  }

  async executePlan(): Promise<StackExecutionResult> {
    const [fileSync, logAnalysis] = await this.collectSnapshot();
    return {
      generatedAt: new Date().toISOString(),
      fileSync,
      logAnalysis,
    };
  }

  async latestLogAnalysis(): Promise<RailwayLogAnalysisSummary | null> {
    return this.logAnalysis.getLatestSummary();
  }

  async codexBrief(): Promise<CodexMaintenanceBrief> {
    const [fileSync, logAnalysis] = await this.collectSnapshot();

    const lines: string[] = [];
    lines.push('Контекст обслуживания инфраструктуры для Codex.');
    lines.push('');
    lines.push('Состояние файлового хранилища:');
    lines.push(
      `- Всего файлов: ${fileSync.totalFiles}, связанных с задачами: ${fileSync.linkedFiles}, без задач: ${fileSync.detachedFiles}.`,
    );
    if (fileSync.detachedFiles === 0) {
      lines.push(
        '- Несвязанных вложений не обнаружено, синхронизация в норме.',
      );
    } else {
      lines.push(
        '- Обнаружены файлы без задач, требуется ручная проверка и очистка.',
      );
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
      const autoCommands = logAnalysis.recommendations.filter(
        (rec) => rec.autoRun && rec.command,
      );
      const manualRecs = logAnalysis.recommendations.filter(
        (rec) => !rec.autoRun,
      );
      if (autoCommands.length) {
        lines.push('- Автоматические команды:');
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
      lines.push('Анализ логов Railway недоступен: свежие отчёты не найдены.');
    }

    return {
      generatedAt: new Date().toISOString(),
      prompt: lines.join('\n'),
      fileSync,
      logAnalysis,
    };
  }
}
