// Оптимизация маршрутов по координатам задач и интеграция с VRP
// Модули: db/queries, services/route, services/routePlans, services/vrp
import * as q from '../db/queries';
import * as route from './route';
import {
  createDraftFromInputs,
  type RoutePlanRouteInput,
  type RoutePlanTaskHint,
} from './routePlans';
import type { RoutePlan as SharedRoutePlan } from 'shared';
import {
  buildTravelMatrix,
  type TravelMatrixResult,
} from './vrp/graphhopperAdapter';
import {
  solveWithOrTools,
  type OrToolsSolveRequest,
  type OrToolsSolveResult,
} from './vrp/orToolsAdapter';

export type OptimizeMethod = 'angle' | 'trip';

export interface TaskLike {
  _id: { toString(): string };
  startCoordinates?: { lat: number; lng: number };
  finishCoordinates?: { lat: number; lng: number };
  start_location?: string | null;
  end_location?: string | null;
  route_distance_km?: number | null;
  title?: string;
}

export interface OptimizeTaskInput {
  id: string;
  coordinates: { lat: number; lng: number };
  weight?: number;
  serviceMinutes?: number;
  timeWindow?: [number, number];
}

export interface OptimizeDepotOptions {
  id?: string;
  coordinates: { lat: number; lng: number };
  serviceMinutes?: number;
  timeWindow?: [number, number];
}

export interface OptimizeOptions {
  vehicleCapacity?: number;
  vehicleCount?: number;
  averageSpeedKmph?: number;
  timeLimitSeconds?: number;
  depot?: OptimizeDepotOptions;
}

export interface OptimizeRouteResult {
  taskIds: string[];
  load: number;
  etaMinutes: number;
  distanceKm: number;
}

export interface OptimizeResult {
  routes: OptimizeRouteResult[];
  totalLoad: number;
  totalEtaMinutes: number;
  totalDistanceKm: number;
  warnings: string[];
}

interface NormalizedTask {
  id: string;
  coordinates: { lat: number; lng: number };
  weight: number;
  serviceMinutes: number;
  timeWindow: [number, number];
}

interface NormalizedDepot {
  id: string;
  coordinates: { lat: number; lng: number };
  serviceMinutes: number;
  timeWindow: [number, number];
}

interface MatrixBuilderOptions {
  averageSpeedKmph: number;
}

type MatrixBuilder = (
  points: Array<{ lat: number; lng: number }>,
  options: MatrixBuilderOptions,
) => Promise<TravelMatrixResult>;

type OrToolsSolver = (
  payload: OrToolsSolveRequest,
) => Promise<OrToolsSolveResult>;

interface TripWaypoint {
  waypoint_index: number;
}

interface TripData {
  trips?: { waypoints: TripWaypoint[] }[];
}

const DEFAULT_DEPOT_ID = '__depot__';
const DEFAULT_TIME_WINDOW: [number, number] = [0, 24 * 60];

let currentMatrixBuilder: MatrixBuilder | undefined;
let currentOrToolsSolver: OrToolsSolver | undefined;

const getMatrixBuilder = (): MatrixBuilder =>
  currentMatrixBuilder ??
  ((points, options) => buildTravelMatrix(points, options));

const getOrToolsSolver = (): OrToolsSolver =>
  currentOrToolsSolver ?? solveWithOrTools;

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return numeric;
};

const ensureTimeWindow = (
  window: [number, number] | undefined,
): [number, number] => {
  if (!window) {
    return DEFAULT_TIME_WINDOW;
  }
  const start = Math.max(0, Math.trunc(toFiniteNumber(window[0], 0)));
  const endCandidate = Math.max(
    start,
    Math.trunc(toFiniteNumber(window[1], start)),
  );
  return [start, endCandidate];
};

const normalizeTasks = (inputs: OptimizeTaskInput[]): NormalizedTask[] => {
  const normalized: NormalizedTask[] = [];
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
    const serviceMinutes = Math.max(
      0,
      Math.trunc(toFiniteNumber(input.serviceMinutes, 0)),
    );
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

const normalizeDepot = (
  depot: OptimizeDepotOptions | undefined,
  fallbackTask: NormalizedTask,
): NormalizedDepot => {
  if (depot && depot.coordinates) {
    const lat = toFiniteNumber(
      depot.coordinates.lat,
      fallbackTask.coordinates.lat,
    );
    const lng = toFiniteNumber(
      depot.coordinates.lng,
      fallbackTask.coordinates.lng,
    );
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return {
        id:
          typeof depot.id === 'string' && depot.id.trim()
            ? depot.id.trim()
            : DEFAULT_DEPOT_ID,
        coordinates: { lat, lng },
        serviceMinutes: Math.max(
          0,
          Math.trunc(toFiniteNumber(depot.serviceMinutes, 0)),
        ),
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

const normalizeMatrix = (matrix: number[][], size: number): number[][] => {
  return Array.from({ length: size }, (_, rowIndex) =>
    Array.from({ length: size }, (_, columnIndex) => {
      const row = matrix?.[rowIndex];
      const value = Array.isArray(row) ? row[columnIndex] : undefined;
      const numeric = toFiniteNumber(value, 0);
      return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
    }),
  );
};

const roundDistanceKm = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Number(value.toFixed(1));
};

const buildSolverPayload = (
  depot: NormalizedDepot,
  tasks: NormalizedTask[],
  distanceMatrix: number[][],
  options: OptimizeOptions,
): OrToolsSolveRequest => {
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
    vehicle_capacity:
      typeof options.vehicleCapacity === 'number'
        ? options.vehicleCapacity
        : undefined,
    vehicle_count:
      typeof options.vehicleCount === 'number' && options.vehicleCount > 0
        ? Math.trunc(options.vehicleCount)
        : 1,
    depot_index: 0,
    time_windows: timeWindows,
    time_limit_seconds:
      typeof options.timeLimitSeconds === 'number' &&
      options.timeLimitSeconds > 0
        ? options.timeLimitSeconds
        : undefined,
  };
};

const computeRouteMetrics = (
  sequence: string[],
  depot: NormalizedDepot,
  tasks: NormalizedTask[],
  distanceMatrix: number[][],
  timeMatrix: number[][],
): OptimizeRouteResult => {
  const taskById = new Map<string, NormalizedTask>();
  for (const task of tasks) {
    taskById.set(task.id, task);
  }
  const idToIndex = new Map<string, number>();
  idToIndex.set(depot.id, 0);
  tasks.forEach((task, index) => {
    idToIndex.set(task.id, index + 1);
  });

  const normalizedSequence: string[] = [];
  if (sequence[0] !== depot.id) {
    normalizedSequence.push(depot.id);
  }
  normalizedSequence.push(...sequence);
  if (normalizedSequence[normalizedSequence.length - 1] !== depot.id) {
    normalizedSequence.push(depot.id);
  }

  let totalMeters = 0;
  let totalSeconds = 0;
  const visitedTasks: string[] = [];

  for (let i = 0; i < normalizedSequence.length - 1; i += 1) {
    const fromId = normalizedSequence[i] ?? depot.id;
    const toId = normalizedSequence[i + 1] ?? depot.id;
    const fromIndex = idToIndex.get(fromId) ?? 0;
    const toIndex = idToIndex.get(toId) ?? 0;
    const distanceRow = distanceMatrix[fromIndex] ?? [];
    const timeRow = timeMatrix[fromIndex] ?? [];
    const segmentMeters = toFiniteNumber(distanceRow[toIndex], 0);
    totalMeters += segmentMeters;
    const segmentSeconds = toFiniteNumber(timeRow[toIndex], 0);
    totalSeconds += segmentSeconds;
    if (taskById.has(toId)) {
      const task = taskById.get(toId)!;
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

const buildHeuristicResult = (
  depot: NormalizedDepot,
  tasks: NormalizedTask[],
  distanceMatrix: number[][],
  timeMatrix: number[][],
): OptimizeResult => {
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
  const routeMetrics = computeRouteMetrics(
    sequence,
    depot,
    tasks,
    distanceMatrix,
    timeMatrix,
  );
  return {
    routes: [routeMetrics],
    totalLoad: routeMetrics.load,
    totalEtaMinutes: routeMetrics.etaMinutes,
    totalDistanceKm: routeMetrics.distanceKm,
    warnings: [],
  };
};

async function optimizeVrp(
  inputs: OptimizeTaskInput[],
  options: OptimizeOptions = {},
): Promise<OptimizeResult> {
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
  const averageSpeed = Math.max(
    10,
    Math.min(150, toFiniteNumber(options.averageSpeedKmph, 30)),
  );

  const matrixBuilder = getMatrixBuilder();
  const matrix = await matrixBuilder(points, {
    averageSpeedKmph: averageSpeed,
  });
  const warnings = Array.isArray(matrix.warnings) ? [...matrix.warnings] : [];

  const size = points.length;
  const distanceMatrix = normalizeMatrix(matrix.distanceMatrix, size);
  const timeMatrix = normalizeMatrix(matrix.timeMatrix, size);

  const payload = buildSolverPayload(depot, tasks, distanceMatrix, options);
  let solverResult: OrToolsSolveResult | null = null;
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
  } catch (error) {
    solverFailed = true;
    const reason = error instanceof Error ? error.message : String(error);
    warnings.push(`Падение VRP движка: ${reason}`);
  }

  if (!solverFailed && solverResult) {
    const routes: OptimizeRouteResult[] = solverResult.routes.map((sequence) =>
      computeRouteMetrics(sequence, depot, tasks, distanceMatrix, timeMatrix),
    );
    const totalLoad = routes.reduce(
      (sum, routeResult) => sum + routeResult.load,
      0,
    );
    const totalEta = routes.reduce(
      (sum, routeResult) => sum + routeResult.etaMinutes,
      0,
    );
    const totalDistance = routes.reduce(
      (sum, routeResult) => sum + routeResult.distanceKm,
      0,
    );
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

  const heuristicResult = buildHeuristicResult(
    depot,
    tasks,
    distanceMatrix,
    timeMatrix,
  );
  heuristicResult.warnings = [
    ...warnings,
    'Используется эвристика построения маршрута.',
  ];
  return heuristicResult;
}

const optimizeLegacy = async (
  taskIds: string[],
  count = 1,
  method: OptimizeMethod = 'angle',
  actorId?: number,
): Promise<SharedRoutePlan | null> => {
  count = Math.max(1, Math.min(3, Number(count) || 1));
  const tasks = (
    await Promise.all(taskIds.map((id) => q.getTask(id) as Promise<TaskLike>))
  ).filter((t) => t && t.startCoordinates);
  if (!tasks.length) return null;
  count = Math.min(count, tasks.length);

  const center = {
    lat:
      tasks.reduce((s, t) => s + (t.startCoordinates!.lat || 0), 0) /
      tasks.length,
    lng:
      tasks.reduce((s, t) => s + (t.startCoordinates!.lng || 0), 0) /
      tasks.length,
  };

  const angle = (t: TaskLike): number =>
    Math.atan2(
      t.startCoordinates!.lat - center.lat,
      t.startCoordinates!.lng - center.lng,
    );

  const sorted = tasks.sort((a, b) => angle(a) - angle(b));
  const step = Math.ceil(sorted.length / count);
  const groups: TaskLike[][] = [];
  for (let i = 0; i < count; i++) {
    groups.push(sorted.slice(i * step, (i + 1) * step));
  }

  let finalGroups = groups;

  if (method === 'trip') {
    const orderedGroups: TaskLike[][] = [];
    for (const g of groups) {
      if (g.length < 2) {
        orderedGroups.push(g);
        continue;
      }
      const points = g
        .map((t) => `${t.startCoordinates!.lng},${t.startCoordinates!.lat}`)
        .join(';');
      try {
        const data = await route.trip<TripData>(points, { roundtrip: 'false' });
        const ordered = data.trips?.[0]?.waypoints
          ? data.trips[0].waypoints.map((wp) => g[wp.waypoint_index])
          : g;
        orderedGroups.push(ordered);
      } catch {
        orderedGroups.push(g);
      }
    }
    finalGroups = orderedGroups;
  }

  const routeInputs: RoutePlanRouteInput[] = finalGroups.map(
    (group, index) => ({
      order: index,
      tasks: group.map((task) => task._id.toString()),
    }),
  );

  if (!routeInputs.length) {
    return null;
  }

  const hints: RoutePlanTaskHint[] = tasks.map((task) => ({
    _id: task._id,
    title: task.title,
    startCoordinates: task.startCoordinates,
    finishCoordinates: task.finishCoordinates,
    start_location: task.start_location,
    end_location: task.end_location,
    route_distance_km: task.route_distance_km,
  }));

  return createDraftFromInputs(routeInputs, { actorId, method, count }, hints);
};

const isOptimizeTaskArray = (value: unknown[]): value is OptimizeTaskInput[] =>
  value.every((item) => item && typeof item === 'object' && 'id' in item);

const isOptimizeOptions = (value: unknown): value is OptimizeOptions =>
  value != null && typeof value === 'object' && !Array.isArray(value);

export async function optimize(
  tasks: OptimizeTaskInput[],
  options: OptimizeOptions,
): Promise<OptimizeResult>;
export async function optimize(
  taskIds: string[],
  count?: number,
  method?: OptimizeMethod,
  actorId?: number,
): Promise<SharedRoutePlan | null>;
export async function optimize(
  first: OptimizeTaskInput[] | string[],
  second?: number | OptimizeOptions,
  method?: OptimizeMethod,
  actorId?: number,
): Promise<OptimizeResult | SharedRoutePlan | null> {
  if (Array.isArray(first) && first.length && isOptimizeTaskArray(first)) {
    const options = isOptimizeOptions(second) ? second : {};
    return optimizeVrp(first, options);
  }

  const ids = Array.isArray(first)
    ? first.filter((item): item is string => typeof item === 'string')
    : [];
  const count = typeof second === 'number' ? second : undefined;
  return optimizeLegacy(ids, count, method, actorId);
}

export const __testing = {
  setMatrixBuilder(builder: MatrixBuilder | undefined): void {
    currentMatrixBuilder = builder;
  },
  setOrToolsSolver(solver: OrToolsSolver | undefined): void {
    currentOrToolsSolver = solver;
  },
  reset(): void {
    currentMatrixBuilder = undefined;
    currentOrToolsSolver = undefined;
  },
};
