// apps/worker/src/tasks/geocoding.ts
import type { Job } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../logger';
import { parsePointInput, type LatLng } from '../utils/geo';
import { extractCoords as sharedExtractCoords } from 'shared';
import type { GeocodingJobResult } from 'shared';

/**
 * Geocoding worker task (map-free).
 *
 * - Extracts coordinates from Google links / strings using shared.extractCoords (via parsePointInput).
 * - Does NOT call external geocoders / proxies.
 * - If taskId and MONGO_DATABASE_URL present — persists informational fields startCoordinates / finishCoordinates.
 * - Returns GeocodingJobResult = Coordinates | null (prefers `start` if present, otherwise `finish`, otherwise null).
 *
 * No `any` usage; MongoDB is dynamically imported and treated via minimal local interfaces.
 */

/** Minimal interface describing the shape of Mongo "collection" we need. */
interface TasksCollectionLike {
  findOne(query: unknown): Promise<unknown>;
  updateOne(filter: unknown, update: unknown): Promise<unknown>;
}

/** Minimal interface describing db we need */
interface DbLike {
  collection(name: string): TasksCollectionLike;
}

/** Normalize parse result to LatLng or null */
function normalizeToLatLng(value: unknown): LatLng | null {
  const parsed = parsePointInput(value);
  return parsed ?? null;
}

/** Try to extract coords using shared.extractCoords (may throw) and normalize. */
function tryExtractFromString(s: string | undefined): LatLng | null {
  if (!s || typeof s !== 'string' || s.trim().length === 0) return null;
  // First, try shared extractor
  try {
    const maybe = sharedExtractCoords(s);
    if (maybe && Number.isFinite(maybe.lat) && Number.isFinite(maybe.lng)) {
      return normalizeToLatLng({ lat: maybe.lat, lng: maybe.lng });
    }
  } catch (e) {
    // ignore extractor errors — fallback to parsePointInput
    logger.debug({ err: e }, 'shared.extractCoords threw, fallback to parsePointInput');
  }
  // fallback: parse raw as coordinate string
  return normalizeToLatLng(s);
}

/**
 * Persist start/finish coordinates into tasks collection.
 * Tries to use mongodb.ObjectId when possible; if mongodb isn't available uses string id filter.
 */
async function persistCoords(
  db: unknown,
  taskId: string,
  start: LatLng | null,
  finish: LatLng | null,
): Promise<boolean> {
  if (!db || typeof taskId !== 'string') return false;

  // minimal check for collection support
  const dbLike = db as DbLike;
  if (typeof dbLike.collection !== 'function') return false;

  const tasksColl = dbLike.collection('tasks');

  const update: Record<string, unknown> = {};
  if (start) update.startCoordinates = { lat: start.lat, lng: start.lng };
  if (finish) update.finishCoordinates = { lat: finish.lat, lng: finish.lng };

  if (Object.keys(update).length === 0) return false;

  // Build filter: prefer ObjectId(taskId) when mongodb available
  let filter: unknown = { _id: taskId };
  try {
    // dynamic import mongodb to construct ObjectId if available at runtime
    // We purposely do runtime import to avoid compile-time dependency on types.
    // Use unknown->as any casting internally, but not exported as any.
    // (This is only runtime; TypeScript does not require mongodb types here.)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    // Use dynamic import syntax
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - runtime import
    const mod = await import('mongodb');
    const ObjectIdCtor = (mod as unknown as { ObjectId?: new (s?: string) => unknown }).ObjectId;
    if (typeof ObjectIdCtor === 'function') {
      try {
        const oid = new ObjectIdCtor(taskId);
        filter = { _id: oid };
      } catch {
        // if ObjectId ctor throws for invalid id — fall back to string id
        filter = { _id: taskId };
      }
    }
  } catch {
    // mongodb not available or failed to import — fall back to string id filter
    filter = { _id: taskId };
  }

  await tasksColl.updateOne(filter, { $set: update });
  return true;
}

/**
 * Main exported function.
 * Accepts: Job or address string or undefined.
 * Returns: GeocodingJobResult (Coordinates | null)
 */
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

  // Do not fail if both missing — return null (task must not depend on coords)
  if (!taskIdFromJob && !addressFromJob) {
    return null;
  }

  const mongoUrl = process.env.MONGO_DATABASE_URL;
  let client: unknown = null;
  let db: unknown = null;
  let taskDoc: unknown | null = null;

  try {
    if (mongoUrl && taskIdFromJob) {
      // dynamic import mongodb at runtime only when we need to access DB
      const mod = await import('mongodb');
      const MongoClientCtor = (mod as unknown as { MongoClient: new (uri: string, options?: unknown) => unknown }).MongoClient;
      client = new MongoClientCtor(mongoUrl, { connectTimeoutMS: 10000 });
      // Use unknown typing for client; call connect + db via runtime calls
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await (client as { connect: () => Promise<unknown> }).connect();
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      db = (client as { db: (name?: string) => unknown }).db();
      // fetch task doc if present
      if (taskIdFromJob) {
        const tasksColl = (db as DbLike).collection('tasks');
        // Try to query by ObjectId if available
        let filter: unknown = { _id: taskIdFromJob };
        try {
          const ObjectIdCtor = (mod as unknown as { ObjectId?: new (s?: string) => unknown }).ObjectId;
          if (typeof ObjectIdCtor === 'function') {
            try {
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              filter = { _id: new ObjectIdCtor(String(taskIdFromJob)) };
            } catch {
              filter = { _id: taskIdFromJob };
            }
          }
        } catch {
          filter = { _id: taskIdFromJob };
        }
        taskDoc = (await tasksColl.findOne(filter)) ?? null;
        if (!taskDoc) {
          logger.info({ taskId: taskIdFromJob }, 'geocodeAddress: task not found — will proceed without persisting');
          taskDoc = null;
        }
      }
    }

    // gather coordinates
    let start: LatLng | null = null;
    let finish: LatLng | null = null;

    // 1) existing coords in task doc (informational)
    if (taskDoc && typeof taskDoc === 'object' && taskDoc !== null) {
      const td = taskDoc as Record<string, unknown>;
      if (td.startCoordinates) {
        const p = normalizeToLatLng(td.startCoordinates);
        if (p) start = p;
      }
      if (td.finishCoordinates) {
        const p = normalizeToLatLng(td.finishCoordinates);
        if (p) finish = p;
      }
    }

    // 2) try addressFromJob (shared.extractCoords or raw parse)
    if (addressFromJob) {
      const sc = tryExtractFromString(addressFromJob);
      if (sc && !start) start = sc;
    }

    // 3) check fields on task doc (start_location/end_location strings)
    if (taskDoc && typeof taskDoc === 'object' && taskDoc !== null) {
      const td = taskDoc as Record<string, unknown>;
      if (!start && typeof td.start_location === 'string' && td.start_location.trim().length > 0) {
        const sc = tryExtractFromString(td.start_location);
        if (sc) start = sc;
      }
      if (!finish && typeof td.end_location === 'string' && td.end_location.trim().length > 0) {
        const sc = tryExtractFromString(td.end_location);
        if (sc) finish = sc;
      }
    }

    // Normalize after all attempts
    if (start) start = normalizeToLatLng(start) ?? null;
    if (finish) finish = normalizeToLatLng(finish) ?? null;

    // Persist if we have DB and a taskId
    if ((start || finish) && db && typeof taskIdFromJob === 'string') {
      try {
        const ok = await persistCoords(db, String(taskIdFromJob), start, finish);
        if (ok) {
          logger.info({ taskId: taskIdFromJob, start, finish }, 'geocodeAddress: persisted coords (informational)');
        } else {
          logger.info({ taskId: taskIdFromJob }, 'geocodeAddress: nothing to persist');
        }
      } catch (e) {
        logger.warn({ err: e, taskId: taskIdFromJob }, 'geocodeAddress: failed to persist coords');
      }
    }

    // Return Coordinates | null per GeocodingJobResult
    return (start ?? finish ?? null) as GeocodingJobResult;
  } catch (e) {
    logger.error({ err: e }, 'geocodeAddress: unexpected error');
    // On error — fail gracefully and return null (task should not depend on coords)
    return null;
  } finally {
    // close client if opened
    try {
      if (client && typeof (client as { close?: () => Promise<unknown> }).close === 'function') {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        await (client as { close: () => Promise<unknown> }).close();
      }
    } catch {
      // ignore
    }
  }
}
