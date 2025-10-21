// Сервис диагностики и обслуживания файлового хранилища
// Основные модули: tsyringe, mongoose, services/dataStorage
import { inject, injectable } from 'tsyringe';
import type { FilterQuery, Model } from 'mongoose';
import { TOKENS } from '../di/tokens';
import type { FileDocument } from '../db/model';
import { deleteFile, getFileSyncSnapshot } from './dataStorage';

export interface StorageDiagnosticsReport {
  generatedAt: string;
  snapshot: Awaited<ReturnType<typeof getFileSyncSnapshot>>;
  detachedFiles: Array<{
    id: string;
    name: string;
    path: string;
    size: number;
    uploadedAt: Date;
    userId: number;
  }>;
}

export interface StorageRemediationAction {
  type: 'purgeDetachedFiles';
  limit?: number;
}

export interface StorageRemediationResultItem {
  action: string;
  status: 'completed' | 'skipped' | 'failed';
  details?: string;
  removed?: number;
  attempted?: number;
}

export interface StorageRemediationReport {
  generatedAt: string;
  results: StorageRemediationResultItem[];
  report: StorageDiagnosticsReport;
}

@injectable()
export default class StorageDiagnosticsService {
  constructor(
    @inject(TOKENS.FileModel)
    private readonly fileModel: Model<FileDocument>,
  ) {}

  private get detachedFilter(): FilterQuery<FileDocument> {
    return {
      $or: [{ taskId: null }, { taskId: { $exists: false } }],
    } satisfies FilterQuery<FileDocument>;
  }

  async diagnose(): Promise<StorageDiagnosticsReport> {
    const [snapshot, detachedDocs] = await Promise.all([
      getFileSyncSnapshot(),
      this.fileModel
        .find(this.detachedFilter)
        .select(['_id', 'name', 'path', 'size', 'uploadedAt', 'userId'])
        .lean(),
    ]);

    const detachedFiles = detachedDocs.map((doc) => ({
      id: String(doc._id),
      name: doc.name,
      path: doc.path,
      size: doc.size,
      uploadedAt: doc.uploadedAt,
      userId: doc.userId,
    }));

    return {
      generatedAt: new Date().toISOString(),
      snapshot,
      detachedFiles,
    };
  }

  private async purgeDetachedFiles(limit?: number): Promise<StorageRemediationResultItem> {
    const query = this.fileModel.find(this.detachedFilter).select(['_id']);
    const max = typeof limit === 'number' && Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0;
    if (max > 0) {
      query.limit(max);
    }
    const candidates = await query.lean();
    if (candidates.length === 0) {
      return {
        action: 'purgeDetachedFiles',
        status: 'skipped',
        details: 'Несвязанных файлов не найдено.',
        attempted: 0,
        removed: 0,
      };
    }

    let removed = 0;
    const attempted = candidates.length;
    for (const file of candidates) {
      try {
        await deleteFile(String(file._id));
        removed += 1;
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
          removed += 1;
        } else {
          return {
            action: 'purgeDetachedFiles',
            status: 'failed',
            details: err.message,
            attempted,
            removed,
          };
        }
      }
    }

    return {
      action: 'purgeDetachedFiles',
      status: 'completed',
      details: 'Несвязанные файлы удалены.',
      attempted,
      removed,
    };
  }

  async remediate(
    actions: StorageRemediationAction[],
  ): Promise<StorageRemediationReport> {
    const results: StorageRemediationResultItem[] = [];
    for (const action of actions) {
      if (!action || typeof action.type !== 'string') {
        results.push({
          action: 'unknown',
          status: 'skipped',
          details: 'Недопустимое описание действия.',
        });
        continue;
      }

      if (action.type === 'purgeDetachedFiles') {
        const result = await this.purgeDetachedFiles(action.limit);
        results.push(result);
        continue;
      }

      results.push({
        action: action.type,
        status: 'skipped',
        details: 'Неизвестное действие, пропуск.',
      });
    }

    const report = await this.diagnose();
    return {
      generatedAt: new Date().toISOString(),
      results,
      report,
    };
  }
}
