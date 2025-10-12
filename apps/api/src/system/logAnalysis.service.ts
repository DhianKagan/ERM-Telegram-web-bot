// Назначение: сервис чтения последних отчётов анализа логов Railway и подготовки сводки
// Основные модули: fs/promises, path
import fs from 'node:fs/promises';
import path from 'node:path';
import { injectable } from 'tsyringe';

export interface RailwayLogIssueSummary {
  message: string;
  count: number;
  samples?: string[];
  context?: string[];
}

export interface RailwayLogRecommendation {
  id: string;
  title: string;
  reason: string;
  autoRun: boolean;
  command?: string;
}

export interface RailwayLogAnalysisSummary {
  generatedAt: string;
  baseName: string;
  logPath: string;
  stats: {
    totalLines: number;
    errors: number;
    warnings: number;
    infos: number;
  };
  errors: RailwayLogIssueSummary[];
  warnings: RailwayLogIssueSummary[];
  recommendations: RailwayLogRecommendation[];
  sourceFile: string;
}

@injectable()
export default class LogAnalysisService {
  private readonly analysisDir = path.resolve(__dirname, '../../..', 'Railway', 'analysis');

  async getLatestSummary(): Promise<RailwayLogAnalysisSummary | null> {
    let entries;
    try {
      entries = await fs.readdir(this.analysisDir, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }

    const candidates = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map(async (entry) => {
          const filePath = path.join(this.analysisDir, entry.name);
          const stat = await fs.stat(filePath);
          return { filePath, mtime: stat.mtimeMs };
        }),
    );

    if (!candidates.length) {
      return null;
    }

    const latest = candidates.reduce((acc, current) =>
      current.mtime > acc.mtime ? current : acc,
    );

    const raw = await fs.readFile(latest.filePath, 'utf8');
    const payload = JSON.parse(raw) as Partial<RailwayLogAnalysisSummary> & {
      logPath?: string;
      baseName?: string;
      generatedAt?: string;
    };

    const stats = payload.stats ?? { totalLines: 0, errors: 0, warnings: 0, infos: 0 };
    const fallbackDate = new Date(latest.mtime).toISOString();

    const normalizeIssues = (
      list: unknown,
    ): RailwayLogIssueSummary[] => {
      if (!Array.isArray(list)) {
        return [];
      }
      return list
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return null;
          }
          const record = item as Record<string, unknown>;
          const message = typeof record.message === 'string' ? record.message : '';
          if (!message) {
            return null;
          }
          const samples = Array.isArray(record.samples)
            ? (record.samples.filter((value) => typeof value === 'string') as string[])
            : undefined;
          const context = Array.isArray(record.context)
            ? (record.context.filter((value) => typeof value === 'string') as string[])
            : undefined;
          return {
            message,
            count: Number(record.count ?? 0),
            samples,
            context,
          } satisfies RailwayLogIssueSummary;
        })
        .filter(Boolean) as RailwayLogIssueSummary[];
    };

    const normalizeRecommendations = (
      list: unknown,
    ): RailwayLogRecommendation[] => {
      if (!Array.isArray(list)) {
        return [];
      }
      return list
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return null;
          }
          const record = item as Record<string, unknown>;
          const id = typeof record.id === 'string' ? record.id : '';
          const title = typeof record.title === 'string' ? record.title : '';
          const reason = typeof record.reason === 'string' ? record.reason : '';
          if (!id || !title || !reason) {
            return null;
          }
          const command = typeof record.command === 'string' ? record.command : undefined;
          return {
            id,
            title,
            reason,
            command,
            autoRun: Boolean(record.autoRun),
          } satisfies RailwayLogRecommendation;
        })
        .filter(Boolean) as RailwayLogRecommendation[];
    };

    return {
      generatedAt: payload.generatedAt ?? fallbackDate,
      baseName: payload.baseName ?? path.basename(latest.filePath, '.json'),
      logPath: payload.logPath ?? '',
      stats: {
        totalLines: Number(stats.totalLines ?? 0),
        errors: Number(stats.errors ?? 0),
        warnings: Number(stats.warnings ?? 0),
        infos: Number(stats.infos ?? 0),
      },
      errors: normalizeIssues(payload.errors),
      warnings: normalizeIssues(payload.warnings),
      recommendations: normalizeRecommendations(payload.recommendations),
      sourceFile: latest.filePath,
    };
  }
}
