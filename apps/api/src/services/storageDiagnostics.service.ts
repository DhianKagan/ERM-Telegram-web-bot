// Сервис диагностики и обслуживания файлового хранилища
// Основные модули: tsyringe, mongoose, services/fileService
import { inject, injectable } from 'tsyringe';
import type { FilterQuery, Model } from 'mongoose';
import { Types } from 'mongoose';
import { TOKENS } from '../di/tokens';
import type { FileDocument } from '../db/model';
import { collectAttachmentLinks, getFileSyncSnapshot } from './fileService';

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

export interface StorageRemediationResultItem {
  action: string;
  status: 'completed' | 'skipped' | 'failed';
  details?: string;
  attempted?: number;
  repaired?: number;
  errors?: number;
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

  private async restoreDetachedLinks(): Promise<{
    attempted: number;
    repaired: number;
    errors: number;
  }> {
    const candidates = await this.fileModel
      .find(this.detachedFilter)
      .select(['_id'])
      .lean();
    if (candidates.length === 0) {
      return { attempted: 0, repaired: 0, errors: 0 };
    }

    const lookup = await collectAttachmentLinks(
      candidates.map((candidate) => ({
        id: String(candidate._id),
        hasTask: false,
      })),
    );
    if (lookup.size === 0) {
      return { attempted: 0, repaired: 0, errors: 0 };
    }

    let repaired = 0;
    let errors = 0;

    for (const [fileId, info] of lookup.entries()) {
      let failed = false;
      const targetTaskId = Types.ObjectId.isValid(info.taskId)
        ? new Types.ObjectId(info.taskId)
        : null;
      if (!targetTaskId) {
        console.error('Не удалось восстановить привязку файла к задаче', {
          fileId,
          taskId: info.taskId,
          error: new Error('Некорректный идентификатор задачи'),
        });
        errors += 1;
        continue;
      }
      try {
        await this.fileModel
          .updateOne(
            { _id: new Types.ObjectId(fileId) },
            { $set: { taskId: targetTaskId } },
          )
          .exec();
      } catch (error) {
        failed = true;
        console.error('Не удалось восстановить привязку файла к задаче', {
          fileId,
          taskId: info.taskId,
          error,
        });
      }
      if (failed) {
        errors += 1;
      } else {
        repaired += 1;
      }
    }

    return {
      attempted: lookup.size,
      repaired,
      errors,
    };
  }

  private async generateReport(): Promise<StorageDiagnosticsReport> {
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

  async diagnose(): Promise<StorageDiagnosticsReport> {
    await this.restoreDetachedLinks();
    return this.generateReport();
  }

  async remediate(): Promise<StorageRemediationReport> {
    const outcome = await this.restoreDetachedLinks();
    const report = await this.generateReport();

    let status: StorageRemediationResultItem['status'] = 'completed';
    let details = 'Привязка файлов проверена.';
    if (outcome.attempted === 0) {
      status = 'skipped';
      details = 'Несвязанных файлов не найдено.';
    } else if (outcome.repaired === 0 && outcome.errors === 0) {
      status = 'skipped';
      details = 'Подходящих задач для восстановления не обнаружено.';
    } else if (outcome.errors > 0 && outcome.repaired === 0) {
      status = 'failed';
      details = 'Не удалось восстановить привязку файлов, проверьте журнал.';
    } else if (outcome.errors > 0) {
      status = 'completed';
      details = 'Часть файлов восстановлена, проверьте журнал для деталей.';
    } else {
      details = 'Привязка файлов восстановлена автоматически.';
    }

    return {
      generatedAt: new Date().toISOString(),
      results: [
        {
          action: 'restoreDetachedLinks',
          status,
          details,
          attempted: outcome.attempted,
          repaired: outcome.repaired,
          errors: outcome.errors,
        },
      ],
      report,
    };
  }
}
