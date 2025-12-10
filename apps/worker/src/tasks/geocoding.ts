// apps/worker/src/tasks/geocoding.ts
import type { Job } from 'bullmq';
import { MongoClient, ObjectId, Db, WithId, Document } from 'mongodb';
import { logger } from '../logger';
import { parsePointInput, LatLng } from '../utils/geo';
import { extractCoords as sharedExtractCoords } from 'shared';
import type { TaskDocument } from '../../api/src/db/model';
import type { GeocodingJobResult } from 'shared';

/**
 * Этот модуль извлекает координаты только из ссылок/строк через shared.extractCoords
 * и сохраняет их в задаче как информационное поле. Никакой внешней геокодер-зависимости.
 */

function normalizeToLatLng(value: unknown): LatLng | null {
  return parsePointInput(value);
}

async function persistCoords(db: Db, taskId: string, start: LatLng | null, finish: LatLng | null): Promise<boolean> {
  if (!taskId) return false;
  const tasksColl = db.collection<TaskDocument>('tasks');
  const update: Partial<TaskDocument> = {};

  if (start) {
    update.startCoordinates = { lat: start.lat, lng: start.lng };
  }
  if (finish) {
    update.finishCoordinates = { lat: finish.lat, lng: finish.lng };
  }

  if (Object.keys(update).length === 0) return false;

  const _id = new ObjectId(taskId);
  await tasksColl.updateOne({ _id }, { $set: update });
  return true;
}

export async function geocodeAddress(jobOrAddress: Job | string | undefined): Promise<GeocodingJobResult> {
  let addressFromJob: string | undefined;
  let taskIdFromJob: string | undefined;

  if (typeof jobOrAddress === 'string' || jobOrAddress === undefined) {
    addressFromJob = jobOrAddress;
  } else {
    const job = jobOrAddress as Job;
    const d = job.data as Record<string, unknown>;
    taskIdFromJob =
      typeof d.taskId === 'string'
        ? d.taskId
        : typeof d.id === 'string'
        ? d.id
        : typeof d._id === 'string'
        ? d._id
        : undefined;
    addressFromJob = typeof d.address === 'string' ? d.address : undefined;
  }

  // Если нет taskId и нет адреса — просто возвращаем пустой результат (задача не должна зависеть от координат)
  if (!taskIdFromJob && !addressFromJob) {
    return { start: null, finish: null } as GeocodingJobResult;
  }

  const mongoUrl = process.env.MONGO_DATABASE_URL;
  if (!mongoUrl) {
    logger.warn('MONGO_DATABASE_URL not configured — cannot persist coords, will attempt extraction only');
  }

  let client: MongoClient | null = null;
  let db: Db | null = null;
  let taskDoc: WithId<TaskDocument> | null = null;
  try {
    if (mongoUrl && taskIdFromJob) {
      client = new MongoClient(mongoUrl, { connectTimeoutMS: 10000 });
      await client.connect();
      db = client.db();
      const tasksColl = db.collection<TaskDocument>('tasks');
      const _id = new ObjectId(String(taskIdFromJob));
      taskDoc = (await tasksColl.findOne({ _id })) ?? null;
      if (!taskDoc) {
        logger.info({ taskId: taskIdFromJob }, 'geocodeAddress: task not found — will proceed with extraction but not persist');
        taskDoc = null;
      }
    }

    // We'll try to obtain start/finish from multiple sources, but we won't require them.
    let start: LatLng | null = null;
    let finish: LatLng | null = null;

    // 1) If task doc has existing coordinates, keep them informationally
    if (taskDoc) {
      if (taskDoc.startCoordinates) {
        const p = normalizeToLatLng(taskDoc.startCoordinates);
        if (p) start = p;
      }
      if (taskDoc.finishCoordinates) {
        const p = normalizeToLatLng(taskDoc.finishCoordinates);
        if (p) finish = p;
      }
    }

    // 2) If job address provided — try to extract coords from the string via shared extractor
    if (addressFromJob) {
      try {
        const sc = sharedExtractCoords(addressFromJob);
        if (sc) {
          // fill start if not present
          if (!start) start = { lat: sc.lat, lng: sc.lng };
        }
      } catch (e) {
        logger.debug({ err: e }, 'shared.extractCoords threw while parsing addressFromJob — ignoring');
      }
    }

    // 3) Also check task.start_location / end_location fields (strings) if present and no coords yet
    if (taskDoc) {
      if (!start && typeof taskDoc.start_location === 'string' && taskDoc.start_location.trim()) {
        try {
          const sc = sharedExtractCoords(taskDoc.start_location);
          if (sc) start = { lat: sc.lat, lng: sc.lng };
        } catch (e) {
          logger.debug({ err: e, start_location: taskDoc.start_location }, 'shared.extractCoords threw on task.start_location — ignoring');
        }
      }
      if (!finish && typeof taskDoc.end_location === 'string' && taskDoc.end_location.trim()) {
        try {
          const sc = sharedExtractCoords(taskDoc.end_location);
          if (sc) finish = { lat: sc.lat, lng: sc.lng };
        } catch (e) {
          logger.debug({ err: e, end_location: taskDoc.end_location }, 'shared.extractCoords threw on task.end_location — ignoring');
        }
      }
    }

    // 4) Normalize any raw results (using parsePointInput)
    if (start) start = normalizeToLatLng(start) ?? null;
    if (finish) finish = normalizeToLatLng(finish) ?? null;

    // Persist only if we have taskId and at least one coord found
    if ((start || finish) && db && taskIdFromJob) {
      try {
        const persisted = await persistCoords(db, String(taskIdFromJob), start, finish);
        if (persisted) {
          logger.info({ taskId: taskIdFromJob, start, finish }, 'geocodeAddress: persisted coords (informational)');
        } else {
          logger.info({ taskId: taskIdFromJob }, 'geocodeAddress: nothing to persist');
        }
      } catch (e) {
        logger.warn({ err: e, taskId: taskIdFromJob }, 'geocodeAddress: failed to persist coords');
      }
    }

    // Return whatever coordinates we managed to extract (may be nulls)
    return { start: start ?? null, finish: finish ?? null } as GeocodingJobResult;
  } catch (e) {
    logger.error({ err: e }, 'geocodeAddress: unexpected error');
    return { start: null, finish: null } as GeocodingJobResult;
  } finally {
    if (client) {
      await client.close().catch(() => undefined);
    }
  }
}
