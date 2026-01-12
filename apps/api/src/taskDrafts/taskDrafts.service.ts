// apps/api/src/taskDrafts/taskDrafts.service.ts
import { Types } from 'mongoose';
import {
  TaskDraft,
  type TaskDraftDocument,
  type Attachment,
} from '../db/model';
import { coerceAttachments, extractAttachmentIds } from '../utils/attachments';
import {
  clearDraftForFile,
  deleteFile,
  findFilesByIds,
  setDraftForFiles,
} from '../services/fileService';
import { writeLog } from '../services/wgLogEngine';

const PRECISION_DECIMALS = Number(process.env.ROUTE_PRECISION_DECIMALS || '6');

/**
 * Безопасное округление координаты (локальная реализация).
 */
function safeRoundCoord(
  value: unknown,
  decimals = PRECISION_DECIMALS,
): number | null {
  const num = typeof value === 'number' ? value : Number(value as unknown);
  if (!Number.isFinite(num)) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeAttachments = (value: unknown): Attachment[] => {
  const parsed = coerceAttachments(value);
  return Array.isArray(parsed) ? parsed : [];
};

const objectIdSet = (ids: Types.ObjectId[]): Set<string> =>
  new Set(ids.map((id) => id.toHexString()));

/**
 * Try to coerce various input forms into a canonical { lat: number, lng: number } or null.
 * Accepts inputs of unknown type (we're defensive).
 */
function coercePoint(input: unknown): { lat: number; lng: number } | null {
  if (input == null) return null;

  // If it's an object with lat/lng-like fields
  if (typeof input === 'object' && !Array.isArray(input)) {
    const obj = input as Record<string, unknown>;
    const latCandidate = obj.lat ?? obj.latitude ?? obj.lat_deg ?? obj.y;
    const lngCandidate = obj.lng ?? obj.longitude ?? obj.lon ?? obj.x;
    const lat = safeRoundCoord(latCandidate);
    const lng = safeRoundCoord(lngCandidate);
    if (lat !== null && lng !== null) {
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
      return null;
    }

    // Try swapped keys (lng, lat)
    const lat2 = safeRoundCoord(obj.lng);
    const lng2 = safeRoundCoord(obj.lat);
    if (lat2 !== null && lng2 !== null) {
      if (lat2 >= -90 && lat2 <= 90 && lng2 >= -180 && lng2 <= 180) {
        return { lat: lat2, lng: lng2 };
      }
    }
    return null;
  }

  // If it's an array [a,b]
  if (Array.isArray(input) && input.length >= 2) {
    const a = safeRoundCoord(input[0]);
    const b = safeRoundCoord(input[1]);
    if (a !== null && b !== null) {
      // prefer lat,lng
      if (a >= -90 && a <= 90 && b >= -180 && b <= 180) {
        return { lat: a, lng: b };
      }
      // try lng,lat
      if (b >= -90 && b <= 90 && a >= -180 && a <= 180) {
        return { lat: b, lng: a };
      }
    }
    return null;
  }

  // If it's a string
  if (typeof input === 'string') {
    const s = input.trim();
    // try JSON
    if (s.startsWith('{') && s.endsWith('}')) {
      try {
        const parsed = JSON.parse(s);
        return coercePoint(parsed);
      } catch {
        // pass through to comma-case
      }
    }
    // try "lat,lng" or "lng,lat"
    const sep = s.includes(',') ? ',' : s.includes(';') ? ';' : null;
    if (sep) {
      const parts = s
        .split(sep)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 2) {
        const a = safeRoundCoord(parts[0]);
        const b = safeRoundCoord(parts[1]);
        if (a !== null && b !== null) {
          if (a >= -90 && a <= 90 && b >= -180 && b <= 180) {
            return { lat: a, lng: b }; // lat,lng
          }
          if (b >= -90 && b <= 90 && a >= -180 && a <= 180) {
            return { lat: b, lng: a }; // lng,lat
          }
        }
      }
    }
    return null;
  }

  return null;
}

export default class TaskDraftsService {
  async getDraft(
    userId: number,
    kind: 'task' | 'request',
  ): Promise<TaskDraftDocument | null> {
    return TaskDraft.findOne({ userId, kind }).lean<TaskDraftDocument | null>();
  }

  /**
   * Нормализует полезную нагрузку черновика:
   * - attachments: приводит к массиву Attachment
   * - startCoordinates / finishCoordinates: приводит к {lat,lng} или удаляет
   * - route_distance_km: если не число, приводит к null
   * - сохраняет прочие поля как есть
   */
  private normalizePayload(payload: unknown): Record<string, unknown> {
    if (!isPlainObject(payload)) {
      return {};
    }
    const copy: Record<string, unknown> = {
      ...(payload as Record<string, unknown>),
    };

    // attachments
    const attachments = normalizeAttachments(copy.attachments);
    copy.attachments = attachments;

    // Coordinates normalization (input can be unknown)
    const scRaw = copy.startCoordinates as unknown;
    const fcRaw = copy.finishCoordinates as unknown;

    const sc = coercePoint(scRaw); // now accepts unknown
    const fc = coercePoint(fcRaw);

    if (sc !== null) {
      copy.startCoordinates = { lat: sc.lat, lng: sc.lng };
    } else {
      if ('startCoordinates' in copy) copy.startCoordinates = undefined;
    }

    if (fc !== null) {
      copy.finishCoordinates = { lat: fc.lat, lng: fc.lng };
    } else {
      if ('finishCoordinates' in copy) copy.finishCoordinates = undefined;
    }

    // route_distance_km: ensure numeric or null
    if (Object.prototype.hasOwnProperty.call(copy, 'route_distance_km')) {
      const raw = copy.route_distance_km;
      const val = typeof raw === 'number' ? raw : Number(raw as unknown);
      copy.route_distance_km = Number.isFinite(val) ? val : null;
    }

    return copy;
  }

  async saveDraft(
    userId: number,
    kind: 'task' | 'request',
    payload: unknown,
  ): Promise<TaskDraftDocument> {
    const normalizedPayload = this.normalizePayload(payload);
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
      await setDraftForFiles(newIds, userId, draft._id);
    }

    const previousSet = objectIdSet(previousIds);
    const currentSet = objectIdSet(newIds);
    const removedIds = Array.from(previousSet).filter(
      (id) => !currentSet.has(id),
    );
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
    if (ids.length === 0) {
      return;
    }

    const relatedFiles = await findFilesByIds(ids);
    const attachedIds = new Set(
      relatedFiles.filter((doc) => doc.taskId).map((doc) => String(doc._id)),
    );

    await Promise.all(
      ids.map(async (id) => {
        const idHex = id.toHexString();
        if (attachedIds.has(idHex)) {
          await clearDraftForFile(id);
          return;
        }
        try {
          await deleteFile(idHex);
        } catch (error) {
          const err = error as NodeJS.ErrnoException;
          if (err.code !== 'ENOENT') {
            await writeLog('Ошибка удаления вложения черновика', 'warn', {
              fileId: idHex,
              error: err?.message || String(error),
            }).catch(() => undefined);
          }
        }
      }),
    );
  }
}
