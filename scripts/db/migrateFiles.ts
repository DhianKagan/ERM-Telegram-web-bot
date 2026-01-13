// Миграция MongoDB: унификация структуры файлов
// Основные модули: mongoose, dotenv, модели проекта
import mongoose from 'mongoose';
import 'dotenv/config';
import '../../apps/api/src/db/model';

type FileDoc = {
  _id: mongoose.Types.ObjectId;
  taskId?: mongoose.Types.ObjectId | null;
  relatedTaskIds?: mongoose.Types.ObjectId[] | null;
  draftId?: mongoose.Types.ObjectId | null;
  scope?: unknown;
  detached?: unknown;
  telegramFileId?: unknown;
};

const allowedScopes = new Set(['task', 'draft', 'user', 'telegram', 'global']);

const normalizeObjectIdHex = (value: unknown): string | null => {
  if (value instanceof mongoose.Types.ObjectId) {
    return value.toHexString();
  }
  if (typeof value === 'string' && mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value).toHexString();
  }
  return null;
};

const normalizeRelatedTaskIds = (doc: FileDoc): mongoose.Types.ObjectId[] => {
  const normalized = new Map<string, mongoose.Types.ObjectId>();
  const add = (value: unknown) => {
    const hex = normalizeObjectIdHex(value);
    if (!hex) return;
    normalized.set(hex, new mongoose.Types.ObjectId(hex));
  };
  add(doc.taskId);
  if (Array.isArray(doc.relatedTaskIds)) {
    doc.relatedTaskIds.forEach((value) => add(value));
  }
  return Array.from(normalized.values());
};

const resolveScope = (doc: FileDoc): string => {
  const rawScope = typeof doc.scope === 'string' ? doc.scope.trim() : '';
  if (rawScope && allowedScopes.has(rawScope)) {
    return rawScope;
  }
  const hasDraft = Boolean(doc.draftId);
  const relatedIds = normalizeRelatedTaskIds(doc);
  const hasTask = Boolean(doc.taskId) || relatedIds.length > 0;
  const telegramId =
    typeof doc.telegramFileId === 'string' ? doc.telegramFileId.trim() : '';
  if (hasDraft) return 'draft';
  if (hasTask) return 'task';
  if (telegramId) return 'telegram';
  return 'user';
};

const files = mongoose.connection.db.collection<FileDoc>('files');
const cursor = files.find({});

let updated = 0;

for await (const doc of cursor) {
  const normalizedRelated = normalizeRelatedTaskIds(doc);
  const relatedHex = normalizedRelated.map((id) => id.toHexString());
  const existingRelated = Array.isArray(doc.relatedTaskIds)
    ? doc.relatedTaskIds
        .map((id) => normalizeObjectIdHex(id))
        .filter((id): id is string => Boolean(id))
    : [];
  const nextScope = resolveScope(doc);
  const hasTaskLink =
    Boolean(doc.taskId) || normalizedRelated.length > 0 || false;
  const hasDraft = Boolean(doc.draftId);
  const nextDetached = !hasTaskLink && !hasDraft;
  const telegramFileId =
    typeof doc.telegramFileId === 'string'
      ? doc.telegramFileId.trim() || null
      : doc.telegramFileId === null
        ? null
        : null;

  const set: Record<string, unknown> = {};
  const relatedChanged =
    relatedHex.length !== existingRelated.length ||
    relatedHex.some((id) => !existingRelated.includes(id));
  if (relatedChanged) {
    set.relatedTaskIds = normalizedRelated;
  }
  if (typeof doc.scope !== 'string' || doc.scope !== nextScope) {
    set.scope = nextScope;
  }
  if (typeof doc.detached !== 'boolean' || doc.detached !== nextDetached) {
    set.detached = nextDetached;
  }
  if (typeof doc.telegramFileId !== 'string' && doc.telegramFileId !== null) {
    set.telegramFileId = telegramFileId;
  }
  if (Object.keys(set).length === 0) {
    continue;
  }
  await files.updateOne({ _id: doc._id }, { $set: set });
  updated += 1;
}

console.log(`Обновлено файлов: ${updated}`);
process.exit(0);
