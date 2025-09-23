// Утилиты для работы со вложениями задач
// Основные модули: mongoose, db/model
import { Types } from 'mongoose';
import type { Attachment } from '../db/model';

/**
 * Извлекает ObjectId файлов из массива вложений задачи.
 * Допускает URL вида `/api/v1/files/<id>` с дополнительными параметрами.
 */
export function extractAttachmentIds(
  attachments: Attachment[] | undefined | null,
): Types.ObjectId[] {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return [];
  }
  const result: Types.ObjectId[] = [];
  const seen = new Set<string>();
  attachments.forEach((attachment) => {
    if (!attachment || typeof attachment.url !== 'string') return;
    const [pathPart] = attachment.url.trim().split('?');
    if (!pathPart) return;
    const segments = pathPart.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (!last || !Types.ObjectId.isValid(last)) return;
    const key = last.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(new Types.ObjectId(last));
  });
  return result;
}
