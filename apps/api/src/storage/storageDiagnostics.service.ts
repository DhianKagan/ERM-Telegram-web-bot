// Назначение: диагностика и автоматическое обслуживание локального хранилища файлов
// Основные модули: fs/promises, path, mongoose, utils/attachments, di/tokens
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Model, UpdateWriteOpResult } from 'mongoose';
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '../di/tokens';
import type { FileDocument, TaskDocument } from '../db/model';

const FILE_ID_REGEXP = /\/api\/v1\/files\/([0-9a-f]{24})(?=$|[/?#])/i;
const DEFAULT_THRESHOLD_BYTES = Number(process.env.DISK_FREE_WARN || 1_073_741_824);

export type StorageFixAction =
  | { type: 'remove_file_entry'; fileId: string }
  | { type: 'delete_disk_file'; path: string }
  | { type: 'unlink_task_reference'; taskId: string; attachmentUrl: string };

export type StorageIssueType =
  | 'missing_on_disk'
  | 'orphan_on_disk'
  | 'duplicate_entry'
  | 'stale_task_link';

type TaskRef = {
  id: string;
  number?: string | null;
  title?: string | null;
};

export type StorageIssue =
  | {
      type: 'missing_on_disk';
      fileId: string;
      path: string;
      userId?: number;
      tasks: TaskRef[];
      recommended: StorageFixAction | null;
    }
  | {
      type: 'orphan_on_disk';
      path: string;
      size: number;
      recommended: StorageFixAction | null;
    }
  | {
      type: 'duplicate_entry';
      path: string;
      fileIds: string[];
      recommended: StorageFixAction[];
    }
  | {
      type: 'stale_task_link';
      task: TaskRef;
      attachmentUrl: string;
      recommended: StorageFixAction | null;
    };

export interface StorageDiagnosticsReport {
  scannedAt: string;
  stats: {
    databaseEntries: number;
    diskFiles: number;
    diskSizeBytes: number;
    diskFreeBytes?: number;
    diskTotalBytes?: number;
    thresholdBytes: number;
  };
  issues: StorageIssue[];
  summary: Record<StorageIssueType, number> & { total: number };
  recommendations: string[];
  recommendedFixes: StorageFixAction[];
}

export interface StorageFixExecution {
  performed: Array<{ action: StorageFixAction; details?: Record<string, unknown> }>;
  errors: Array<{ action: StorageFixAction; error: string }>;
}

interface DiskScanResult {
  entries: Map<string, number>;
  totalSize: number;
}

@injectable()
export default class StorageDiagnosticsService {
  private readonly rootDir: string;

  private readonly thresholdBytes: number;

  constructor(
    @inject(TOKENS.StorageRootDir) storageRoot: string,
    @inject(TOKENS.FileModel) private readonly fileModel: Model<FileDocument>,
    @inject(TOKENS.TaskModel) private readonly taskModel: Model<TaskDocument>,
  ) {
    this.rootDir = path.resolve(storageRoot);
    this.thresholdBytes = DEFAULT_THRESHOLD_BYTES;
  }

  public normalizeFixActions(raw: unknown): StorageFixAction[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    const normalized: StorageFixAction[] = [];
    const seen = new Set<string>();
    raw.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const candidate = item as Record<string, unknown>;
      const type = typeof candidate.type === 'string' ? candidate.type : '';
      if (type === 'remove_file_entry') {
        const rawId = candidate.fileId;
        if (typeof rawId === 'string' && /^[0-9a-f]{24}$/i.test(rawId)) {
          const key = `remove_file_entry:${rawId.toLowerCase()}`;
          if (!seen.has(key)) {
            seen.add(key);
            normalized.push({ type: 'remove_file_entry', fileId: rawId });
          }
        }
      } else if (type === 'delete_disk_file') {
        const rawPath = this.normalizeInputPath(candidate.path);
        if (rawPath) {
          const key = `delete_disk_file:${rawPath}`;
          if (!seen.has(key)) {
            seen.add(key);
            normalized.push({ type: 'delete_disk_file', path: rawPath });
          }
        }
      } else if (type === 'unlink_task_reference') {
        const taskId = this.normalizeObjectId(candidate.taskId);
        const attachmentUrl =
          typeof candidate.attachmentUrl === 'string'
            ? candidate.attachmentUrl.trim()
            : '';
        if (taskId && attachmentUrl) {
          const key = `unlink_task_reference:${taskId}:${attachmentUrl}`;
          if (!seen.has(key)) {
            seen.add(key);
            normalized.push({
              type: 'unlink_task_reference',
              taskId,
              attachmentUrl,
            });
          }
        }
      }
    });
    return normalized;
  }

  async runDiagnostics(): Promise<StorageDiagnosticsReport> {
    const [disk, fileDocs, tasks] = await Promise.all([
      this.scanDiskSafe(),
      this.fileModel.find().lean(),
      this.taskModel.find().lean(),
    ]);

    const fileEntries = fileDocs.map((doc) => ({
      id: this.normalizeObjectId(doc._id)!,
      path: this.normalizeInputPath(doc.path) ?? '',
      userId: typeof doc.userId === 'number' ? doc.userId : undefined,
    }));

    const fileIdSet = new Set(fileEntries.map((entry) => entry.id));
    const filePathMap = new Map<string, string[]>();
    fileEntries.forEach((entry) => {
      if (!entry.path) return;
      const group = filePathMap.get(entry.path);
      if (group) {
        group.push(entry.id);
      } else {
        filePathMap.set(entry.path, [entry.id]);
      }
    });

    const fileUsage = this.collectFileUsage(tasks, fileIdSet);
    const staleIssues = this.collectStaleIssues(tasks, fileIdSet);

    const issues: StorageIssue[] = [...staleIssues];
    const summary: Record<StorageIssueType, number> & { total: number } = {
      missing_on_disk: 0,
      orphan_on_disk: 0,
      duplicate_entry: 0,
      stale_task_link: staleIssues.length,
      total: staleIssues.length,
    };
    const recommendedFixes: StorageFixAction[] = [];
    staleIssues.forEach((issue) => {
      if (issue.recommended) {
        recommendedFixes.push(issue.recommended);
      }
    });

    fileEntries.forEach((entry) => {
      if (!entry.path) {
        const action: StorageFixAction = {
          type: 'remove_file_entry',
          fileId: entry.id,
        };
        issues.push({
          type: 'missing_on_disk',
          fileId: entry.id,
          path: '',
          userId: entry.userId,
          tasks: this.convertUsage(fileUsage.get(entry.id)),
          recommended: action,
        });
        summary.missing_on_disk += 1;
        summary.total += 1;
        recommendedFixes.push(action);
        return;
      }
      if (!disk.entries.has(entry.path)) {
        const action: StorageFixAction = {
          type: 'remove_file_entry',
          fileId: entry.id,
        };
        issues.push({
          type: 'missing_on_disk',
          fileId: entry.id,
          path: entry.path,
          userId: entry.userId,
          tasks: this.convertUsage(fileUsage.get(entry.id)),
          recommended: action,
        });
        summary.missing_on_disk += 1;
        summary.total += 1;
        recommendedFixes.push(action);
      }
    });

    disk.entries.forEach((size, diskPath) => {
      if (!filePathMap.has(diskPath)) {
        const action: StorageFixAction = {
          type: 'delete_disk_file',
          path: diskPath,
        };
        issues.push({
          type: 'orphan_on_disk',
          path: diskPath,
          size,
          recommended: action,
        });
        summary.orphan_on_disk += 1;
        summary.total += 1;
        recommendedFixes.push(action);
      }
    });

    filePathMap.forEach((ids, filePath) => {
      if (ids.length <= 1) return;
      const duplicates = ids.slice(1).map((fileId) => ({
        type: 'remove_file_entry',
        fileId,
      })) as StorageFixAction[];
      issues.push({
        type: 'duplicate_entry',
        path: filePath,
        fileIds: ids,
        recommended: duplicates,
      });
      summary.duplicate_entry += 1;
      summary.total += 1;
      duplicates.forEach((action) => recommendedFixes.push(action));
    });

    const diskStats = await this.measureDiskUsage();
    const recommendations = this.buildRecommendations(summary, diskStats.warning);

    const normalizedFixes = this.normalizeFixActions(recommendedFixes);

    return {
      scannedAt: new Date().toISOString(),
      stats: {
        databaseEntries: fileEntries.length,
        diskFiles: disk.entries.size,
        diskSizeBytes: disk.totalSize,
        diskFreeBytes: diskStats.freeBytes,
        diskTotalBytes: diskStats.totalBytes,
        thresholdBytes: this.thresholdBytes,
      },
      issues,
      summary,
      recommendations,
      recommendedFixes: normalizedFixes,
    };
  }

  async applyFixes(actions: StorageFixAction[]): Promise<StorageFixExecution> {
    const performed: StorageFixExecution['performed'] = [];
    const errors: StorageFixExecution['errors'] = [];
    for (const action of this.normalizeFixActions(actions)) {
      try {
        if (action.type === 'remove_file_entry') {
          const details = await this.removeFileEntry(action.fileId);
          performed.push({ action, details });
        } else if (action.type === 'delete_disk_file') {
          await this.deleteDiskFile(action.path);
          performed.push({ action, details: { path: action.path } });
        } else if (action.type === 'unlink_task_reference') {
          await this.unlinkTaskReference(action.taskId, action.attachmentUrl);
          performed.push({ action });
        }
      } catch (error) {
        const message =
          error && typeof error === 'object' && 'message' in error
            ? String((error as { message?: string }).message)
            : 'Неизвестная ошибка';
        errors.push({ action, error: message });
      }
    }
    return { performed, errors };
  }

  async measureDiskUsage(): Promise<{
    freeBytes?: number;
    totalBytes?: number;
    warning: boolean;
  }> {
    try {
      const stats = await fs.statfs(this.rootDir);
      const free = stats.bfree * stats.bsize;
      const total = stats.blocks * stats.bsize;
      return {
        freeBytes: free,
        totalBytes: total,
        warning: free < this.thresholdBytes,
      };
    } catch {
      return { warning: false };
    }
  }

  buildFixPlan(report: StorageDiagnosticsReport): StorageFixAction[] {
    return this.normalizeFixActions(report.recommendedFixes);
  }

  private convertUsage(
    usage: Map<string, TaskRef> | undefined,
  ): TaskRef[] {
    if (!usage) return [];
    return Array.from(usage.values());
  }

  private normalizeObjectId(value: unknown): string | null {
    if (typeof value === 'string' && /^[0-9a-f]{24}$/i.test(value)) {
      return value;
    }
    if (value && typeof value === 'object' && '_id' in value) {
      const nested = (value as Record<string, unknown>)._id;
      return this.normalizeObjectId(nested);
    }
    if (
      typeof value === 'object' &&
      value !== null &&
      'toString' in value &&
      typeof (value as { toString: () => string }).toString === 'function'
    ) {
      const candidate = (value as { toString: () => string }).toString();
      return /^[0-9a-f]{24}$/i.test(candidate) ? candidate : null;
    }
    return null;
  }

  private normalizeInputPath(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim().replace(/\\+/g, '/');
    if (!trimmed) {
      return null;
    }
    if (trimmed.includes('..')) {
      return null;
    }
    const absolute = path.resolve(this.rootDir, trimmed);
    const relative = path.relative(this.rootDir, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return null;
    }
    return relative.split(path.sep).join('/');
  }

  private async scanDiskSafe(): Promise<DiskScanResult> {
    try {
      await fs.mkdir(this.rootDir, { recursive: true });
      return this.scanDisk();
    } catch {
      return { entries: new Map(), totalSize: 0 };
    }
  }

  private async scanDisk(): Promise<DiskScanResult> {
    const entries = new Map<string, number>();
    let totalSize = 0;
    const stack: string[] = [this.rootDir];
    while (stack.length) {
      const current = stack.pop();
      if (!current) continue;
      let dirEntries;
      try {
        dirEntries = await fs.readdir(current, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of dirEntries) {
        const absolute = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(absolute);
          continue;
        }
        if (!entry.isFile()) {
          continue;
        }
        try {
          const stats = await fs.stat(absolute);
          const relative = path
            .relative(this.rootDir, absolute)
            .split(path.sep)
            .join('/');
          if (!relative || relative.startsWith('..')) {
            continue;
          }
          entries.set(relative, stats.size);
          totalSize += stats.size;
        } catch {
          // пропускаем файлы, которые не удалось прочитать
        }
      }
    }
    return { entries, totalSize };
  }

  private collectFileUsage(
    tasks: TaskDocument[],
    fileIdSet: Set<string>,
  ): Map<string, Map<string, TaskRef>> {
    const usage = new Map<string, Map<string, TaskRef>>();
    tasks.forEach((task) => {
      const taskId = this.normalizeObjectId(task._id);
      if (!taskId) return;
      const info: TaskRef = {
        id: taskId,
        number:
          typeof (task as Record<string, unknown>).task_number === 'string'
            ? ((task as Record<string, unknown>).task_number as string)
            : null,
        title:
          typeof (task as Record<string, unknown>).title === 'string'
            ? ((task as Record<string, unknown>).title as string)
            : null,
      };
      const attachments = Array.isArray((task as Record<string, unknown>).attachments)
        ? ((task as Record<string, unknown>).attachments as Array<Record<string, unknown>>)
        : [];
      attachments.forEach((attachment) => {
        if (!attachment || typeof attachment.url !== 'string') return;
        const url = attachment.url.trim();
        if (!url) return;
        const fileId = this.extractFileId(url);
        if (!fileId) return;
        if (!fileIdSet.has(fileId)) return;
        const taskMap = usage.get(fileId) ?? new Map<string, TaskRef>();
        if (!taskMap.has(taskId)) {
          taskMap.set(taskId, info);
          usage.set(fileId, taskMap);
        }
      });
      const files = Array.isArray((task as Record<string, unknown>).files)
        ? ((task as Record<string, unknown>).files as unknown[])
        : [];
      files.forEach((value) => {
        if (typeof value !== 'string') return;
        const fileId = this.extractFileId(value);
        if (!fileId) return;
        if (!fileIdSet.has(fileId)) return;
        const taskMap = usage.get(fileId) ?? new Map<string, TaskRef>();
        if (!taskMap.has(taskId)) {
          taskMap.set(taskId, info);
          usage.set(fileId, taskMap);
        }
      });
    });
    return usage;
  }

  private collectStaleIssues(
    tasks: TaskDocument[],
    fileIdSet: Set<string>,
  ): StorageIssue[] {
    const issues: StorageIssue[] = [];
    tasks.forEach((task) => {
      const taskId = this.normalizeObjectId(task._id);
      if (!taskId) return;
      const taskInfo: TaskRef = {
        id: taskId,
        number:
          typeof (task as Record<string, unknown>).task_number === 'string'
            ? ((task as Record<string, unknown>).task_number as string)
            : null,
        title:
          typeof (task as Record<string, unknown>).title === 'string'
            ? ((task as Record<string, unknown>).title as string)
            : null,
      };
      const attachments = Array.isArray((task as Record<string, unknown>).attachments)
        ? ((task as Record<string, unknown>).attachments as Array<Record<string, unknown>>)
        : [];
      attachments.forEach((attachment) => {
        if (!attachment || typeof attachment.url !== 'string') return;
        const url = attachment.url.trim();
        if (!url) return;
        const fileId = this.extractFileId(url);
        if (fileId && fileIdSet.has(fileId)) return;
        if (fileId) {
          issues.push({
            type: 'stale_task_link',
            task: taskInfo,
            attachmentUrl: url,
            recommended: {
              type: 'unlink_task_reference',
              taskId: taskInfo.id,
              attachmentUrl: url,
            },
          });
        }
      });
      const files = Array.isArray((task as Record<string, unknown>).files)
        ? ((task as Record<string, unknown>).files as unknown[])
        : [];
      files.forEach((value) => {
        if (typeof value !== 'string') return;
        const url = value.trim();
        if (!url) return;
        const fileId = this.extractFileId(url);
        if (fileId && fileIdSet.has(fileId)) return;
        if (fileId) {
          issues.push({
            type: 'stale_task_link',
            task: taskInfo,
            attachmentUrl: url,
            recommended: {
              type: 'unlink_task_reference',
              taskId: taskInfo.id,
              attachmentUrl: url,
            },
          });
        }
      });
    });
    return issues;
  }

  private extractFileId(value: string): string | null {
    const match = value.match(FILE_ID_REGEXP);
    if (!match) {
      return null;
    }
    const [, id] = match;
    return id ? id : null;
  }

  private buildRecommendations(
    summary: Record<StorageIssueType, number> & { total: number },
    warn: boolean,
  ): string[] {
    const tips: string[] = [];
    if (summary.total === 0) {
      tips.push('Проблемы не обнаружены.');
    } else {
      if (summary.missing_on_disk > 0) {
        tips.push('Удалите записи файлов, которых нет на диске.');
      }
      if (summary.orphan_on_disk > 0) {
        tips.push('Очистите файлы на диске, отсутствующие в базе.');
      }
      if (summary.duplicate_entry > 0) {
        tips.push('Удалите дублирующиеся записи файлов.');
      }
      if (summary.stale_task_link > 0) {
        tips.push('Очистите ссылки на отсутствующие вложения в задачах.');
      }
    }
    if (warn) {
      tips.push('Свободное место на диске ниже порога, рассмотрите очистку.');
    }
    return tips;
  }

  private async removeFileEntry(fileId: string): Promise<Record<string, unknown>> {
    const doc = await this.fileModel.findById(fileId).lean();
    if (!doc) {
      throw new Error('Запись файла не найдена');
    }
    await this.fileModel.deleteOne({ _id: fileId }).exec();
    const fileUrl = `/api/v1/files/${fileId}`;
    await this.taskModel
      .updateMany(
        {
          $or: [
            { 'attachments.url': fileUrl },
            { files: fileUrl },
          ],
        },
        {
          $pull: {
            attachments: { url: fileUrl },
            files: fileUrl,
          },
        },
      )
      .exec();
    return {
      fileId,
      path: this.normalizeInputPath((doc as Record<string, unknown>).path) ?? null,
    };
  }

  private async deleteDiskFile(relativePath: string): Promise<void> {
    const normalized = this.normalizeInputPath(relativePath);
    if (!normalized) {
      throw new Error('Недопустимый путь');
    }
    const target = path.resolve(this.rootDir, normalized);
    const relative = path.relative(this.rootDir, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Недопустимый путь');
    }
    try {
      await fs.unlink(target);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        const code = String((error as { code?: string }).code);
        if (code === 'ENOENT') {
          return;
        }
      }
      throw error;
    }
  }

  private async unlinkTaskReference(taskId: string, url: string): Promise<UpdateWriteOpResult> {
    return this.taskModel
      .updateOne(
        { _id: taskId },
        {
          $pull: {
            attachments: { url },
            files: url,
          },
        },
      )
      .exec();
  }
}
