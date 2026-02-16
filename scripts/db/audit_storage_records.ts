// Аудит ссылок на файлы в задачах: валидные S3-ссылки, legacy local, битые и неполные записи.
import 'dotenv/config';
import mongoose, { type ConnectOptions, Types } from 'mongoose';

import { File, Task, type Attachment } from '../../apps/api/src/db/model';
import { extractFileIdFromUrl } from '../../apps/api/src/utils/attachments';
import { uploadsDir } from '../../apps/api/src/config/storage';
import { formatCredentialSources, getMongoUrlFromEnv } from './mongoUrl';

type AuditCategory =
  | 'valid_s3'
  | 'legacy_local'
  | 'broken_ref'
  | 'missing_file_doc';

type AuditStats = Record<AuditCategory, number>;

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

const classifyRecord = (
  value: string,
  existingFileIds: Set<string>,
): { category: AuditCategory; fileId: string | null } => {
  if (isLegacyLocalReference(value)) {
    return { category: 'legacy_local', fileId: null };
  }
  const fileId = extractFileIdFromUrl(value);
  if (!fileId) {
    return { category: 'missing_file_doc', fileId: null };
  }
  const normalizedFileId = normalizeObjectId(fileId);
  if (!normalizedFileId) {
    return { category: 'missing_file_doc', fileId: null };
  }
  if (!existingFileIds.has(normalizedFileId)) {
    return { category: 'broken_ref', fileId: normalizedFileId };
  }
  return { category: 'valid_s3', fileId: normalizedFileId };
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

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

async function main(): Promise<void> {
  await connectMongo();

  try {
    const stats: AuditStats = {
      valid_s3: 0,
      legacy_local: 0,
      broken_ref: 0,
      missing_file_doc: 0,
    };
    const samples: Partial<Record<AuditCategory, string>> = {};
    const uniqueTaskIds = new Set<string>();

    const fileIds = new Set<string>();
    const files = await File.find().select(['_id']).lean();
    files.forEach((file) => {
      const id = normalizeObjectId(file._id);
      if (id) {
        fileIds.add(id);
      }
    });

    const cursor = Task.find()
      .select(['_id', 'attachments', 'files'])
      .lean()
      .cursor();

    for await (const task of cursor) {
      const taskId = normalizeObjectId(task._id);
      if (taskId) {
        uniqueTaskIds.add(taskId);
      }

      const refs: string[] = [];
      const attachments = Array.isArray(task.attachments)
        ? (task.attachments as Attachment[])
        : [];
      attachments.forEach((attachment) => {
        if (attachment && typeof attachment.url === 'string') {
          const trimmed = attachment.url.trim();
          if (trimmed) refs.push(trimmed);
        }
      });

      if (isStringArray(task.files)) {
        task.files.forEach((entry) => {
          const trimmed = entry.trim();
          if (trimmed) refs.push(trimmed);
        });
      }

      refs.forEach((ref) => {
        const classification = classifyRecord(ref, fileIds);
        stats[classification.category] += 1;
        if (!samples[classification.category]) {
          samples[classification.category] = taskId ?? ref;
        }
      });
    }

    console.log(
      JSON.stringify(
        {
          scanned_tasks: uniqueTaskIds.size,
          categories: stats,
          sample_id: samples,
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
  console.error('Ошибка audit_storage_records:', error);
  process.exit(1);
});
