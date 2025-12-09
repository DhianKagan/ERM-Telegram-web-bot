// apps/worker/src/tasks/geocoding.ts
import type { Job } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../logger';
import {
  parsePointInput,
  LatLng,
} from '../utils/geo'; // локальная реализация в воркере

const REDIS_URL = process.env.QUEUE_REDIS_URL || process.env.REDIS_URL;
const GEO_URL = process.env.GEOCODER_URL || process.env.ROUTING_URL;
const PROXY_TOKEN = process.env.GEOCODER_PROXY_TOKEN || process.env.PROXY_TOKEN;

type JsonObject = Record<string, unknown>;
type NullableLatLng = LatLng | null | undefined;

/**
 * Преобразование значения к LatLng через parsePointInput и строгую валидацию.
 */
function normalizeToLatLng(value: unknown): NullableLatLng {
  const parsed = parsePointInput(value);
  if (!parsed) return null;
  return parsed;
}

/**
 * Выполнить HTTP-запрос к прокси/ORS и попытаться извлечь координаты.
 * Возвращает LatLng или null.
 */
async function fetchGeocodeFromProxy(text: string): Promise<LatLng | null> {
  if (!GEO_URL) {
    logger.warn('GEOCODER_URL not configured');
    return null;
  }

  try {
    const url = new URL(GEO_URL.replace(/\/+$/, ''));
    if (!url.pathname.endsWith('/search')) url.pathname = url.pathname.replace(/\/+$/, '') + '/search';
    url.searchParams.set('text', text);

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (PROXY_TOKEN) headers['X-Proxy-Token'] = PROXY_TOKEN;

    const resp = await fetch(url.toString(), { method: 'GET', headers });
    if (!resp.ok) {
      logger.warn({ status: resp.status, url: url.toString() }, 'geocode proxy non-OK');
      return null;
    }

    const body = (await resp.json().catch((e: unknown) => {
      logger.warn({ err: stringifyError(e) }, 'geocode proxy: failed to parse JSON');
      return null;
    })) as unknown;

    if (!body) return null;

    // Helper to safely access nested properties as unknown and then try parse
    const tryExtractLatLng = (candidate: unknown): LatLng | null => normalizeToLatLng(candidate);

    // GeoJSON features -> geometry.coordinates [lon, lat]
    if (isJsonObject(body) && Array.isArray((body as JsonObject).features)) {
      const features = (body as JsonObject).features as unknown;
      if (Array.isArray(features) && features.length > 0) {
        const f = features[0] as JsonObject;
        const coords = safeGetArray<number>(f, ['geometry', 'coordinates']);
        if (coords && coords.length >= 2) {
          const [lon, lat] = coords;
          return tryExtractLatLng(`${lat},${lon}`);
        }
      }
    }

    // OSRM-like waypoints: location [lon,lat] or location.lat/location.lng
    if (isJsonObject(body) && Array.isArray((body as JsonObject).waypoints)) {
      const waypoints = (body as JsonObject).waypoints as unknown;
      if (Array.isArray(waypoints) && waypoints.length > 0) {
        const w = waypoints[0] as JsonObject;
        const locArr = safeGetArray<number>(w, ['location']);
        if (locArr && locArr.length >= 2) {
          const [lon, lat] = locArr;
          return tryExtractLatLng(`${lat},${lon}`);
        }
        const latVal = safeGetNumber(w, ['location', 'lat']) ?? safeGetNumber(w, ['location', 'latitude']);
        const lngVal = safeGetNumber(w, ['location', 'lng']) ?? safeGetNumber(w, ['location', 'lon']);
        if (isFiniteNumber(latVal) && isFiniteNumber(lngVal)) {
          return tryExtractLatLng({ lat: latVal, lng: lngVal });
        }
      }
    }

    // Generic results[] or results[0].geometry.lat/lng or results[0].lat/lon
    if (isJsonObject(body) && Array.isArray((body as JsonObject).results)) {
      const results = (body as JsonObject).results as unknown;
      if (Array.isArray(results) && results.length > 0) {
        const r = results[0] as JsonObject;
        const latVal = safeGetNumber(r, ['geometry', 'lat']) ?? safeGetNumber(r, ['lat']);
        const lngVal = safeGetNumber(r, ['geometry', 'lng']) ?? safeGetNumber(r, ['lon']) ?? safeGetNumber(r, ['lng']);
        if (isFiniteNumber(latVal) && isFiniteNumber(lngVal)) {
          return tryExtractLatLng({ lat: latVal, lng: lngVal });
        }
      }
    }

    // root lat/lng
    if (isJsonObject(body)) {
      const latVal = safeGetNumber(body, ['lat']);
      const lngVal = safeGetNumber(body, ['lng']) ?? safeGetNumber(body, ['lon']);
      if (isFiniteNumber(latVal) && isFiniteNumber(lngVal)) {
        return tryExtractLatLng({ lat: latVal, lng: lngVal });
      }
    }

    return null;
  } catch (err: unknown) {
    logger.error({ err: stringifyError(err) }, 'fetchGeocodeFromProxy error');
    return null;
  }
}

/**
 * Попытаться найти координаты в задаче:
 * 1) root поля startCoordinates / finishCoordinates
 * 2) history[].changes.to (реверсно)
 */
function findCoordsInTask(task: JsonObject): { start?: LatLng | null; finish?: LatLng | null } {
  const result: { start?: LatLng | null; finish?: LatLng | null } = {};

  const rootStart = normalizeToLatLng((task as JsonObject).startCoordinates);
  const rootFinish = normalizeToLatLng((task as JsonObject).finishCoordinates);
  if (rootStart) result.start = rootStart;
  if (rootFinish) result.finish = rootFinish;

  if ((!result.start || !result.finish) && Array.isArray(task.history)) {
    const hist = task.history as unknown[];
    for (let i = hist.length - 1; i >= 0; i -= 1) {
      const entry = hist[i] as JsonObject | undefined;
      const changes = entry?.changes as JsonObject | undefined;
      const to = changes?.to as JsonObject | undefined;
      if (!result.start && to && 'startCoordinates' in to) {
        const maybe = normalizeToLatLng(to.startCoordinates);
        if (maybe) result.start = maybe;
      }
      if (!result.finish && to && 'finishCoordinates' in to) {
        const maybe = normalizeToLatLng(to.finishCoordinates);
        if (maybe) result.finish = maybe;
      }
      if (result.start && result.finish) break;
    }
  }
  return result;
}

/**
 * Persist coordinates into tasks collection:
 * - sets startCoordinates/finishCoordinates as objects {lat,lng}
 * - sets route_nodes = [{location:[lon,lat], name: 'start'|'finish'}]
 */
async function persistCoords(db: unknown, taskId: string, start?: LatLng | null, finish?: LatLng | null): Promise<boolean> {
  // Expect db to be a MongoDB Db instance (but type unknown here)
  if (!db || typeof taskId !== 'string') return false;
  // We assume db.collection exists; perform runtime checks to keep TS strict
  const maybeCollectionFn = (db as { collection?: unknown }).collection;
  if (typeof maybeCollectionFn !== 'function') return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tasksColl = (db as any).collection('tasks');
  const update: JsonObject = {};
  const nodes: Array<{ location: [number, number]; name: string }> = [];
  if (start) {
    update.startCoordinates = { lat: start.lat, lng: start.lng };
    nodes.push({ location: [start.lng, start.lat], name: 'start' });
  }
  if (finish) {
    update.finishCoordinates = { lat: finish.lat, lng: finish.lng };
    nodes.push({ location: [finish.lng, finish.lat], name: 'finish' });
  }
  if (nodes.length) update.route_nodes = nodes;
  if (Object.keys(update).length === 0) return false;

  // Use runtime ObjectId from mongodb driver (we import mongodb dynamically where needed)
  // Here tasksColl.updateOne is invoked directly
  await tasksColl.updateOne({ _id: (db as any).bson.ObjectId ? new (db as any).bson.ObjectId(taskId) : taskId }, { $set: update });
  return true;
}

/**
 * Enqueue routing recalculation via Redis/BullMQ
 */
async function enqueueRouting(taskId: string): Promise<void> {
  if (!REDIS_URL) return;
  try {
    // dynamic import of bullmq to avoid top-level build-time dependency issues
    const { Queue } = await import('bullmq');
    const q = new Queue('logistics-routing', { connection: new IORedis(REDIS_URL) });
    await q.add('routing-task', { taskId }, { attempts: 3, removeOnComplete: true });
    logger.info({ taskId }, 'Enqueued routing task');
  } catch (err: unknown) {
    logger.warn({ err: stringifyError(err), taskId }, 'enqueueRouting failed');
  }
}

/**
 * Главная экспортируемая функция — ожидается worker index'ом.
 */
export async function geocodeAddress(job: Job): Promise<void> {
  const data = job?.data ?? {};
  const taskId = (data as Record<string, unknown>).taskId ?? (data as Record<string, unknown>).id ?? (data as Record<string, unknown>)._id;
  if (!taskId || typeof taskId !== 'string') throw new Error('geocodeAddress: missing taskId');

  const mongoUrl = process.env.MONGO_DATABASE_URL;
  if (!mongoUrl) {
    logger.error('MONGO_DATABASE_URL not configured');
    throw new Error('MONGO_DATABASE_URL not configured');
  }

  // Dynamic import of mongodb to avoid top-level type/dependency issues
  const mongodb = await import('mongodb');
  const { MongoClient, ObjectId } = mongodb;
  const client = new MongoClient(mongoUrl, { connectTimeoutMS: 10000 });
  try {
    await client.connect();
    const db = client.db();
    const tasksColl = db.collection('tasks');

    const rawTask = await tasksColl.findOne({ _id: new ObjectId(String(taskId)) });
    if (!rawTask) {
      logger.warn({ taskId }, 'geocodeAddress: task not found');
      return;
    }

    const task = rawTask as JsonObject;
    let { start, finish } = findCoordsInTask(task);

    // If job provided address, try it first
    if ((!start || !finish) && (data as Record<string, unknown>).address) {
      try {
        const parsed = await fetchGeocodeFromProxy(String((data as Record<string, unknown>).address));
        if (parsed && !start) start = parsed;
      } catch (err: unknown) {
        logger.warn({ err: stringifyError(err) }, 'Error geocoding job-provided address');
      }
    }

    // Try geocoding by start_location / end_location
    if (!start && typeof task.start_location === 'string') {
      start = await fetchGeocodeFromProxy(task.start_location as string);
    }
    if (!finish && typeof task.end_location === 'string') {
      finish = await fetchGeocodeFromProxy(task.end_location as string);
    }

    if (start || finish) {
      // persist
      const persisted = await persistCoords(db as unknown, String(taskId), start ?? null, finish ?? null);
      if (persisted) {
        await enqueueRouting(String(taskId));
        logger.info({ taskId, start, finish }, 'geocodeAddress: persisted coords and enqueued routing');
      } else {
        logger.info({ taskId }, 'geocodeAddress: nothing persisted');
      }
    } else {
      logger.warn({ taskId, start, finish }, 'geocodeAddress: no coords found after attempts, throwing to retry');
      throw new Error('No coordinates obtained for task ' + taskId);
    }
  } catch (err: unknown) {
    logger.error({ err: stringifyError(err), jobId: job?.id, taskId }, 'geocodeAddress error');
    throw err;
  } finally {
    await client.close().catch(() => undefined);
  }
}

/* ---------------- Helpers ------------------ */

function isJsonObject(v: unknown): v is JsonObject {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

function safeGetArray<T>(obj: JsonObject, path: string[]): T[] | null {
  let cur: unknown = obj;
  for (const seg of path) {
    if (!isJsonObject(cur)) return null;
    cur = cur[seg as keyof JsonObject];
  }
  return Array.isArray(cur) ? (cur as T[]) : null;
}

function safeGetNumber(obj: JsonObject, path: string[]): number | null {
  let cur: unknown = obj;
  for (const seg of path) {
    if (!isJsonObject(cur)) return null;
    cur = cur[seg as keyof JsonObject];
  }
  if (typeof cur === 'number') return cur;
  const n = Number(cur as unknown);
  return Number.isFinite(n) ? n : null;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function stringifyError(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}\n${e.stack ?? ''}`;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
