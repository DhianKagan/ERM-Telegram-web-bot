// Миграция ссылок на файлы: нормализация к /api/v1/files/:id, удаление битых legacy-ссылок, безопасный checkpoint.
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose, { type ConnectOptions, Types } from 'mongoose';

import { File, Task, type Attachment } from '../../apps/api/src/db/model';
import { extractFileIdFromUrl } from '../../apps/api/src/utils/attachments';
import { uploadsDir } from '../../apps/api/src/config/storage';
import { formatCredentialSources, getMongoUrlFromEnv } from './mongoUrl';

type Mode = 'dry_run' | 'apply';

type MigrateStats = {
  tasks_scanned: number;
  tasks_changed: number;
  updates_applied: number;
  removed_legacy_refs: number;
  normalized_refs: number;
  removed_broken_refs: number;
  removed_missing_file_doc: number;
  file_docs_normalized: number;
  checkpoint_last_id: string | null;
};

type MigrationDecision =
  | { action: 'keep'; value: string }
  | {
      action: 'normalize';
      value: string;
      reason: 'legacy_local' | 'query_cleanup';
    }
  | {
      action: 'drop';
      reason: 'legacy_local' | 'broken_ref' | 'missing_file_doc';
    };

const isTruthy = (value: string | undefined): boolean =>
  typeof value === 'string' && /^(1|true|yes|on)$/i.test(value.trim());

const dryRun = isTruthy(process.env.DRY_RUN);
const apply = isTruthy(process.env.APPLY);

if (dryRun === apply) {
  console.error('Укажите ровно один режим: DRY_RUN=true или APPLY=true');
  process.exit(1);
}

const mode: Mode = dryRun ? 'dry_run' : 'apply';
const BATCH_SIZE = Math.max(
  1,
  Number.parseInt(process.env.BATCH_SIZE ?? '200', 10) || 200,
);
const MAX_UPDATES = Math.max(
  1,
  Number.parseInt(process.env.MAX_UPDATES ?? '1000', 10) || 1000,
);
const checkpointPath = path.resolve(
  process.env.CHECKPOINT_FILE ??
    'scripts/db/.migrate_storage_records.checkpoint.json',
);
const uploadsDirNormalized = uploadsDir.replace(/\\/g, '/');

const isLegacyLocalReference = (value: string): boolean => {
  const normalized = value.trim().replace(/\\/g, '/');
  if (!normalized) return false;
  if (/^https?:\/\//i.test(normalized)) {
    return (
      normalized.includes('/uploads/') || /\/api\/uploads\//i.test(normalized)
    );
  }
  return (
    normalized.startsWith('/uploads/') ||
    normalized.startsWith('uploads/') ||
    normalized.startsWith(`${uploadsDirNormalized}/`) ||
    normalized.startsWith('./uploads/') ||
    normalized.startsWith('../uploads/')
  );
};

const normalizeObjectId = (value: unknown): string | null => {
  if (value instanceof Types.ObjectId) {
    return value.toHexString();
  }
  if (typeof value === 'string' && Types.ObjectId.isValid(value)) {
    return new Types.ObjectId(value).toHexString();
  }
  return null;
};

const canonicalFileUrl = (id: string): string => `/api/v1/files/${id}`;

const normalizePathToStorageKey = (currentPath: string): string | null => {
  const value = currentPath.trim().replace(/\\/g, '/');
  if (!value) return null;
  if (value.startsWith('/uploads/')) {
    return value.slice('/uploads/'.length);
  }
  if (value.startsWith('uploads/')) {
    return value.slice('uploads/'.length);
  }
  const uploadsIndex = value.indexOf('/uploads/');
  if (uploadsIndex >= 0) {
    return value.slice(uploadsIndex + '/uploads/'.length);
  }
  return null;
};

const decideReference = (
  value: string,
  existingFileIds: Set<string>,
): MigrationDecision => {
  const trimmed = value.trim();
  if (!trimmed) {
    return { action: 'drop', reason: 'missing_file_doc' };
  }

  const fileId = extractFileIdFromUrl(trimmed);
  const normalizedId = fileId ? normalizeObjectId(fileId) : null;

  if (isLegacyLocalReference(trimmed)) {
    if (normalizedId && existingFileIds.has(normalizedId)) {
      return {
        action: 'normalize',
        value: canonicalFileUrl(normalizedId),
        reason: 'legacy_local',
      };
    }
    return { action: 'drop', reason: 'legacy_local' };
  }

  if (!normalizedId) {
    return { action: 'drop', reason: 'missing_file_doc' };
  }
  if (!existingFileIds.has(normalizedId)) {
    return { action: 'drop', reason: 'broken_ref' };
  }

  const canonical = canonicalFileUrl(normalizedId);
  if (trimmed !== canonical) {
    return { action: 'normalize', value: canonical, reason: 'query_cleanup' };
  }

  return { action: 'keep', value: trimmed };
};

const connectMongo = async (): Promise<void> => {
  const mongoResolution = getMongoUrlFromEnv();
  const mongoUrl = mongoResolution.url;
  const credentialsNote = formatCredentialSources(mongoResolution);
  if (credentialsNote) {
    console.log(credentialsNote);
  }
  if (!/^mongodb(\+srv)?:\/\//.test(mongoUrl)) {
    throw new Error('MONGO_DATABASE_URL не задан');
  }
  const options: ConnectOptions & { serverSelectionTimeoutMS?: number } = {
    serverSelectionTimeoutMS: 5000,
  };
  await mongoose.connect(mongoUrl, options);
};

const readCheckpoint = async (): Promise<string | null> => {
  if (process.env.START_AFTER_ID) {
    const direct = normalizeObjectId(process.env.START_AFTER_ID);
    return direct;
  }
  try {
    const content = await fs.readFile(checkpointPath, 'utf8');
    const parsed = JSON.parse(content) as { lastProcessedId?: unknown };
    return normalizeObjectId(parsed.lastProcessedId);
  } catch {
    return null;
  }
};

const writeCheckpoint = async (lastProcessedId: string): Promise<void> => {
  await fs.mkdir(path.dirname(checkpointPath), { recursive: true });
  await fs.writeFile(
    checkpointPath,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        mode,
        lastProcessedId,
      },
      null,
      2,
    ),
    'utf8',
  );
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

async function main(): Promise<void> {
  await connectMongo();

  const stats: MigrateStats = {
    tasks_scanned: 0,
    tasks_changed: 0,
    updates_applied: 0,
    removed_legacy_refs: 0,
    normalized_refs: 0,
    removed_broken_refs: 0,
    removed_missing_file_doc: 0,
    file_docs_normalized: 0,
    checkpoint_last_id: null,
  };
  const sampleIds: Record<string, string> = {};

  try {
    const fileIds = new Set<string>();
    const fileDocs = await File.find().select(['_id', 'path']).lean();
    const fileDocPathUpdates: Array<{ _id: Types.ObjectId; path: string }> = [];
    fileDocs.forEach((file) => {
      const id = normalizeObjectId(file._id);
      if (id) {
        fileIds.add(id);
      }
      if (typeof file.path === 'string') {
        const nextPath = normalizePathToStorageKey(file.path);
        if (nextPath && nextPath !== file.path) {
          if (!sampleIds.file_doc_path) {
            sampleIds.file_doc_path = id ?? file.path;
          }
          fileDocPathUpdates.push({ _id: file._id, path: nextPath });
        }
      }
    });

    let remainingUpdates = MAX_UPDATES;
    const startAfter = await readCheckpoint();
    let query: Record<string, unknown> = {};
    if (startAfter) {
      query = { _id: { $gt: new Types.ObjectId(startAfter) } };
      console.log(`Продолжаем миграцию после _id=${startAfter}`);
    }

    const cursor = Task.find(query)
      .sort({ _id: 1 })
      .select(['_id', 'attachments', 'files'])
      .lean()
      .cursor({ batchSize: BATCH_SIZE });

    for await (const task of cursor) {
      const taskId = normalizeObjectId(task._id);
      if (!taskId) continue;
      stats.tasks_scanned += 1;
      stats.checkpoint_last_id = taskId;

      let changed = false;
      const nextAttachments: Attachment[] = [];
      const attachments = Array.isArray(task.attachments)
        ? (task.attachments as Attachment[])
        : [];

      attachments.forEach((attachment) => {
        if (!attachment || typeof attachment.url !== 'string') return;
        const decision = decideReference(attachment.url, fileIds);
        if (decision.action === 'keep') {
          nextAttachments.push(attachment);
          return;
        }
        changed = true;
        if (decision.action === 'normalize') {
          stats.normalized_refs += 1;
          if (!sampleIds.normalized_ref) {
            sampleIds.normalized_ref = taskId;
          }
          nextAttachments.push({ ...attachment, url: decision.value });
          return;
        }
        if (decision.reason === 'legacy_local') {
          stats.removed_legacy_refs += 1;
          if (!sampleIds.removed_legacy_ref) {
            sampleIds.removed_legacy_ref = taskId;
          }
        }
        if (decision.reason === 'broken_ref') {
          stats.removed_broken_refs += 1;
          if (!sampleIds.removed_broken_ref) {
            sampleIds.removed_broken_ref = taskId;
          }
        }
        if (decision.reason === 'missing_file_doc') {
          stats.removed_missing_file_doc += 1;
          if (!sampleIds.removed_missing_file_doc) {
            sampleIds.removed_missing_file_doc = taskId;
          }
        }
      });

      const nextFiles: string[] = [];
      const taskFiles = isStringArray(task.files) ? task.files : [];
      taskFiles.forEach((entry) => {
        const decision = decideReference(entry, fileIds);
        if (decision.action === 'keep') {
          nextFiles.push(entry);
          return;
        }
        changed = true;
        if (decision.action === 'normalize') {
          stats.normalized_refs += 1;
          if (!sampleIds.normalized_ref) {
            sampleIds.normalized_ref = taskId;
          }
          nextFiles.push(decision.value);
          return;
        }
        if (decision.reason === 'legacy_local') {
          stats.removed_legacy_refs += 1;
          if (!sampleIds.removed_legacy_ref) {
            sampleIds.removed_legacy_ref = taskId;
          }
        }
        if (decision.reason === 'broken_ref') {
          stats.removed_broken_refs += 1;
          if (!sampleIds.removed_broken_ref) {
            sampleIds.removed_broken_ref = taskId;
          }
        }
        if (decision.reason === 'missing_file_doc') {
          stats.removed_missing_file_doc += 1;
          if (!sampleIds.removed_missing_file_doc) {
            sampleIds.removed_missing_file_doc = taskId;
          }
        }
      });

      if (changed) {
        stats.tasks_changed += 1;
      }

      if (apply && changed) {
        if (remainingUpdates <= 0) {
          console.warn(
            `Достигнут лимит MAX_UPDATES=${MAX_UPDATES}, остановка на taskId=${taskId}`,
          );
          await writeCheckpoint(taskId);
          break;
        }
        await Task.updateOne(
          { _id: task._id },
          { $set: { attachments: nextAttachments, files: nextFiles } },
        ).exec();
        remainingUpdates -= 1;
        stats.updates_applied += 1;
      }

      if (stats.tasks_scanned % BATCH_SIZE === 0) {
        console.log(
          `progress: scanned=${stats.tasks_scanned}, changed=${stats.tasks_changed}, applied=${stats.updates_applied}, last_id=${taskId}`,
        );
        await writeCheckpoint(taskId);
      }
    }

    if (apply) {
      for (const update of fileDocPathUpdates) {
        if (remainingUpdates <= 0) {
          console.warn(
            `Достигнут лимит MAX_UPDATES=${MAX_UPDATES} при нормализации File.path`,
          );
          break;
        }
        await File.updateOne(
          { _id: update._id },
          { $set: { path: update.path } },
        ).exec();
        stats.file_docs_normalized += 1;
        stats.updates_applied += 1;
        remainingUpdates -= 1;
      }
    } else {
      stats.file_docs_normalized = fileDocPathUpdates.length;
    }

    if (stats.checkpoint_last_id) {
      await writeCheckpoint(stats.checkpoint_last_id);
    }

    console.log(
      JSON.stringify(
        {
          mode,
          limits: {
            batch_size: BATCH_SIZE,
            max_updates: MAX_UPDATES,
            checkpoint_file: checkpointPath,
          },
          stats,
          sample_id: sampleIds,
        },
        null,
        2,
      ),
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('Ошибка migrate_storage_records:', error);
  process.exit(1);
});
