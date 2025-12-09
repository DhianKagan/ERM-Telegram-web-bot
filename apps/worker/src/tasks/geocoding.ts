// apps/worker/src/tasks/geocoding.ts
import type { Job } from 'bullmq';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { MongoClient, ObjectId } from 'mongodb';
import fetch from 'node-fetch';
import { logger } from '../logger';
import {
  parsePointInput,
  LatLng,
  latLngToLonLat,
} from '../../api/src/utils/geo'; // убедитесь, что путь корректный или скопируйте utils в worker
import type { TaskDocument } from '../../api/src/db/model'; // опционально, если есть тип

const REDIS_URL = process.env.QUEUE_REDIS_URL || process.env.REDIS_URL;
if (!REDIS_URL) {
  logger.warn('QUEUE_REDIS_URL not set — geocoding worker may not enqueue followups');
}

const GEO_URL = process.env.GEOCODER_URL || process.env.ROUTING_URL;
const PROXY_TOKEN = process.env.GEOCODER_PROXY_TOKEN || process.env.PROXY_TOKEN;

/**
 * Helper: fetch geocode from proxy/ORS
 * Returns LatLng | null
 */
async function fetchGeocodeFromProxy(text: string): Promise<LatLng | null> {
  if (!GEO_URL) {
    logger.warn('GEOCODER_URL not set; cannot fetch geocode');
    return null;
  }
  try {
    // build url — proxy expects /search?text=...
    const url = new URL(GEO_URL);
    // ensure path ends without trailing slash
    url.pathname = url.pathname.replace(/\/+$/, '');
    // If GEOCODER_URL points to /search already, we just set search param
    if (!url.pathname.endsWith('/search')) {
      // try to append /search
      url.pathname = url.pathname.replace(/\/+$/, '') + '/search';
    }
    url.searchParams.set('text', text);
    // Use token header
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (PROXY_TOKEN) headers['X-Proxy-Token'] = PROXY_TOKEN;
    const resp = await fetch(url.toString(), { headers, method: 'GET', timeout: 15000 });
    if (!resp.ok) {
      logger.warn({ status: resp.status, url: url.toString() }, 'Geocoder proxy returned non-OK');
      return null;
    }
    const body = await resp.json().catch((e) => {
      logger.warn({ err: e }, 'Failed to parse geocoder response as JSON');
      return null;
    });
    // ORS-like response: features or waypoints. Proxy in your project returned {features: [...] } ?
    // Try to be robust:
    if (!body) return null;
    // If response contains 'features' (GeoJSON)
    if (Array.isArray(body.features) && body.features.length > 0) {
      const f = body.features[0];
      if (f?.geometry?.coordinates && Array.isArray(f.geometry.coordinates)) {
        const [lon, lat] = f.geometry.coordinates;
        const parsed = parsePointInput(`${lat},${lon}`); // parsePointInput accepts lat,lng or JSON
        return parsed;
      }
    }
    // If proxy responds with waypoints array or 'features' alternative:
    if (Array.isArray(body.waypoints) && body.waypoints.length > 0) {
      const w = body.waypoints[0];
      // osrm-like: location: [lon,lat]
      if (Array.isArray(w.location) && w.location.length >= 2) {
        const [lon, lat] = w.location;
        const parsed = parsePointInput(`${lat},${lon}`);
        return parsed;
      }
      // ORS may return geometry.location lat/lng
      if (w?.location?.lat && w?.location?.lng) {
        const parsed = parsePointInput({ lat: w.location.lat, lng: w.location.lng });
        return parsed;
      }
    }
    // Some proxies return {results:[{geometry:{lat,lng}}]}
    if (Array.isArray(body.results) && body.results.length > 0) {
      const r = body.results[0];
      const lat = r?.geometry?.lat ?? r?.geometry?.location?.lat ?? r?.lat;
      const lng = r?.geometry?.lng ?? r?.geometry?.location?.lng ?? r?.lon ?? r?.lng;
      const parsed = parsePointInput({ lat, lng });
      if (parsed) return parsed;
    }
    // Fallback: if response has lat/lng fields at root
    if (body?.lat && body?.lng) {
      return parsePointInput({ lat: body.lat, lng: body.lng });
    }
    return null;
  } catch (err) {
    logger.error({ err }, 'fetchGeocodeFromProxy error');
    return null;
  }
}

/**
 * Find latest coordinates in task: root fields -> history (last to) -> null
 */
function findCoordsInTask(task: TaskDocument): { start?: LatLng | null; finish?: LatLng | null } {
  // try root
  const res: { start?: LatLng | null; finish?: LatLng | null } = {};
  try {
    const rootStart = parsePointInput((task as any).startCoordinates);
    const rootFinish = parsePointInput((task as any).finishCoordinates);
    if (rootStart) res.start = rootStart;
    if (rootFinish) res.finish = rootFinish;
  } catch {
    // ignore
  }
  // if missing, inspect history reversed
  if ((!res.start || !res.finish) && Array.isArray(task.history)) {
    for (let i = task.history.length - 1; i >= 0; i--) {
      const changes = (task.history[i] && (task.history[i] as any).changes && (task.history[i] as any).changes.to) || {};
      if (!res.start && changes && changes.startCoordinates) {
        const p = parsePointInput(changes.startCoordinates);
        if (p) res.start = p;
      }
      if (!res.finish && changes && changes.finishCoordinates) {
        const p = parsePointInput(changes.finishCoordinates);
        if (p) res.finish = p;
      }
      if (res.start && res.finish) break;
    }
  }
  return res;
}

/**
 * Persist coordinates into task document
 */
async function persistCoords(db: MongoClient['db'], taskId: string, start?: LatLng | null, finish?: LatLng | null) {
  const tasks = db.collection('tasks');
  const update: Record<string, unknown> = {};
  const nodes: Array<{ location: [number, number]; name?: string }> = [];
  if (start) {
    update.startCoordinates = { lat: start.lat, lng: start.lng };
    nodes.push({ location: latLngToLonLat([start.lng, start.lat] as any), name: 'start' });
  }
  if (finish) {
    update.finishCoordinates = { lat: finish.lat, lng: finish.lng };
    nodes.push({ location: latLngToLonLat([finish.lng, finish.lat] as any), name: 'finish' });
  }
  if (nodes.length) {
    update.route_nodes = nodes;
  }
  if (Object.keys(update).length === 0) return false;
  await tasks.updateOne({ _id: new ObjectId(taskId) }, { $set: update });
  return true;
}

/**
 * Enqueue routing job to recalc route/distance after coords applied.
 */
async function enqueueRouting(taskId: string) {
  if (!REDIS_URL) return;
  try {
    const q = new Queue('logistics-routing', { connection: new IORedis(REDIS_URL) });
    await q.add('routing-task', { taskId }, { attempts: 3, removeOnComplete: true });
    logger.info({ taskId }, 'Enqueued routing task');
  } catch (err) {
    logger.warn({ err, taskId }, 'Failed to enqueue routing task');
  }
}

/**
 * Main processor for geocoding job.
 * job.data should contain { taskId: string, address?: string }
 */
export async function geocodingProcessor(job: Job) {
  const data = job.data || {};
  const taskId = data.taskId || data.id || data._id;
  if (!taskId) {
    throw new Error('geocodingProcessor: missing taskId');
  }
  const mongoUrl = process.env.MONGO_DATABASE_URL;
  if (!mongoUrl) {
    logger.error('MONGO_DATABASE_URL not configured');
    throw new Error('MONGO_DATABASE_URL not configured');
  }

  const client = new MongoClient(mongoUrl, { connectTimeoutMS: 10000 });
  try {
    await client.connect();
    const db = client.db();

    // fetch task
    const tasks = db.collection('tasks');
    const task = await tasks.findOne({ _id: new ObjectId(taskId) }) as TaskDocument | null;
    if (!task) {
      logger.warn({ taskId }, 'geocodingProcessor: task not found');
      return;
    }

    let { start, finish } = findCoordsInTask(task);

    // If in job provided address, try geocode it
    if ((!start || !finish) && data.address) {
      const parsed = await fetchGeocodeFromProxy(String(data.address));
      if (parsed && !start) start = parsed;
      // if address intended as finish, job should include that; else both remain
    }

    // If still missing coordinates, try geocoding by task addresses (start_location / end_location)
    if (!start && task.start_location) {
      const parsed = await fetchGeocodeFromProxy(String(task.start_location));
      if (parsed) start = parsed;
    }
    if (!finish && task.end_location) {
      const parsed = await fetchGeocodeFromProxy(String(task.end_location));
      if (parsed) finish = parsed;
    }

    // If we have at least one coordinate, persist and enqueue routing
    if (start || finish) {
      const persisted = await persistCoords(db, String(taskId), start ?? null, finish ?? null);
      if (persisted) {
        await enqueueRouting(String(taskId));
        logger.info({ taskId, start, finish }, 'geocodingProcessor: persisted coords and enqueued routing');
      } else {
        logger.info({ taskId }, 'geocodingProcessor: nothing persisted (no coords)');
      }
    } else {
      // No coordinates found -> fail or re-attempt later
      logger.warn({ taskId, start, finish }, 'geocodingProcessor: no coords found after attempts');
      // Optionally requeue or throw to enable retry
      throw new Error('No coordinates obtained for task ' + taskId);
    }
  } catch (err) {
    logger.error({ err, jobId: job.id, taskId }, 'geocodingProcessor error');
    throw err;
  } finally {
    await client.close().catch(() => undefined);
  }
}
