"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.geocodeAddress = geocodeAddress;
const logger_1 = require("../logger");
const geo_1 = require("../utils/geo");
const shared_1 = require("shared");
/** Normalize parse result to LatLng or null */
function normalizeToLatLng(value) {
    const parsed = (0, geo_1.parsePointInput)(value);
    return parsed !== null && parsed !== void 0 ? parsed : null;
}
/** Try to extract coords using shared.extractCoords (may throw) and normalize. */
function tryExtractFromString(s) {
    if (!s || typeof s !== 'string' || s.trim().length === 0)
        return null;
    // First, try shared extractor
    try {
        const maybe = (0, shared_1.extractCoords)(s);
        if (maybe && Number.isFinite(maybe.lat) && Number.isFinite(maybe.lng)) {
            return normalizeToLatLng({ lat: maybe.lat, lng: maybe.lng });
        }
    }
    catch (e) {
        // ignore extractor errors — fallback to parsePointInput
        logger_1.logger.debug({ err: e }, 'shared.extractCoords threw, fallback to parsePointInput');
    }
    // fallback: parse raw as coordinate string
    return normalizeToLatLng(s);
}
/**
 * Persist start/finish coordinates into tasks collection.
 * Tries to use mongodb.ObjectId when possible; if mongodb isn't available uses string id filter.
 */
async function persistCoords(db, taskId, start, finish) {
    if (!db || typeof taskId !== 'string')
        return false;
    // minimal check for collection support
    const dbLike = db;
    if (typeof dbLike.collection !== 'function')
        return false;
    const tasksColl = dbLike.collection('tasks');
    const update = {};
    if (start)
        update.startCoordinates = { lat: start.lat, lng: start.lng };
    if (finish)
        update.finishCoordinates = { lat: finish.lat, lng: finish.lng };
    if (Object.keys(update).length === 0)
        return false;
    // Build filter: prefer ObjectId(taskId) when mongodb available
    let filter = { _id: taskId };
    try {
        // dynamic import mongodb to construct ObjectId if available at runtime
        // We purposely do runtime import to avoid compile-time dependency on types.
        // Use unknown->as any casting internally, but not exported as any.
        // (This is only runtime; TypeScript does not require mongodb types here.)
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        // Use dynamic import syntax
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - runtime import
        const mod = await Promise.resolve().then(() => __importStar(require('mongodb')));
        const ObjectIdCtor = mod.ObjectId;
        if (typeof ObjectIdCtor === 'function') {
            try {
                const oid = new ObjectIdCtor(taskId);
                filter = { _id: oid };
            }
            catch {
                // if ObjectId ctor throws for invalid id — fall back to string id
                filter = { _id: taskId };
            }
        }
    }
    catch {
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
async function geocodeAddress(jobOrAddress) {
    var _a, _b, _c, _d;
    let addressFromJob;
    let taskIdFromJob;
    if (typeof jobOrAddress === 'string' || jobOrAddress === undefined) {
        addressFromJob = jobOrAddress;
    }
    else {
        const job = jobOrAddress;
        const d = job.data;
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
    let client = null;
    let db = null;
    let taskDoc = null;
    try {
        if (mongoUrl && taskIdFromJob) {
            // dynamic import mongodb at runtime only when we need to access DB
            const mod = await Promise.resolve().then(() => __importStar(require('mongodb')));
            const MongoClientCtor = mod.MongoClient;
            client = new MongoClientCtor(mongoUrl, { connectTimeoutMS: 10000 });
            // Use unknown typing for client; call connect + db via runtime calls
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            await client.connect();
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            db = client.db();
            // fetch task doc if present
            if (taskIdFromJob) {
                const tasksColl = db.collection('tasks');
                // Try to query by ObjectId if available
                let filter = { _id: taskIdFromJob };
                try {
                    const ObjectIdCtor = mod.ObjectId;
                    if (typeof ObjectIdCtor === 'function') {
                        try {
                            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                            // @ts-ignore
                            filter = { _id: new ObjectIdCtor(String(taskIdFromJob)) };
                        }
                        catch {
                            filter = { _id: taskIdFromJob };
                        }
                    }
                }
                catch {
                    filter = { _id: taskIdFromJob };
                }
                taskDoc = (_a = (await tasksColl.findOne(filter))) !== null && _a !== void 0 ? _a : null;
                if (!taskDoc) {
                    logger_1.logger.info({ taskId: taskIdFromJob }, 'geocodeAddress: task not found — will proceed without persisting');
                    taskDoc = null;
                }
            }
        }
        // gather coordinates
        let start = null;
        let finish = null;
        // 1) existing coords in task doc (informational)
        if (taskDoc && typeof taskDoc === 'object' && taskDoc !== null) {
            const td = taskDoc;
            if (td.startCoordinates) {
                const p = normalizeToLatLng(td.startCoordinates);
                if (p)
                    start = p;
            }
            if (td.finishCoordinates) {
                const p = normalizeToLatLng(td.finishCoordinates);
                if (p)
                    finish = p;
            }
        }
        // 2) try addressFromJob (shared.extractCoords or raw parse)
        if (addressFromJob) {
            const sc = tryExtractFromString(addressFromJob);
            if (sc && !start)
                start = sc;
        }
        // 3) check fields on task doc (start_location/end_location strings)
        if (taskDoc && typeof taskDoc === 'object' && taskDoc !== null) {
            const td = taskDoc;
            if (!start && typeof td.start_location === 'string' && td.start_location.trim().length > 0) {
                const sc = tryExtractFromString(td.start_location);
                if (sc)
                    start = sc;
            }
            if (!finish && typeof td.end_location === 'string' && td.end_location.trim().length > 0) {
                const sc = tryExtractFromString(td.end_location);
                if (sc)
                    finish = sc;
            }
        }
        // Normalize after all attempts
        if (start)
            start = (_b = normalizeToLatLng(start)) !== null && _b !== void 0 ? _b : null;
        if (finish)
            finish = (_c = normalizeToLatLng(finish)) !== null && _c !== void 0 ? _c : null;
        // Persist if we have DB and a taskId
        if ((start || finish) && db && typeof taskIdFromJob === 'string') {
            try {
                const ok = await persistCoords(db, String(taskIdFromJob), start, finish);
                if (ok) {
                    logger_1.logger.info({ taskId: taskIdFromJob, start, finish }, 'geocodeAddress: persisted coords (informational)');
                }
                else {
                    logger_1.logger.info({ taskId: taskIdFromJob }, 'geocodeAddress: nothing to persist');
                }
            }
            catch (e) {
                logger_1.logger.warn({ err: e, taskId: taskIdFromJob }, 'geocodeAddress: failed to persist coords');
            }
        }
        // Return Coordinates | null per GeocodingJobResult
        return ((_d = start !== null && start !== void 0 ? start : finish) !== null && _d !== void 0 ? _d : null);
    }
    catch (e) {
        logger_1.logger.error({ err: e }, 'geocodeAddress: unexpected error');
        // On error — fail gracefully and return null (task should not depend on coords)
        return null;
    }
    finally {
        // close client if opened
        try {
            if (client && typeof client.close === 'function') {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                await client.close();
            }
        }
        catch {
            // ignore
        }
    }
}
