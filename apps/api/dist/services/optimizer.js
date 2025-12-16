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
exports.__testing = void 0;
exports.optimize = optimize;
// Оптимизация маршрутов по координатам задач и интеграция с VRP
// Модули: db/queries, services/route, services/routePlans, services/vrp
const q = __importStar(require("../db/queries"));
const route = __importStar(require("./route"));
const routePlans_1 = require("./routePlans");
const graphhopperAdapter_1 = require("./vrp/graphhopperAdapter");
const orToolsAdapter_1 = require("./vrp/orToolsAdapter");
const DEFAULT_DEPOT_ID = '__depot__';
const DEFAULT_TIME_WINDOW = [0, 24 * 60];
let currentMatrixBuilder;
let currentOrToolsSolver;
const getMatrixBuilder = () => currentMatrixBuilder !== null && currentMatrixBuilder !== void 0 ? currentMatrixBuilder : ((points, options) => (0, graphhopperAdapter_1.buildTravelMatrix)(points, options));
const getOrToolsSolver = () => currentOrToolsSolver !== null && currentOrToolsSolver !== void 0 ? currentOrToolsSolver : orToolsAdapter_1.solveWithOrTools;
const toFiniteNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return fallback;
    }
    return numeric;
};
const ensureTimeWindow = (window) => {
    if (!window) {
        return DEFAULT_TIME_WINDOW;
    }
    const start = Math.max(0, Math.trunc(toFiniteNumber(window[0], 0)));
    const endCandidate = Math.max(start, Math.trunc(toFiniteNumber(window[1], start)));
    return [start, endCandidate];
};
const normalizeTasks = (inputs) => {
    const normalized = [];
    for (const input of inputs) {
        if (!input || typeof input !== 'object') {
            continue;
        }
        const id = typeof input.id === 'string' ? input.id.trim() : '';
        if (!id) {
            continue;
        }
        const coordinates = input.coordinates;
        if (!coordinates || typeof coordinates !== 'object') {
            continue;
        }
        const lat = toFiniteNumber(coordinates.lat);
        const lng = toFiniteNumber(coordinates.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            continue;
        }
        const weight = toFiniteNumber(input.weight, 0);
        const serviceMinutes = Math.max(0, Math.trunc(toFiniteNumber(input.serviceMinutes, 0)));
        const timeWindow = ensureTimeWindow(input.timeWindow);
        normalized.push({
            id,
            coordinates: { lat, lng },
            weight,
            serviceMinutes,
            timeWindow,
        });
    }
    return normalized;
};
const normalizeDepot = (depot, fallbackTask) => {
    if (depot && depot.coordinates) {
        const lat = toFiniteNumber(depot.coordinates.lat, fallbackTask.coordinates.lat);
        const lng = toFiniteNumber(depot.coordinates.lng, fallbackTask.coordinates.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            return {
                id: typeof depot.id === 'string' && depot.id.trim()
                    ? depot.id.trim()
                    : DEFAULT_DEPOT_ID,
                coordinates: { lat, lng },
                serviceMinutes: Math.max(0, Math.trunc(toFiniteNumber(depot.serviceMinutes, 0))),
                timeWindow: ensureTimeWindow(depot.timeWindow),
            };
        }
    }
    return {
        id: DEFAULT_DEPOT_ID,
        coordinates: { ...fallbackTask.coordinates },
        serviceMinutes: 0,
        timeWindow: DEFAULT_TIME_WINDOW,
    };
};
const normalizeMatrix = (matrix, size) => {
    return Array.from({ length: size }, (_, rowIndex) => Array.from({ length: size }, (_, columnIndex) => {
        const row = matrix === null || matrix === void 0 ? void 0 : matrix[rowIndex];
        const value = Array.isArray(row) ? row[columnIndex] : undefined;
        const numeric = toFiniteNumber(value, 0);
        return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
    }));
};
const roundDistanceKm = (value) => {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Number(value.toFixed(1));
};
const buildSolverPayload = (depot, tasks, distanceMatrix, options) => {
    const allTasks = [depot, ...tasks];
    const timeWindows = allTasks.map((task) => task.timeWindow);
    const solverTasks = [
        {
            id: depot.id,
            demand: 0,
            service_minutes: depot.serviceMinutes,
            time_window: depot.timeWindow,
        },
        ...tasks.map((task) => ({
            id: task.id,
            demand: task.weight,
            service_minutes: task.serviceMinutes,
            time_window: task.timeWindow,
        })),
    ];
    return {
        tasks: solverTasks,
        distance_matrix: distanceMatrix,
        vehicle_capacity: typeof options.vehicleCapacity === 'number'
            ? options.vehicleCapacity
            : undefined,
        vehicle_count: typeof options.vehicleCount === 'number' && options.vehicleCount > 0
            ? Math.trunc(options.vehicleCount)
            : 1,
        depot_index: 0,
        time_windows: timeWindows,
        time_limit_seconds: typeof options.timeLimitSeconds === 'number' &&
            options.timeLimitSeconds > 0
            ? options.timeLimitSeconds
            : undefined,
    };
};
const computeRouteMetrics = (sequence, depot, tasks, distanceMatrix, timeMatrix) => {
    var _a, _b, _c, _d, _e, _f;
    const taskById = new Map();
    for (const task of tasks) {
        taskById.set(task.id, task);
    }
    const idToIndex = new Map();
    idToIndex.set(depot.id, 0);
    tasks.forEach((task, index) => {
        idToIndex.set(task.id, index + 1);
    });
    const normalizedSequence = [];
    if (sequence[0] !== depot.id) {
        normalizedSequence.push(depot.id);
    }
    normalizedSequence.push(...sequence);
    if (normalizedSequence[normalizedSequence.length - 1] !== depot.id) {
        normalizedSequence.push(depot.id);
    }
    let totalMeters = 0;
    let totalSeconds = 0;
    const visitedTasks = [];
    for (let i = 0; i < normalizedSequence.length - 1; i += 1) {
        const fromId = (_a = normalizedSequence[i]) !== null && _a !== void 0 ? _a : depot.id;
        const toId = (_b = normalizedSequence[i + 1]) !== null && _b !== void 0 ? _b : depot.id;
        const fromIndex = (_c = idToIndex.get(fromId)) !== null && _c !== void 0 ? _c : 0;
        const toIndex = (_d = idToIndex.get(toId)) !== null && _d !== void 0 ? _d : 0;
        const distanceRow = (_e = distanceMatrix[fromIndex]) !== null && _e !== void 0 ? _e : [];
        const timeRow = (_f = timeMatrix[fromIndex]) !== null && _f !== void 0 ? _f : [];
        const segmentMeters = toFiniteNumber(distanceRow[toIndex], 0);
        totalMeters += segmentMeters;
        const segmentSeconds = toFiniteNumber(timeRow[toIndex], 0);
        totalSeconds += segmentSeconds;
        if (taskById.has(toId)) {
            const task = taskById.get(toId);
            totalSeconds += task.serviceMinutes * 60;
            visitedTasks.push(task.id);
        }
    }
    const totalLoad = visitedTasks.reduce((sum, taskId) => {
        const task = taskById.get(taskId);
        return task ? sum + task.weight : sum;
    }, 0);
    return {
        taskIds: visitedTasks,
        load: totalLoad,
        etaMinutes: Math.max(0, Math.round(totalSeconds / 60)),
        distanceKm: roundDistanceKm(totalMeters / 1000),
    };
};
const buildHeuristicResult = (depot, tasks, distanceMatrix, timeMatrix) => {
    if (!tasks.length) {
        return {
            routes: [],
            totalLoad: 0,
            totalEtaMinutes: 0,
            totalDistanceKm: 0,
            warnings: [],
        };
    }
    const sequence = tasks.map((task) => task.id);
    const routeMetrics = computeRouteMetrics(sequence, depot, tasks, distanceMatrix, timeMatrix);
    return {
        routes: [routeMetrics],
        totalLoad: routeMetrics.load,
        totalEtaMinutes: routeMetrics.etaMinutes,
        totalDistanceKm: routeMetrics.distanceKm,
        warnings: [],
    };
};
async function optimizeVrp(inputs, options = {}) {
    const tasks = normalizeTasks(inputs);
    if (!tasks.length) {
        return {
            routes: [],
            totalLoad: 0,
            totalEtaMinutes: 0,
            totalDistanceKm: 0,
            warnings: ['Список задач пуст.'],
        };
    }
    const depot = normalizeDepot(options.depot, tasks[0]);
    const points = [depot.coordinates, ...tasks.map((task) => task.coordinates)];
    const averageSpeed = Math.max(10, Math.min(150, toFiniteNumber(options.averageSpeedKmph, 30)));
    const matrixBuilder = getMatrixBuilder();
    const matrix = await matrixBuilder(points, {
        averageSpeedKmph: averageSpeed,
    });
    const warnings = Array.isArray(matrix.warnings) ? [...matrix.warnings] : [];
    const size = points.length;
    const distanceMatrix = normalizeMatrix(matrix.distanceMatrix, size);
    const timeMatrix = normalizeMatrix(matrix.timeMatrix, size);
    const payload = buildSolverPayload(depot, tasks, distanceMatrix, options);
    let solverResult = null;
    let solverFailed = false;
    try {
        const solver = getOrToolsSolver();
        solverResult = await solver(payload);
        if (Array.isArray(solverResult.warnings)) {
            warnings.push(...solverResult.warnings);
        }
        if (!solverResult.enabled || !solverResult.routes.length) {
            solverFailed = true;
        }
    }
    catch (error) {
        solverFailed = true;
        const reason = error instanceof Error ? error.message : String(error);
        warnings.push(`Падение VRP движка: ${reason}`);
    }
    if (!solverFailed && solverResult) {
        const routes = solverResult.routes.map((sequence) => computeRouteMetrics(sequence, depot, tasks, distanceMatrix, timeMatrix));
        const totalLoad = routes.reduce((sum, routeResult) => sum + routeResult.load, 0);
        const totalEta = routes.reduce((sum, routeResult) => sum + routeResult.etaMinutes, 0);
        const totalDistance = routes.reduce((sum, routeResult) => sum + routeResult.distanceKm, 0);
        return {
            routes,
            totalLoad,
            totalEtaMinutes: solverResult.totalDurationMinutes
                ? Math.max(0, Math.round(solverResult.totalDurationMinutes))
                : totalEta,
            totalDistanceKm: solverResult.totalDistanceKm
                ? roundDistanceKm(solverResult.totalDistanceKm)
                : roundDistanceKm(totalDistance),
            warnings,
        };
    }
    const heuristicResult = buildHeuristicResult(depot, tasks, distanceMatrix, timeMatrix);
    heuristicResult.warnings = [
        ...warnings,
        'Используется эвристика построения маршрута.',
    ];
    return heuristicResult;
}
const optimizeLegacy = async (taskIds, count = 1, method = 'angle', actorId) => {
    var _a, _b;
    count = Math.max(1, Math.min(3, Number(count) || 1));
    const tasks = (await Promise.all(taskIds.map((id) => q.getTask(id)))).filter((t) => t && t.startCoordinates);
    if (!tasks.length)
        return null;
    count = Math.min(count, tasks.length);
    const center = {
        lat: tasks.reduce((s, t) => s + (t.startCoordinates.lat || 0), 0) /
            tasks.length,
        lng: tasks.reduce((s, t) => s + (t.startCoordinates.lng || 0), 0) /
            tasks.length,
    };
    const angle = (t) => Math.atan2(t.startCoordinates.lat - center.lat, t.startCoordinates.lng - center.lng);
    const sorted = tasks.sort((a, b) => angle(a) - angle(b));
    const step = Math.ceil(sorted.length / count);
    const groups = [];
    for (let i = 0; i < count; i++) {
        groups.push(sorted.slice(i * step, (i + 1) * step));
    }
    let finalGroups = groups;
    if (method === 'trip') {
        const orderedGroups = [];
        for (const g of groups) {
            if (g.length < 2) {
                orderedGroups.push(g);
                continue;
            }
            const points = g
                .map((t) => `${t.startCoordinates.lng},${t.startCoordinates.lat}`)
                .join(';');
            try {
                const data = await route.trip(points, { roundtrip: 'false' });
                const ordered = ((_b = (_a = data.trips) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.waypoints)
                    ? data.trips[0].waypoints.map((wp) => g[wp.waypoint_index])
                    : g;
                orderedGroups.push(ordered);
            }
            catch {
                orderedGroups.push(g);
            }
        }
        finalGroups = orderedGroups;
    }
    const routeInputs = finalGroups.map((group, index) => ({
        order: index,
        tasks: group.map((task) => task._id.toString()),
    }));
    if (!routeInputs.length) {
        return null;
    }
    const hints = tasks.map((task) => ({
        _id: task._id,
        title: task.title,
        startCoordinates: task.startCoordinates,
        finishCoordinates: task.finishCoordinates,
        start_location: task.start_location,
        end_location: task.end_location,
        route_distance_km: task.route_distance_km,
    }));
    return (0, routePlans_1.createDraftFromInputs)(routeInputs, { actorId, method, count, reason: 'recalculated' }, hints);
};
const isOptimizeTaskArray = (value) => value.every((item) => item && typeof item === 'object' && 'id' in item);
const isOptimizeOptions = (value) => value != null && typeof value === 'object' && !Array.isArray(value);
async function optimize(first, second, method, actorId) {
    if (Array.isArray(first) && first.length && isOptimizeTaskArray(first)) {
        const options = isOptimizeOptions(second) ? second : {};
        return optimizeVrp(first, options);
    }
    const ids = Array.isArray(first)
        ? first.filter((item) => typeof item === 'string')
        : [];
    const count = typeof second === 'number' ? second : undefined;
    return optimizeLegacy(ids, count, method, actorId);
}
exports.__testing = {
    setMatrixBuilder(builder) {
        currentMatrixBuilder = builder;
    },
    setOrToolsSolver(solver) {
        currentOrToolsSolver = solver;
    },
    reset() {
        currentMatrixBuilder = undefined;
        currentOrToolsSolver = undefined;
    },
};
