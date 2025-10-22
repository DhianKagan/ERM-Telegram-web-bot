// Сервис черновиков задач
// Основные модули: mongoose модели, утилиты вложений, сервис хранилища
import { Types } from 'mongoose';
import { TaskDraft, File, type TaskDraftDocument, type Attachment } from '../db/model';
import { coerceAttachments, extractAttachmentIds } from '../utils/attachments';
import { deleteFile } from '../services/dataStorage';
import { writeLog } from '../services/wgLogEngine';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizePayload = (
  payload: unknown,
): Record<string, unknown> => {
  if (!isPlainObject(payload)) {
    return {};
  }
  return { ...payload };
};

const normalizeAttachments = (value: unknown): Attachment[] => {
  const parsed = coerceAttachments(value);
  return Array.isArray(parsed) ? parsed : [];
};

const objectIdSet = (ids: Types.ObjectId[]): Set<string> =>
  new Set(ids.map((id) => id.toHexString()));

export default class TaskDraftsService {
  async getDraft(
    userId: number,
    kind: 'task' | 'request',
  ): Promise<TaskDraftDocument | null> {
    return TaskDraft.findOne({ userId, kind }).lean<TaskDraftDocument | null>();
  }

  async saveDraft(
    userId: number,
    kind: 'task' | 'request',
    payload: unknown,
  ): Promise<TaskDraftDocument> {
    const normalizedPayload = normalizePayload(payload);
    const attachments = normalizeAttachments(normalizedPayload.attachments);
    normalizedPayload.attachments = attachments;
    normalizedPayload.kind = kind;

    const existing = await TaskDraft.findOne({ userId, kind });
    const previousIds = existing
      ? extractAttachmentIds(existing.attachments || [])
      : [];

    const draft = await TaskDraft.findOneAndUpdate(
      { userId, kind },
      { $set: { payload: normalizedPayload, attachments } },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    ).exec();

    if (!draft) {
      throw new Error('Не удалось сохранить черновик');
    }

    const newIds = extractAttachmentIds(attachments);
    if (newIds.length > 0) {
      await File.updateMany(
        { _id: { $in: newIds }, userId },
        { $set: { draftId: draft._id }, $unset: { taskId: '' } },
      ).exec();
    }

    const previousSet = objectIdSet(previousIds);
    const currentSet = objectIdSet(newIds);
    const removedIds = Array.from(previousSet).filter((id) => !currentSet.has(id));
    await Promise.all(
      removedIds.map(async (id) => {
        try {
          await deleteFile(id);
        } catch (error) {
          const err = error as NodeJS.ErrnoException;
          if (err.code !== 'ENOENT') {
            await writeLog('Ошибка удаления файла черновика', 'warn', {
              fileId: id,
              error: err?.message || String(error),
            }).catch(() => undefined);
          }
        }
      }),
    );

    return draft;
  }

  async deleteDraft(userId: number, kind: 'task' | 'request'): Promise<void> {
    const draft = await TaskDraft.findOneAndDelete({ userId, kind }).exec();
    if (!draft) return;
    const ids = extractAttachmentIds(draft.attachments || []);
    await Promise.all(
      ids.map(async (id) => {
        try {
          await deleteFile(id.toHexString());
        } catch (error) {
          const err = error as NodeJS.ErrnoException;
          if (err.code !== 'ENOENT') {
            await writeLog('Ошибка удаления вложения черновика', 'warn', {
              fileId: id.toHexString(),
              error: err?.message || String(error),
            }).catch(() => undefined);
          }
        }
      }),
    );
  }
}
