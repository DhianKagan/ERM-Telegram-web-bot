"use strict";
// Назначение: сервис управления маршрутными планами и уведомлениями.
// Основные модули: mongoose, shared, db/models/routePlan, telegramApi, db/queries
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDraftFromInputs = createDraftFromInputs;
exports.listPlans = listPlans;
exports.getPlan = getPlan;
exports.updatePlan = updatePlan;
exports.updatePlanStatus = updatePlanStatus;
exports.removePlan = removePlan;
const mongoose_1 = require("mongoose");
const shared_1 = require("shared");
const routePlan_1 = require("../db/models/routePlan");
const model_1 = require("../db/model");
const config_1 = require("../config");
const telegramApi_1 = require("./telegramApi");
const queries_1 = require("../db/queries");
const logisticsEvents_1 = require("./logisticsEvents");
const taskPoints_1 = require("../utils/taskPoints");
const TITLE_MAX_LENGTH = 120;
const NOTES_MAX_LENGTH = 1024;
const VEHICLE_NAME_MAX_LENGTH = 80;
const DRIVER_NAME_MAX_LENGTH = 80;
const ADDRESS_MAX_LENGTH = 200;
const statusTransitions = {
    draft: ['approved'],
    approved: ['draft', 'completed'],
    completed: [],
};
const roundDistance = (value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null;
    }
    return Number(value.toFixed(1));
};
const normalizeString = (value, limit) => {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    if (trimmed.length > limit) {
        return trimmed.slice(0, limit);
    }
    return trimmed;
};
const parseNumeric = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.trunc(value);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        const parsed = Number.parseInt(trimmed, 10);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return null;
};
const parseObjectId = (value) => {
    if (!value)
        return null;
    if (value instanceof mongoose_1.Types.ObjectId)
        return value;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed)
            return null;
        if (!mongoose_1.Types.ObjectId.isValid(trimmed))
            return null;
        return new mongoose_1.Types.ObjectId(trimmed);
    }
    if (typeof value === 'object' && 'toString' in value) {
        return parseObjectId(value.toString());
    }
    return null;
};
const normalizeId = (value) => {
    if (!value)
        return null;
    if (value instanceof mongoose_1.Types.ObjectId) {
        return value.toHexString();
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed)
            return null;
        if (mongoose_1.Types.ObjectId.isValid(trimmed)) {
            return new mongoose_1.Types.ObjectId(trimmed).toHexString();
        }
        return trimmed;
    }
    if (typeof value === 'object' && 'toString' in value) {
        return normalizeId(value.toString());
    }
    return null;
};
const cloneCoords = (source) => {
    if (!source || typeof source !== 'object')
        return undefined;
    const lat = typeof source.lat === 'number' ? source.lat : Number(source.lat);
    const lng = typeof source.lng === 'number' ? source.lng : Number(source.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return undefined;
    }
    return { lat, lng };
};
const ensureTaskMap = async (inputs, map) => {
    const taskMap = new Map();
    if (map) {
        for (const [key, value] of map.entries()) {
            const normalizedKey = normalizeId(key);
            if (normalizedKey) {
                taskMap.set(normalizedKey, value);
            }
        }
    }
    const missing = new Set();
    for (const route of inputs) {
        const tasks = Array.isArray(route.tasks) ? route.tasks : [];
        for (const id of tasks) {
            const normalized = normalizeId(id);
            if (!normalized)
                continue;
            if (!taskMap.has(normalized)) {
                missing.add(normalized);
            }
        }
    }
    if (!missing.size) {
        return taskMap;
    }
    const docs = await model_1.Task.find({ _id: { $in: Array.from(missing) } })
        .select('title startCoordinates finishCoordinates start_location end_location route_distance_km points google_route_url')
        .lean();
    for (const doc of docs) {
        const key = normalizeId(doc._id);
        if (key) {
            taskMap.set(key, doc);
        }
    }
    return taskMap;
};
const sanitizeAddress = (value) => normalizeString(value, ADDRESS_MAX_LENGTH);
const normalizeUrl = (value) => {
    if (typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
};
const buildLegacyPoints = (task) => {
    var _a, _b, _c, _d, _e;
    const points = [];
    const start = cloneCoords((_a = task.startCoordinates) !== null && _a !== void 0 ? _a : null);
    const finish = cloneCoords((_b = task.finishCoordinates) !== null && _b !== void 0 ? _b : null);
    const sourceUrl = (_c = normalizeUrl(task.google_route_url)) !== null && _c !== void 0 ? _c : undefined;
    if (start) {
        points.push({
            order: points.length,
            kind: 'start',
            coordinates: start,
            title: (_d = sanitizeAddress(task.start_location)) !== null && _d !== void 0 ? _d : undefined,
            sourceUrl,
        });
    }
    if (finish) {
        points.push({
            order: points.length,
            kind: 'finish',
            coordinates: finish,
            title: (_e = sanitizeAddress(task.end_location)) !== null && _e !== void 0 ? _e : undefined,
            sourceUrl,
        });
    }
    return points;
};
const defaultTitle = () => {
    try {
        const formatter = new Intl.DateTimeFormat('ru-UA', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: shared_1.PROJECT_TIMEZONE,
        });
        return `Маршрутный план ${formatter.format(new Date())}`;
    }
    catch {
        return `Маршрутный план ${new Date().toISOString()}`;
    }
};
async function buildRoutesFromInput(routesInput = [], taskMap) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
    const normalizedInputs = routesInput
        .map((route, idx) => {
        const tasks = Array.isArray(route.tasks)
            ? route.tasks
                .map((id) => normalizeId(id))
                .filter((id) => Boolean(id))
            : [];
        return {
            id: typeof route.id === 'string' && route.id.trim()
                ? route.id.trim()
                : undefined,
            order: Number.isFinite(route.order) ? Number(route.order) : idx,
            vehicleId: parseObjectId(route.vehicleId),
            vehicleName: normalizeString(route.vehicleName, VEHICLE_NAME_MAX_LENGTH),
            driverId: parseNumeric(route.driverId),
            driverName: normalizeString(route.driverName, DRIVER_NAME_MAX_LENGTH),
            notes: normalizeString(route.notes, NOTES_MAX_LENGTH),
            tasks,
        };
    })
        .filter((route) => route.tasks.length);
    const map = await ensureTaskMap(routesInput, taskMap);
    const routes = [];
    const uniqueTaskIds = new Map();
    let totalDistance = 0;
    let totalStops = 0;
    let totalTasks = 0;
    for (const route of normalizedInputs) {
        const routeTasks = [];
        const stops = [];
        const coordsForLink = [];
        let routeDistance = 0;
        for (const taskId of route.tasks) {
            const task = map.get(taskId);
            if (!task)
                continue;
            const objectId = parseObjectId(task._id);
            if (!objectId)
                continue;
            uniqueTaskIds.set(objectId.toHexString(), objectId);
            const normalizedPoints = (0, taskPoints_1.normalizeTaskPoints)(task.points);
            const points = normalizedPoints.length
                ? normalizedPoints
                : buildLegacyPoints(task);
            const legacyCoords = (0, taskPoints_1.extractLegacyCoordinates)(points);
            const start = cloneCoords((_b = (_a = legacyCoords.start) !== null && _a !== void 0 ? _a : task.startCoordinates) !== null && _b !== void 0 ? _b : null);
            const finish = cloneCoords((_d = (_c = legacyCoords.finish) !== null && _c !== void 0 ? _c : task.finishCoordinates) !== null && _d !== void 0 ? _d : null);
            const distanceKm = roundDistance((_e = task.route_distance_km) !== null && _e !== void 0 ? _e : undefined);
            const startPoint = (_f = points.find((point) => point.kind === 'start')) !== null && _f !== void 0 ? _f : points[0];
            const finishPoint = [...points].reverse().find((point) => point.kind === 'finish') ||
                (points.length ? points[points.length - 1] : undefined);
            const taskEntry = {
                taskId: objectId,
                order: routeTasks.length,
                title: typeof task.title === 'string' ? task.title : undefined,
                start: start ? { ...start } : undefined,
                finish: finish ? { ...finish } : undefined,
                startAddress: sanitizeAddress((_g = startPoint === null || startPoint === void 0 ? void 0 : startPoint.title) !== null && _g !== void 0 ? _g : task.start_location),
                finishAddress: sanitizeAddress((_h = finishPoint === null || finishPoint === void 0 ? void 0 : finishPoint.title) !== null && _h !== void 0 ? _h : task.end_location),
                distanceKm,
            };
            routeTasks.push(taskEntry);
            for (const point of points) {
                const coordinates = cloneCoords((_j = point.coordinates) !== null && _j !== void 0 ? _j : null);
                if (!coordinates)
                    continue;
                const addressCandidate = (_k = point.title) !== null && _k !== void 0 ? _k : (point.kind === 'finish' ? task.end_location : task.start_location);
                stops.push({
                    order: stops.length,
                    kind: point.kind,
                    taskId: objectId,
                    coordinates: { ...coordinates },
                    address: sanitizeAddress(addressCandidate),
                });
                coordsForLink.push(coordinates);
            }
            if (typeof distanceKm === 'number') {
                routeDistance += distanceKm;
            }
        }
        if (!routeTasks.length) {
            continue;
        }
        const metrics = {
            distanceKm: roundDistance(routeDistance),
            tasks: routeTasks.length,
            stops: stops.length,
        };
        totalDistance += (_l = metrics.distanceKm) !== null && _l !== void 0 ? _l : 0;
        totalStops += (_m = metrics.stops) !== null && _m !== void 0 ? _m : 0;
        totalTasks += (_o = metrics.tasks) !== null && _o !== void 0 ? _o : 0;
        const sortedStops = stops
            .map((stop, index) => ({
            ...stop,
            order: Number.isFinite(stop.order) ? Number(stop.order) : index,
        }))
            .sort((a, b) => a.order - b.order)
            .map((stop, index) => ({ ...stop, order: index }));
        const sortedTasks = routeTasks
            .map((task, index) => ({
            ...task,
            order: Number.isFinite(task.order) ? Number(task.order) : index,
        }))
            .sort((a, b) => a.order - b.order)
            .map((task, index) => ({ ...task, order: index }));
        const link = coordsForLink.length >= 2 ? (0, shared_1.generateMultiRouteLink)(coordsForLink) : '';
        routes.push({
            id: (_p = route.id) !== null && _p !== void 0 ? _p : new mongoose_1.Types.ObjectId().toHexString(),
            order: Number.isFinite(route.order) ? route.order : routes.length,
            vehicleId: (_q = route.vehicleId) !== null && _q !== void 0 ? _q : undefined,
            vehicleName: (_r = route.vehicleName) !== null && _r !== void 0 ? _r : undefined,
            driverId: (_s = route.driverId) !== null && _s !== void 0 ? _s : undefined,
            driverName: (_t = route.driverName) !== null && _t !== void 0 ? _t : undefined,
            notes: (_u = route.notes) !== null && _u !== void 0 ? _u : undefined,
            tasks: sortedTasks,
            stops: sortedStops,
            metrics,
            routeLink: link,
        });
    }
    const sortedRoutes = routes
        .map((route, index) => ({
        ...route,
        order: Number.isFinite(route.order) ? route.order : index,
    }))
        .sort((a, b) => a.order - b.order)
        .map((route, index) => ({ ...route, order: index }));
    return {
        routes: sortedRoutes,
        metrics: {
            totalDistanceKm: roundDistance(totalDistance),
            totalRoutes: sortedRoutes.length,
            totalTasks,
            totalStops,
        },
        taskIds: Array.from(uniqueTaskIds.values()),
    };
}
const serializeRoute = (route) => {
    var _a, _b, _c, _d, _e, _f, _g;
    const vehicleId = parseObjectId(route.vehicleId);
    const tasks = (route.tasks || [])
        .map((task) => {
        var _a, _b, _c;
        return ({
            taskId: (_a = parseObjectId(task.taskId)) !== null && _a !== void 0 ? _a : undefined,
            order: Number.isFinite(task.order) ? Number(task.order) : 0,
            title: typeof task.title === 'string' ? task.title : undefined,
            start: cloneCoords((_b = task.start) !== null && _b !== void 0 ? _b : null),
            finish: cloneCoords((_c = task.finish) !== null && _c !== void 0 ? _c : null),
            startAddress: sanitizeAddress(task.startAddress),
            finishAddress: sanitizeAddress(task.finishAddress),
            distanceKm: typeof task.distanceKm === 'number' ? Number(task.distanceKm) : null,
        });
    })
        .filter((task) => task.taskId)
        .sort((a, b) => a.order - b.order)
        .map((task, index) => ({
        taskId: task.taskId.toHexString(),
        order: index,
        title: task.title,
        start: task.start,
        finish: task.finish,
        startAddress: task.startAddress,
        finishAddress: task.finishAddress,
        distanceKm: task.distanceKm,
    }));
    const stops = (route.stops || [])
        .map((stop) => {
        var _a, _b;
        return ({
            order: Number.isFinite(stop.order) ? Number(stop.order) : 0,
            kind: (stop.kind === 'finish'
                ? 'finish'
                : 'start'),
            taskId: (_a = parseObjectId(stop.taskId)) !== null && _a !== void 0 ? _a : undefined,
            coordinates: cloneCoords((_b = stop.coordinates) !== null && _b !== void 0 ? _b : null),
            address: sanitizeAddress(stop.address),
        });
    })
        .filter((stop) => stop.taskId)
        .sort((a, b) => a.order - b.order)
        .map((stop, index) => {
        var _a;
        return ({
            order: index,
            kind: stop.kind,
            taskId: stop.taskId.toHexString(),
            coordinates: stop.coordinates,
            address: (_a = stop.address) !== null && _a !== void 0 ? _a : null,
        });
    });
    const metrics = {
        distanceKm: route.metrics && typeof route.metrics.distanceKm === 'number'
            ? Number(route.metrics.distanceKm)
            : null,
        tasks: (_b = (_a = route.metrics) === null || _a === void 0 ? void 0 : _a.tasks) !== null && _b !== void 0 ? _b : tasks.length,
        stops: (_d = (_c = route.metrics) === null || _c === void 0 ? void 0 : _c.stops) !== null && _d !== void 0 ? _d : stops.length,
    };
    return {
        id: typeof route.id === 'string' && route.id
            ? route.id
            : new mongoose_1.Types.ObjectId().toHexString(),
        order: Number.isFinite(route.order) ? Number(route.order) : 0,
        vehicleId: vehicleId ? vehicleId.toHexString() : null,
        vehicleName: (_e = route.vehicleName) !== null && _e !== void 0 ? _e : null,
        driverId: typeof route.driverId === 'number' ? Number(route.driverId) : null,
        driverName: (_f = route.driverName) !== null && _f !== void 0 ? _f : null,
        notes: (_g = route.notes) !== null && _g !== void 0 ? _g : null,
        tasks,
        stops,
        metrics,
        routeLink: route.routeLink || null,
    };
};
const serializePlan = (plan) => {
    var _a, _b;
    const raw = plan.toObject({ depopulate: true, versionKey: false });
    const { title, status, suggestedBy, method, count, notes, approvedBy, routes: rawRoutes, metrics: rawMetrics, tasks: rawTasks, createdAt, updatedAt, approvedAt, completedAt, completedBy, } = raw;
    const routes = Array.isArray(rawRoutes)
        ? rawRoutes.map((route) => serializeRoute(route))
        : [];
    const sortedRoutes = routes
        .map((route, index) => ({
        ...route,
        order: Number.isFinite(route.order) ? route.order : index,
    }))
        .sort((a, b) => a.order - b.order)
        .map((route, index) => ({ ...route, order: index }));
    const totalDistance = typeof (rawMetrics === null || rawMetrics === void 0 ? void 0 : rawMetrics.totalDistanceKm) === 'number'
        ? Number(rawMetrics.totalDistanceKm)
        : sortedRoutes.reduce((sum, route) => {
            var _a, _b;
            return sum +
                (Number.isFinite((_a = route.metrics) === null || _a === void 0 ? void 0 : _a.distanceKm)
                    ? Number((_b = route.metrics) === null || _b === void 0 ? void 0 : _b.distanceKm)
                    : 0);
        }, 0);
    const totalTasks = typeof (rawMetrics === null || rawMetrics === void 0 ? void 0 : rawMetrics.totalTasks) === 'number'
        ? Number(rawMetrics.totalTasks)
        : sortedRoutes.reduce((sum, route) => sum + route.tasks.length, 0);
    const totalStops = typeof (rawMetrics === null || rawMetrics === void 0 ? void 0 : rawMetrics.totalStops) === 'number'
        ? Number(rawMetrics.totalStops)
        : sortedRoutes.reduce((sum, route) => sum + route.stops.length, 0);
    const taskIds = Array.isArray(rawTasks)
        ? rawTasks
            .map((id) => normalizeId(id))
            .filter((id) => Boolean(id))
        : [];
    const toIso = (value) => {
        if (!value)
            return undefined;
        if (value instanceof Date) {
            return value.toISOString();
        }
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
    };
    const approvedAtIso = approvedAt ? ((_a = toIso(approvedAt)) !== null && _a !== void 0 ? _a : null) : null;
    const completedAtIso = completedAt ? ((_b = toIso(completedAt)) !== null && _b !== void 0 ? _b : null) : null;
    return {
        id: plan._id instanceof mongoose_1.Types.ObjectId
            ? plan._id.toHexString()
            : String(plan._id),
        title: typeof title === 'string' ? title : '',
        status,
        suggestedBy: typeof suggestedBy === 'number' && Number.isFinite(suggestedBy)
            ? Number(suggestedBy)
            : null,
        method,
        count: typeof count === 'number' && Number.isFinite(count)
            ? Number(count)
            : undefined,
        notes: typeof notes === 'string'
            ? normalizeString(notes, NOTES_MAX_LENGTH)
            : null,
        approvedBy: typeof approvedBy === 'number' && Number.isFinite(approvedBy)
            ? Number(approvedBy)
            : null,
        approvedAt: approvedAtIso,
        completedBy: typeof completedBy === 'number' && Number.isFinite(completedBy)
            ? Number(completedBy)
            : null,
        completedAt: completedAtIso,
        metrics: {
            totalDistanceKm: roundDistance(totalDistance),
            totalRoutes: sortedRoutes.length,
            totalTasks,
            totalStops,
        },
        routes: sortedRoutes,
        tasks: taskIds,
        createdAt: toIso(createdAt),
        updatedAt: toIso(updatedAt),
    };
};
async function createDraftFromInputs(routes, options = {}, taskHints) {
    var _a, _b;
    let hintMap;
    if (taskHints) {
        hintMap = new Map();
        for (const hint of taskHints) {
            const key = normalizeId(hint._id);
            if (key) {
                hintMap.set(key, hint);
            }
        }
    }
    const { routes: builtRoutes, metrics, taskIds, } = await buildRoutesFromInput(routes, hintMap);
    const title = (_a = normalizeString(options.title, TITLE_MAX_LENGTH)) !== null && _a !== void 0 ? _a : defaultTitle();
    const notes = normalizeString(options.notes, NOTES_MAX_LENGTH);
    const plan = await routePlan_1.RoutePlan.create({
        title,
        status: 'draft',
        suggestedBy: typeof options.actorId === 'number' && Number.isFinite(options.actorId)
            ? Number(options.actorId)
            : undefined,
        method: options.method,
        count: options.count,
        notes,
        routes: builtRoutes,
        metrics,
        tasks: taskIds,
    });
    const serialized = serializePlan(plan);
    const reason = (_b = options.reason) !== null && _b !== void 0 ? _b : 'created';
    (0, logisticsEvents_1.notifyRoutePlanUpdated)(serialized, reason);
    return serialized;
}
async function listPlans(filters = {}) {
    const query = {};
    if (filters.status) {
        query.status = filters.status;
    }
    const total = await routePlan_1.RoutePlan.countDocuments(query);
    let builder = routePlan_1.RoutePlan.find(query).sort({ createdAt: -1 });
    const limit = Number(filters.limit);
    const page = Number(filters.page);
    if (Number.isFinite(limit) && limit > 0) {
        const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
        const safePage = Number.isFinite(page) && page > 0 ? Math.trunc(page) : 1;
        builder = builder.skip((safePage - 1) * safeLimit).limit(safeLimit);
    }
    const docs = await builder.exec();
    return {
        items: docs.map((doc) => serializePlan(doc)),
        total,
    };
}
async function getPlan(id) {
    const objectId = parseObjectId(id);
    if (!objectId)
        return null;
    const plan = await routePlan_1.RoutePlan.findById(objectId);
    return plan ? serializePlan(plan) : null;
}
async function updatePlan(id, payload) {
    var _a;
    const objectId = parseObjectId(id);
    if (!objectId)
        return null;
    const plan = await routePlan_1.RoutePlan.findById(objectId);
    if (!plan)
        return null;
    if (typeof payload.title === 'string') {
        const nextTitle = normalizeString(payload.title, TITLE_MAX_LENGTH);
        if (nextTitle) {
            plan.title = nextTitle;
        }
    }
    if (payload.notes === null || typeof payload.notes === 'string') {
        plan.notes = (_a = normalizeString(payload.notes, NOTES_MAX_LENGTH)) !== null && _a !== void 0 ? _a : undefined;
    }
    if (Array.isArray(payload.routes)) {
        const { routes, metrics, taskIds } = await buildRoutesFromInput(payload.routes);
        plan.routes = routes;
        plan.metrics = metrics;
        plan.tasks = taskIds;
    }
    await plan.save();
    const serialized = serializePlan(plan);
    (0, logisticsEvents_1.notifyRoutePlanUpdated)(serialized, 'updated');
    return serialized;
}
const updateTasksForStatus = async (taskIds, status) => {
    if (!Array.isArray(taskIds) || !taskIds.length)
        return;
    const ids = taskIds.filter((id) => id instanceof mongoose_1.Types.ObjectId);
    if (!ids.length)
        return;
    if (status === 'approved') {
        await model_1.Task.updateMany({ _id: { $in: ids } }, {
            $set: {
                status: 'В работе',
                in_progress_at: new Date(),
            },
        });
    }
    else if (status === 'completed') {
        await model_1.Task.updateMany({ _id: { $in: ids } }, {
            $set: {
                status: 'Выполнена',
                completed_at: new Date(),
            },
        });
    }
};
const canTransition = (from, to) => {
    const allowed = statusTransitions[from] || [];
    return allowed.includes(to);
};
const notifyPlanApproved = async (plan, actorId) => {
    if (!config_1.chatId)
        return;
    const actor = typeof actorId === 'number' && Number.isFinite(actorId)
        ? await (0, queries_1.getUser)(actorId)
        : null;
    const actorName = (actor === null || actor === void 0 ? void 0 : actor.name) ||
        (actor === null || actor === void 0 ? void 0 : actor.username) ||
        (actorId ? `ID ${actorId}` : 'неизвестно');
    const lines = [
        `Маршрутный план "${plan.title}" утверждён диспетчером ${actorName}.`,
    ];
    plan.routes.forEach((route, routeIndex) => {
        var _a;
        const parts = [];
        const vehicle = route.vehicleName ||
            (route.vehicleId ? `ID ${route.vehicleId}` : 'без транспорта');
        parts.push(`Маршрут ${routeIndex + 1} (${vehicle}`);
        if (route.driverName) {
            parts.push(`, водитель: ${route.driverName}`);
        }
        parts.push('):');
        lines.push(parts.join(''));
        route.tasks.forEach((task, taskIndex) => {
            const title = task.title || `Задача ${task.taskId}`;
            const distance = typeof task.distanceKm === 'number' && Number.isFinite(task.distanceKm)
                ? ` — ${task.distanceKm.toFixed(1)} км`
                : '';
            lines.push(`${taskIndex + 1}. ${title}${distance}`);
        });
        if (((_a = route.metrics) === null || _a === void 0 ? void 0 : _a.distanceKm) &&
            Number.isFinite(route.metrics.distanceKm)) {
            lines.push(`Пробег: ${route.metrics.distanceKm.toFixed(1)} км.`);
        }
        if (route.routeLink) {
            lines.push(route.routeLink);
        }
    });
    const summary = [
        `Всего задач: ${plan.metrics.totalTasks}`,
        `маршрутов: ${plan.metrics.totalRoutes}`,
    ];
    if (plan.metrics.totalDistanceKm &&
        Number.isFinite(plan.metrics.totalDistanceKm)) {
        summary.push(`расстояние: ${plan.metrics.totalDistanceKm.toFixed(1)} км`);
    }
    lines.push(summary.join(', '));
    try {
        await (0, telegramApi_1.call)('sendMessage', {
            chat_id: config_1.chatId,
            text: lines.join('\n'),
        });
    }
    catch (error) {
        console.error('Не удалось отправить уведомление о маршрутном плане', error);
    }
};
async function updatePlanStatus(id, status, actorId) {
    const objectId = parseObjectId(id);
    if (!objectId)
        return null;
    const plan = await routePlan_1.RoutePlan.findById(objectId);
    if (!plan)
        return null;
    const current = plan.status;
    if (status === current) {
        return serializePlan(plan);
    }
    if (!canTransition(current, status)) {
        throw new Error('Недопустимый переход статуса маршрутного плана');
    }
    const now = new Date();
    if (status === 'draft') {
        plan.status = 'draft';
        plan.approvedAt = undefined;
        plan.approvedBy = undefined;
        plan.completedAt = undefined;
        plan.completedBy = undefined;
    }
    else if (status === 'approved') {
        plan.status = 'approved';
        plan.approvedAt = now;
        if (typeof actorId === 'number' && Number.isFinite(actorId)) {
            plan.approvedBy = actorId;
        }
    }
    else if (status === 'completed') {
        plan.status = 'completed';
        plan.completedAt = now;
        if (typeof actorId === 'number' && Number.isFinite(actorId)) {
            plan.completedBy = actorId;
            if (!plan.approvedBy) {
                plan.approvedBy = actorId;
            }
        }
        if (!plan.approvedAt) {
            plan.approvedAt = now;
        }
    }
    await plan.save();
    await updateTasksForStatus(plan.tasks, status);
    const serialized = serializePlan(plan);
    if (status === 'approved') {
        await notifyPlanApproved(serialized, actorId).catch(() => undefined);
    }
    (0, logisticsEvents_1.notifyRoutePlanUpdated)(serialized, 'updated');
    return serialized;
}
async function removePlan(id) {
    var _a;
    const objectId = parseObjectId(id);
    if (!objectId)
        return false;
    const res = await routePlan_1.RoutePlan.findByIdAndDelete(objectId);
    if (!res) {
        return false;
    }
    const planId = (_a = normalizeId(res._id)) !== null && _a !== void 0 ? _a : normalizeId(id);
    if (planId) {
        (0, logisticsEvents_1.notifyRoutePlanRemoved)(planId);
    }
    return true;
}
exports.default = {
    createDraftFromInputs,
    listPlans,
    getPlan,
    updatePlan,
    updatePlanStatus,
    removePlan,
};
