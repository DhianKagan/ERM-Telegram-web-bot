// Идемпотентная очистка устаревших ссылок на файлы в задачах.
// Основные модули: mongoose, dotenv, scripts/db/mongoUrl, модели Task/File, utils/attachments.
import 'dotenv/config';
import path from 'node:path';
import mongoose, { type ConnectOptions } from 'mongoose';

import { uploadsDir } from '../../apps/api/src/config/storage';
import { File, Task, type Attachment } from '../../apps/api/src/db/model';
import { extractFileIdFromUrl } from '../../apps/api/src/utils/attachments';
import { formatCredentialSources, getMongoUrlFromEnv } from './mongoUrl';

type CleanupSummary = {
  tasks_scanned: number;
  tasks_updated: number;
  attachments_removed: number;
  files_removed_or_marked: number;
};

type OrphanAction = 'none' | 'mark' | 'delete';

const isTrue = (value: string | undefined): boolean =>
  typeof value === 'string' && /^(1|true|yes|on)$/i.test(value.trim());

const dryRun = isTrue(process.env.DRY_RUN);
const apply = isTrue(process.env.APPLY);
const cleanupOrphans = isTrue(process.env.CLEANUP_ORPHAN_FILES);

const rawOrphanAction =
  typeof process.env.ORPHAN_ACTION === 'string'
    ? process.env.ORPHAN_ACTION.trim().toLowerCase()
    : '';
const orphanAction: OrphanAction = cleanupOrphans
  ? rawOrphanAction === 'delete' || rawOrphanAction === 'mark'
    ? rawOrphanAction
    : 'mark'
  : 'none';

if (dryRun === apply) {
  console.error('Укажите ровно один режим: DRY_RUN=true или APPLY=true');
  process.exit(1);
}

const uploadsDirAbs = path.resolve(uploadsDir);
const storageDirAbs = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : null;

const isLegacyLocalReference = (value: string): boolean => {
  const normalized = value.trim();
  if (!normalized) return false;
  if (/^https?:\/\//i.test(normalized)) return false;
  if (/^\/api\/v1\/files\/([0-9a-fA-F]{24})(?:$|[/?#])/i.test(normalized)) {
    return false;
  }
  if (/^\/uploads(?:\/|$)/i.test(normalized)) {
    return true;
  }
  if (normalized.startsWith(uploadsDirAbs)) {
    return true;
  }
  if (storageDirAbs && normalized.startsWith(storageDirAbs)) {
    return true;
  }
  return false;
};

const normalizeId = (id: mongoose.Types.ObjectId): string => id.toHexString();

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
  const timeout = 5000;
  const options: ConnectOptions & { serverSelectionTimeoutMS?: number } = {
    serverSelectionTimeoutMS: timeout,
  };
  await mongoose.connect(mongoUrl, options);
};

const collectTaskFileIds = (
  attachments: Attachment[] | null | undefined,
  files: unknown,
): Set<string> => {
  const result = new Set<string>();
  if (Array.isArray(attachments)) {
    attachments.forEach((attachment) => {
      if (!attachment || typeof attachment.url !== 'string') return;
      const id = extractFileIdFromUrl(attachment.url);
      if (id) {
        result.add(id.toLowerCase());
      }
    });
  }
  if (Array.isArray(files)) {
    files.forEach((entry) => {
      if (typeof entry !== 'string') return;
      const id = extractFileIdFromUrl(entry);
      if (id) {
        result.add(id.toLowerCase());
      }
    });
  }
  return result;
};

async function main(): Promise<void> {
  await connectMongo();

  const summary: CleanupSummary = {
    tasks_scanned: 0,
    tasks_updated: 0,
    attachments_removed: 0,
    files_removed_or_marked: 0,
  };

  try {
    const existingFileIds = new Set<string>();
    const files = await File.find().select(['_id']).lean();
    files.forEach((file) => {
      existingFileIds.add(normalizeId(file._id));
    });

    const referencedAfterCleanup = new Set<string>();

    const tasks = await Task.find()
      .select(['_id', 'attachments', 'files'])
      .lean();
    for (const task of tasks) {
      summary.tasks_scanned += 1;

      const attachments = Array.isArray(task.attachments)
        ? (task.attachments as Attachment[])
        : [];
      const filesList = Array.isArray(task.files) ? [...task.files] : [];

      const nextAttachments = attachments.filter((attachment) => {
        if (!attachment || typeof attachment.url !== 'string') {
          return false;
        }
        const url = attachment.url.trim();
        if (!url) {
          summary.attachments_removed += 1;
          return false;
        }
        if (isLegacyLocalReference(url)) {
          summary.attachments_removed += 1;
          return false;
        }
        const fileId = extractFileIdFromUrl(url);
        if (fileId && !existingFileIds.has(fileId.toLowerCase())) {
          summary.attachments_removed += 1;
          return false;
        }
        return true;
      });

      const nextFiles = filesList.filter((entry) => {
        if (typeof entry !== 'string') return false;
        const value = entry.trim();
        if (!value) {
          summary.attachments_removed += 1;
          return false;
        }
        if (isLegacyLocalReference(value)) {
          summary.attachments_removed += 1;
          return false;
        }
        const fileId = extractFileIdFromUrl(value);
        if (fileId && !existingFileIds.has(fileId.toLowerCase())) {
          summary.attachments_removed += 1;
          return false;
        }
        return true;
      });

      const changed =
        nextAttachments.length !== attachments.length ||
        nextFiles.length !== filesList.length;

      if (changed) {
        summary.tasks_updated += 1;
        if (apply) {
          await Task.updateOne(
            { _id: task._id },
            { $set: { attachments: nextAttachments, files: nextFiles } },
          ).exec();
        }
      }

      collectTaskFileIds(nextAttachments, nextFiles).forEach((id) =>
        referencedAfterCleanup.add(id),
      );
    }

    if (orphanAction !== 'none') {
      const orphans = await File.find({
        $and: [
          {
            _id: {
              $nin: Array.from(referencedAfterCleanup).map(
                (id) => new mongoose.Types.ObjectId(id),
              ),
            },
          },
          { $or: [{ taskId: null }, { taskId: { $exists: false } }] },
          { $or: [{ draftId: null }, { draftId: { $exists: false } }] },
          {
            $or: [
              { relatedTaskIds: { $exists: false } },
              { relatedTaskIds: { $size: 0 } },
            ],
          },
        ],
      })
        .select(['_id', 'taskId'])
        .lean();

      if (orphans.length > 0) {
        summary.files_removed_or_marked += orphans.length;
      }

      if (apply && orphans.length > 0) {
        const orphanIds = orphans.map((item) => item._id);
        if (orphanAction === 'delete') {
          await File.deleteMany({ _id: { $in: orphanIds } }).exec();
        } else {
          await File.updateMany(
            { _id: { $in: orphanIds } },
            {
              $set: {
                detached: true,
                scope: 'user',
                taskId: null,
                draftId: null,
                relatedTaskIds: [],
              },
            },
          ).exec();
        }
      }
    }

    console.log(
      JSON.stringify(
        {
          mode: dryRun ? 'DRY_RUN' : 'APPLY',
          orphan_action: orphanAction,
          ...summary,
        },
        null,
        2,
      ),
    );
  } finally {
    await mongoose.disconnect().catch(() => undefined);
  }
}

void main().catch((error: unknown) => {
  const err = error as { message?: string };
  console.error('Ошибка cleanup_legacy_file_links:', err?.message || error);
  process.exit(1);
});
