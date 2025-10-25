// Оптимизация маршрутов через VRP-движок OR-Tools
// Модули: vrp/orToolsAdapter
import {
  solveWithOrTools,
  type OrToolsSolveRequest,
  type OrToolsSolveResult,
} from './vrp/orToolsAdapter';

export interface OptimizeTaskInput {
  id: string;
  coordinates: { lat: number; lng: number };
  demand?: number;
  serviceMinutes?: number;
  timeWindow?: [number, number];
  title?: string;
  startAddress?: string;
  finishAddress?: string;
}

export interface OptimizeOptions {
  vehicleCapacity: number;
  vehicleCount: number;
  timeWindows?: Array<[number, number]>;
  averageSpeedKmph?: number;
}

export interface RouteOptimizationRouteResult {
  vehicleIndex: number;
  taskIds: string[];
  distanceKm: number;
  etaMinutes: number;
  load: number;
}

export interface RouteOptimizationResult {
  routes: RouteOptimizationRouteResult[];
  totalDistanceKm: number;
  totalEtaMinutes: number;
  totalLoad: number;
  warnings: string[];
}

const EARTH_RADIUS_KM = 6371;
const DEFAULT_TIME_WINDOW: [number, number] = [0, 24 * 60];
const DEPOT_ID = '__depot__';

const toRadians = (value: number): number => (value * Math.PI) / 180;

const haversineDistanceKm = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number => {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + sinLng * sinLng * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
};

const buildDistanceMatrix = (
  points: Array<{ coordinates?: { lat: number; lng: number } | undefined }>,
): number[][] =>
  points.map((from, fromIndex) =>
    points.map((to, toIndex) => {
      if (fromIndex === toIndex) {
        return 0;
      }
      const fromCoords = from.coordinates;
      const toCoords = to.coordinates;
      if (!fromCoords || !toCoords) {
        return 0;
      }
      const distanceKm = haversineDistanceKm(fromCoords, toCoords);
      return Math.round(distanceKm * 1000);
    }),
  );

const metersToMinutes = (meters: number, averageSpeedKmph: number): number => {
  if (!Number.isFinite(averageSpeedKmph) || averageSpeedKmph <= 0) {
    return 0;
  }
  const minutes = (meters * 60) / (averageSpeedKmph * 1000);
  return Math.max(0, minutes);
};

const ensureDepotCoordinates = (
  tasks: OptimizeTaskInput[],
): { lat: number; lng: number } => {
  if (tasks.length === 1) {
    return { ...tasks[0].coordinates };
  }
  const sum = tasks.reduce(
    (acc, task) => {
      acc.lat += task.coordinates.lat;
      acc.lng += task.coordinates.lng;
      return acc;
    },
    { lat: 0, lng: 0 },
  );
  return {
    lat: sum.lat / tasks.length,
    lng: sum.lng / tasks.length,
  };
};

const normalizeTimeWindows = (
  tasks: OptimizeTaskInput[],
  options: OptimizeOptions,
): Array<[number, number]> => {
  const result: Array<[number, number]> = [];
  const source = Array.isArray(options.timeWindows) ? options.timeWindows : [];
  result.push(source[0] ?? DEFAULT_TIME_WINDOW);
  tasks.forEach((task, index) => {
    if (Array.isArray(task.timeWindow)) {
      result.push(task.timeWindow);
      return;
    }
    result.push(source[index + 1] ?? DEFAULT_TIME_WINDOW);
  });
  return result;
};

const createRequest = (
  tasks: OptimizeTaskInput[],
  options: OptimizeOptions,
): { request: OrToolsSolveRequest; depotCoordinates: { lat: number; lng: number } } => {
  const averageSpeed = options.averageSpeedKmph ?? 30;
  const depotCoordinates = ensureDepotCoordinates(tasks);
  const solverTasks = [
    {
      id: DEPOT_ID,
      coordinates: depotCoordinates,
      demand: 0,
      serviceMinutes: 0,
    },
    ...tasks.map((task) => ({
      id: task.id,
      coordinates: task.coordinates,
      demand: task.demand ?? 0,
      serviceMinutes: task.serviceMinutes ?? 0,
    })),
  ];

  const timeWindows = normalizeTimeWindows(tasks, options);
  const distanceMatrix = buildDistanceMatrix(solverTasks);

  const request: OrToolsSolveRequest = {
    tasks: solverTasks.map((task, index) => ({
      id: task.id,
      demand: task.demand,
      service_minutes: task.serviceMinutes,
      time_window: timeWindows[index],
    })),
    distance_matrix: distanceMatrix,
    vehicle_capacity: options.vehicleCapacity,
    vehicle_count: options.vehicleCount,
    depot_index: 0,
    time_windows: timeWindows,
    time_limit_seconds: 5,
    average_speed_kmph: averageSpeed,
  };

  return { request, depotCoordinates };
};

const extractWarnings = (
  result: OrToolsSolveResult | null,
  extra: string[] = [],
): string[] => {
  const base = Array.isArray(result?.warnings) ? result?.warnings ?? [] : [];
  return [...base, ...extra].filter((item, index, arr) => Boolean(item) && arr.indexOf(item) === index);
};

export async function optimize(
  tasks: OptimizeTaskInput[],
  options: OptimizeOptions,
): Promise<RouteOptimizationResult> {
  const validTasks = tasks.filter((task) =>
    Number.isFinite(task.coordinates.lat) && Number.isFinite(task.coordinates.lng),
  );
  if (!validTasks.length) {
    return {
      routes: [],
      totalDistanceKm: 0,
      totalEtaMinutes: 0,
      totalLoad: 0,
      warnings: ['Нет валидных задач для оптимизации.'],
    };
  }

  const averageSpeed = options.averageSpeedKmph ?? 30;
  const { request } = createRequest(validTasks, options);

  let solveResult: OrToolsSolveResult;
  try {
    solveResult = await solveWithOrTools(request);
  } catch (error) {
    const message =
      error instanceof Error
        ? `Ошибка VRP: ${error.message}`
        : 'Не удалось выполнить расчёт маршрутов.';
    return {
      routes: [],
      totalDistanceKm: 0,
      totalEtaMinutes: 0,
      totalLoad: 0,
      warnings: [message],
    };
  }

  const solverIds = request.tasks.map((task) => task.id);
  const idToIndex = new Map<string, number>(solverIds.map((id, index) => [id, index]));
  const distanceMatrix = request.distance_matrix;
  const idToTask = new Map<string, OptimizeTaskInput>(validTasks.map((task) => [task.id, task]));

  const routes: RouteOptimizationRouteResult[] = [];
  let totalDistanceMeters = 0;
  let totalEtaMinutes = 0;
  let totalLoad = 0;

  for (let routeIndex = 0; routeIndex < solveResult.routes.length; routeIndex += 1) {
    const sequence = solveResult.routes[routeIndex];
    const filtered = sequence.filter((id) => id !== DEPOT_ID && idToTask.has(id));
    if (!filtered.length) {
      continue;
    }
    let previousId = DEPOT_ID;
    let routeMeters = 0;
    let routeMinutes = 0;
    let routeLoad = 0;

    for (const taskId of filtered) {
      const task = idToTask.get(taskId);
      if (!task) {
        continue;
      }
      const fromIndex = idToIndex.get(previousId) ?? 0;
      const toIndex = idToIndex.get(taskId) ?? 0;
      const segmentMeters = distanceMatrix[fromIndex]?.[toIndex] ?? 0;
      routeMeters += segmentMeters;
      routeMinutes += metersToMinutes(segmentMeters, averageSpeed);
      if (typeof task.serviceMinutes === 'number' && Number.isFinite(task.serviceMinutes)) {
        routeMinutes += Math.max(0, task.serviceMinutes);
      }
      if (typeof task.demand === 'number' && Number.isFinite(task.demand)) {
        routeLoad += task.demand;
      }
      previousId = taskId;
    }

    const lastIndex = idToIndex.get(previousId);
    const depotIndex = idToIndex.get(DEPOT_ID) ?? 0;
    if (typeof lastIndex === 'number') {
      const returnMeters = distanceMatrix[lastIndex]?.[depotIndex] ?? 0;
      routeMeters += returnMeters;
      routeMinutes += metersToMinutes(returnMeters, averageSpeed);
    }

    const distanceKm = routeMeters / 1000;
    const etaMinutes = Math.round(routeMinutes);
    routes.push({
      vehicleIndex: routeIndex,
      taskIds: filtered,
      distanceKm: Number(distanceKm.toFixed(3)),
      etaMinutes,
      load: Number(routeLoad.toFixed(2)),
    });
    totalDistanceMeters += routeMeters;
    totalEtaMinutes += etaMinutes;
    totalLoad += routeLoad;
  }

  const warnings = extractWarnings(solveResult);
  const totalDistanceKm = solveResult.totalDistanceKm || Number((totalDistanceMeters / 1000).toFixed(3));

  return {
    routes,
    totalDistanceKm: Number(totalDistanceKm.toFixed(3)),
    totalEtaMinutes,
    totalLoad: Number(totalLoad.toFixed(2)),
    warnings,
  };
}
