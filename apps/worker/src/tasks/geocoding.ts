// apps/worker/src/tasks/geocoding.ts
import type { Job } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../logger';
import { parsePointInput, LatLng } from '../utils/geo';
import type { GeocodingJobResult } from 'shared';

const REDIS_URL = process.env.QUEUE_REDIS_URL || process.env.REDIS_URL;
const GEO_URL = process.env.GEOCODER_URL || process.env.ROUTING_URL;
const PROXY_TOKEN = process.env.GEOCODER_PROXY_TOKEN || process.env.PROXY_TOKEN;

type JsonObject = Record<string, unknown>;

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

function stringifyError(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}\n${e.stack ?? ''}`;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function normalizeToLatLng(value: unknown): LatLng | null {
  const parsed = parsePointInput(value);
  return parsed ?? null;
}

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

    if (isJsonObject(body) && Array.isArray((body as JsonObject).features)) {
      const features = (body as JsonObject).features as unknown;
      if (Array.isArray(features) && features.length > 0) {
        const f = features[0] as JsonObject;
        const coords = safeGetArray<number>(f, ['geometry', 'coordinates']);
        if (coords && coords.length >= 2) {
          const [lon, lat] = coords;
          return normalizeToLatLng(`${lat},${lon}`);
        }
      }
    }

    if (isJsonObject(body) && Array.isArray((body as JsonObject).waypoints)) {
      const waypoints = (body as JsonObject).waypoints as unknown;
      if (Array.isArray(waypoints) && waypoints.length > 0) {
        const w = waypoints[0] as JsonObject;
        const locArr = safeGetArray<number>(w, ['location']);
        if (locArr && locArr.length >= 2) {
          const [lon, lat] = locArr;
          return normalizeToLatLng(`${lat},${lon}`);
        }
        const latVal = safeGetNumber(w, ['location', 'lat']) ?? safeGetNumber(w, ['location', 'latitude']);
        const lngVal = safeGetNumber(w, ['location', 'lng']) ?? safeGetNumber(w, ['location', 'lon']);
        if (latVal !== null && lngVal !== null) return normalizeToLatLng({ lat: latVal, lng: lngVal });
      }
    }

    if (isJsonObject(body) && Array.isArray((body as JsonObject).results)) {
      const results = (body as JsonObject).results as unknown;
      if (Array.isArray(results) && results.length > 0) {
        const r = results[0] as JsonObject;
        const latVal = safeGetNumber(r, ['geometry', 'lat']) ?? safeGetNumber(r, ['lat']);
        const lngVal = safeGetNumber(r, ['geometry', 'lng']) ?? safeGetNumber(r, ['lon']) ?? safeGetNumber(r, ['lng']);
        if (latVal !== null && lngVal !== null) return normalizeToLatLng({ lat: latVal, lng: lngVal });
      }
    }

    if (isJsonObject(body)) {
      const latVal = safeGetNumber(body, ['lat']);
      const lngVal = safeGetNumber(body, ['lng']) ?? safeGetNumber(body, ['lon']);
      if (latVal !== null && lngVal !== null) return normalizeToLatLng({ lat: latVal, lng: lngVal });
    }

    return null;
  } catch (e: unknown) {
    logger.error({ err: stringifyError(e) }, 'fetchGeocodeFromProxy error');
    return null;
  }
}

function findCoordsInTask(task: JsonObject): { start: LatLng | null; finish: LatLng | null } {
  const result: { start: LatLng | null; finish: LatLng | null } = { start: null, finish: null };

  const rootStart = normalizeToLatLng(task.startCoordinates);
  const rootFinish = normalizeToLatLng(task.finishCoordinates);
  if (rootStart) result.start = rootStart;
  if (rootFinish) result.finish = rootFinish;

  if ((!result.start || !result.finish) && Array.isArray(task.history)) {
    const hist = task.history as unknown[];
    for (let i = hist.length - 1; i >= 0; i -= 1) {
      const entry = hist[i] as JsonObject | undefined;
      // FIX: safe access to changes.to — ensure types
      const changes = isJsonObject(entry?.changes) ? (entry!.changes as JsonObject) : undefined;
      const to = isJsonObject(changes?.to) ? (changes!.to as JsonObject) : undefined; // FIX
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

async function persistCoords(db: unknown, taskId: string, start: LatLng | null, finish: LatLng | null): Promise<boolean> {
  if (!db || typeof taskId !== 'string') return false;
  const maybeColl = (db as { collection?: unknown }).collection;
  if (typeof maybeColl !== 'function') return false;
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

  await tasksColl.updateOne({ _id: (db as any).bson && (db as any).bson.ObjectId ? new (db as any).bson.ObjectId(taskId) : taskId }, { $set: update });
  return true;
}

async function enqueueRouting(taskId: string): Promise<void> {
  if (!REDIS_URL) return;
  try {
    const { Queue } = await import('bullmq');
    const q = new Queue('logistics-routing', { connection: new IORedis(REDIS_URL) });
    await q.add('routing-task', { taskId }, { attempts: 3, removeOnComplete: true });
    logger.info({ taskId }, 'Enqueued routing task');
  } catch (e: unknown) {
    logger.warn({ err: stringifyError(e), taskId }, 'enqueueRouting failed');
  }
}

/**
 * geocodeAddress: accepts Job or (address, config)
 * returns GeocodingJobResult
 */
export async function geocodeAddress(jobOrAddress: Job | string | undefined, maybeConfig?: unknown): Promise<GeocodingJobResult> {
  let addressFromJob: string | undefined;
  let taskIdFromJob: string | undefined;

  if (typeof jobOrAddress === 'string' || jobOrAddress === undefined) {
    addressFromJob = jobOrAddress;
  } else {
    const job = jobOrAddress as Job;
    const d = job.data as Record<string, unknown>;
    taskIdFromJob = typeof d.taskId === 'string' ? d.taskId : (typeof d.id === 'string' ? d.id : (typeof d._id === 'string' ? d._id : undefined));
    addressFromJob = typeof d.address === 'string' ? d.address : undefined;
  }

  if (!taskIdFromJob && !addressFromJob) {
    throw new Error('geocodeAddress: missing both taskId and address');
  }

  const mongoUrl = process.env.MONGO_DATABASE_URL;
  if (!mongoUrl) {
    logger.error('MONGO_DATABASE_URL not configured');
    throw new Error('MONGO_DATABASE_URL not configured');
  }

  // @ts-ignore dynamic import to avoid build-type dependency
  const mongodb = await import('mongodb');
  const MongoClient = (mongodb as any).MongoClient;
  const ObjectId = (mongodb as any).ObjectId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = new (MongoClient as any)(mongoUrl, { connectTimeoutMS: 10000 });
  try {
    await client.connect();
    const db = client.db();
    let task: JsonObject | null = null;
    if (taskIdFromJob) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tasksColl = (db as any).collection('tasks');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      task = (await tasksColl.findOne({ _id: new (ObjectId as any)(String(taskIdFromJob)) })) as JsonObject | null;
      if (!task) {
        logger.warn({ taskId: taskIdFromJob }, 'geocodeAddress: task not found');
        throw new Error('Task not found ' + taskIdFromJob);
      }
    }

    let start: LatLng | null = null;
    let finish: LatLng | null = null;

    if (task) {
      const found = findCoordsInTask(task);
      start = found.start;
      finish = found.finish;
    }

    if ((!start || !finish) && addressFromJob) {
      const parsed = await fetchGeocodeFromProxy(String(addressFromJob));
      if (parsed && !start) start = parsed;
    }

    if (task && (!start || !finish)) {
      if (!start && typeof task.start_location === 'string') {
        start = await fetchGeocodeFromProxy(task.start_location as string);
      }
      if (!finish && typeof task.end_location === 'string') {
        finish = await fetchGeocodeFromProxy(task.end_location as string);
      }
    }

    if (start || finish) {
      if (task && taskIdFromJob) {
        const persisted = await persistCoords(db, String(taskIdFromJob), start, finish);
        if (persisted) {
          await enqueueRouting(String(taskIdFromJob));
          logger.info({ taskId: taskIdFromJob, start, finish }, 'geocodeAddress: persisted coords and enqueued routing');
        } else {
          logger.info({ taskId: taskIdFromJob }, 'geocodeAddress: nothing persisted');
        }
      }
      // FIX: cast to GeocodingJobResult to satisfy TS definitions
      return { start: start ?? null, finish: finish ?? null } as unknown as GeocodingJobResult;
    }

    logger.warn({ taskId: taskIdFromJob }, 'geocodeAddress: no coords found');
    throw new Error('No coordinates obtained');
  } catch (err: unknown) {
    logger.error({ err: stringifyError(err) }, 'geocodeAddress error');
    throw err;
  } finally {
    await client.close().catch(() => undefined);
  }
}
