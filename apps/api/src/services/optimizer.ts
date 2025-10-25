// Оптимизация маршрутов через OR-Tools и GraphHopper с эвристическим фолбэком.
// Модули: vrp/orToolsAdapter, vrp/graphhopperAdapter
import {
  solveWithOrTools,
  type OrToolsSolveRequest,
  type OrToolsSolveResult,
} from './vrp/orToolsAdapter';
import {
  buildTravelMatrix,
  type TravelMatrixResult,
  type TravelMatrixOptions,
} from './vrp/graphhopperAdapter';

export interface OptimizeTaskInput {
  id: string;
  coordinates: { lat: number; lng: number };
  demand?: number;
  weight?: number;
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
  timeLimitSeconds?: number;
  matrixTimeoutMs?: number;
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

const DEFAULT_TIME_WINDOW: [number, number] = [0, 24 * 60];
const DEPOT_ID = '__depot__';

interface SolverTaskDefinition {
  id: string;
  coordinates: { lat: number; lng: number };
  weight: number;
  serviceMinutes: number;
  timeWindow: [number, number];
  index: number;
}

interface SolverContext {
  solverTasks: SolverTaskDefinition[];
  distanceMatrix: number[][];
  timeMatrix: number[][];
  request: OrToolsSolveRequest;
  averageSpeed: number;
  matrixProvider: TravelMatrixResult['provider'];
  warnings: string[];
}

type OrToolsSolver = typeof solveWithOrTools;
type MatrixBuilder = (
  points: Array<{ lat: number; lng: number }>,
  options: TravelMatrixOptions,
) => Promise<TravelMatrixResult>;

let currentSolver: OrToolsSolver = solveWithOrTools;
let currentMatrixBuilder: MatrixBuilder = buildTravelMatrix;

const getTaskWeight = (task: OptimizeTaskInput): number => {
  const candidates = [task.weight, task.demand];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return Math.max(0, Number(candidate));
    }
  }
  return 0;
};

const getServiceMinutes = (task: OptimizeTaskInput): number => {
  const value = Number(task.serviceMinutes);
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value;
};

const metersToMinutes = (meters: number, averageSpeedKmph: number): number => {
  if (!Number.isFinite(meters) || meters <= 0) {
    return 0;
  }
  const speed = Number.isFinite(averageSpeedKmph) && averageSpeedKmph > 0 ? averageSpeedKmph : 30;
  return (meters * 60) / (speed * 1000);
};

const ensureDepotCoordinates = (tasks: OptimizeTaskInput[]): { lat: number; lng: number } => {
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
      const [start, end] = task.timeWindow;
      const safeStart = Number.isFinite(start) ? Math.max(0, Number(start)) : DEFAULT_TIME_WINDOW[0];
      const safeEnd = Number.isFinite(end) ? Math.max(safeStart, Number(end)) : DEFAULT_TIME_WINDOW[1];
      result.push([safeStart, safeEnd]);
      return;
    }
    const fallback = source[index + 1] ?? DEFAULT_TIME_WINDOW;
    result.push([fallback[0], fallback[1]]);
  });
  return result;
};

const mergeWarnings = (...sources: Array<Iterable<string> | undefined>): string[] => {
  const unique = new Set<string>();
  for (const source of sources) {
    if (!source) continue;
    for (const item of source) {
      if (typeof item !== 'string') continue;
      const trimmed = item.trim();
      if (trimmed) {
        unique.add(trimmed);
      }
    }
  }
  return Array.from(unique);
};

const getTravelMinutes = (context: SolverContext, fromIndex: number, toIndex: number): number => {
  const seconds = context.timeMatrix[fromIndex]?.[toIndex];
  if (Number.isFinite(seconds) && Number(seconds) >= 0) {
    return Number(seconds) / 60;
  }
  const meters = context.distanceMatrix[fromIndex]?.[toIndex] ?? 0;
  return metersToMinutes(meters, context.averageSpeed);
};

const buildSolverContext = async (
  tasks: OptimizeTaskInput[],
  options: OptimizeOptions,
): Promise<SolverContext> => {
  const averageSpeed = options.averageSpeedKmph ?? 30;
  const vehicleCount = Math.max(1, Math.trunc(options.vehicleCount ?? 1));
  if (!Number.isFinite(vehicleCount) || vehicleCount <= 0) {
    throw new Error('Количество машин должно быть положительным числом.');
  }

  const depotCoordinates = ensureDepotCoordinates(tasks);
  const timeWindows = normalizeTimeWindows(tasks, options);

  const solverTasks: SolverTaskDefinition[] = [];
  solverTasks.push({
    id: DEPOT_ID,
    coordinates: depotCoordinates,
    weight: 0,
    serviceMinutes: 0,
    timeWindow: timeWindows[0] ?? DEFAULT_TIME_WINDOW,
    index: 0,
  });

  tasks.forEach((task, taskIndex) => {
    const index = solverTasks.length;
    solverTasks.push({
      id: task.id,
      coordinates: task.coordinates,
      weight: getTaskWeight(task),
      serviceMinutes: getServiceMinutes(task),
      timeWindow: timeWindows[taskIndex + 1] ?? DEFAULT_TIME_WINDOW,
      index,
    });
  });

  const travelMatrix = await currentMatrixBuilder(
    solverTasks.map((task) => task.coordinates),
    {
      averageSpeedKmph: averageSpeed,
      timeoutMs: options.matrixTimeoutMs,
    },
  );

  const request: OrToolsSolveRequest = {
    tasks: solverTasks.map((task) => ({
      id: task.id,
      demand: task.weight,
      service_minutes: task.serviceMinutes,
      time_window: task.timeWindow,
    })),
    distance_matrix: travelMatrix.distanceMatrix,
    time_matrix: travelMatrix.timeMatrix,
    vehicle_capacity: options.vehicleCapacity,
    vehicle_count: vehicleCount,
    depot_index: 0,
    time_windows: solverTasks.map((task) => task.timeWindow),
    time_limit_seconds: options.timeLimitSeconds ?? 10,
    average_speed_kmph: averageSpeed,
  };

  return {
    solverTasks,
    distanceMatrix: travelMatrix.distanceMatrix,
    timeMatrix: travelMatrix.timeMatrix,
    request,
    averageSpeed,
    matrixProvider: travelMatrix.provider,
    warnings: travelMatrix.warnings,
  };
};

const buildSolverResult = (
  context: SolverContext,
  result: OrToolsSolveResult,
): RouteOptimizationResult => {
  const idToIndex = new Map<string, number>(
    context.solverTasks.map((task) => [task.id, task.index]),
  );
  const indexToTask = new Map<number, SolverTaskDefinition>(
    context.solverTasks.map((task) => [task.index, task]),
  );

  const routes: RouteOptimizationRouteResult[] = [];
  let totalDistanceMeters = 0;
  let totalEtaMinutes = 0;
  let totalLoad = 0;

  for (let routeIndex = 0; routeIndex < result.routes.length; routeIndex += 1) {
    const sequence = result.routes[routeIndex];
    const filtered = sequence.filter((id) => id !== DEPOT_ID && idToIndex.has(id));
    if (!filtered.length) {
      continue;
    }
    let previousIndex = idToIndex.get(DEPOT_ID) ?? 0;
    let routeMeters = 0;
    let routeMinutes = 0;
    let routeLoad = 0;

    for (const taskId of filtered) {
      const taskIndex = idToIndex.get(taskId);
      if (typeof taskIndex !== 'number') {
        continue;
      }
      const task = indexToTask.get(taskIndex);
      if (!task) {
        continue;
      }
      const segmentMeters = context.distanceMatrix[previousIndex]?.[taskIndex] ?? 0;
      routeMeters += segmentMeters;
      routeMinutes += getTravelMinutes(context, previousIndex, taskIndex);
      routeMinutes += task.serviceMinutes;
      routeLoad += task.weight;
      previousIndex = taskIndex;
    }

    if (typeof previousIndex === 'number') {
      const returnMeters = context.distanceMatrix[previousIndex]?.[0] ?? 0;
      routeMeters += returnMeters;
      routeMinutes += getTravelMinutes(context, previousIndex, 0);
    }

    const distanceKm = Number((routeMeters / 1000).toFixed(3));
    const etaMinutes = Math.round(routeMinutes);
    const load = Number(routeLoad.toFixed(2));

    routes.push({
      vehicleIndex: routeIndex,
      taskIds: filtered,
      distanceKm,
      etaMinutes,
      load,
    });
    totalDistanceMeters += routeMeters;
    totalEtaMinutes += etaMinutes;
    totalLoad += routeLoad;
  }

  const calculatedDistanceKm = Number((totalDistanceMeters / 1000).toFixed(3));
  const totalDistanceKm = Number.isFinite(result.totalDistanceKm)
    ? Number(Number(result.totalDistanceKm).toFixed(3))
    : calculatedDistanceKm;
  const totalEta = totalEtaMinutes;

  return {
    routes,
    totalDistanceKm,
    totalEtaMinutes: totalEta,
    totalLoad: Number(totalLoad.toFixed(2)),
    warnings: [],
  };
};

const buildHeuristicResult = (
  context: SolverContext,
  vehicleCapacity: number,
  vehicleCount: number,
): RouteOptimizationResult => {
  const tasks = context.solverTasks.slice(1);
  const capacity = Number.isFinite(vehicleCapacity) && vehicleCapacity > 0 ? vehicleCapacity : Number.POSITIVE_INFINITY;
  const vehicles = Array.from({ length: vehicleCount }, (_, index) => ({
    vehicleIndex: index,
    currentIndex: 0,
    load: 0,
    timeMinutes: context.solverTasks[0]?.timeWindow?.[0] ?? 0,
    distanceMeters: 0,
    sequence: [] as string[],
  }));

  const unassigned: string[] = [];

  const sortedTasks = tasks.slice().sort((a, b) => a.timeWindow[0] - b.timeWindow[0]);

  for (const task of sortedTasks) {
    let assigned = false;
    for (const vehicle of vehicles) {
      const projectedLoad = vehicle.load + task.weight;
      if (projectedLoad > capacity) {
        continue;
      }
      const travelMinutes = getTravelMinutes(context, vehicle.currentIndex, task.index);
      const arrival = vehicle.timeMinutes + travelMinutes;
      const start = Math.max(arrival, task.timeWindow[0]);
      if (start > task.timeWindow[1]) {
        continue;
      }
      const waitMinutes = start - arrival;
      const segmentMeters = context.distanceMatrix[vehicle.currentIndex]?.[task.index] ?? 0;
      vehicle.sequence.push(task.id);
      vehicle.distanceMeters += segmentMeters;
      vehicle.timeMinutes = arrival + waitMinutes + task.serviceMinutes;
      vehicle.load = projectedLoad;
      vehicle.currentIndex = task.index;
      assigned = true;
      break;
    }
    if (!assigned) {
      unassigned.push(task.id);
    }
  }

  const routes: RouteOptimizationRouteResult[] = [];
  let totalDistanceMeters = 0;
  let totalEtaMinutes = 0;
  let totalLoad = 0;

  vehicles.forEach((vehicle) => {
    if (!vehicle.sequence.length) {
      return;
    }
    const returnMeters = context.distanceMatrix[vehicle.currentIndex]?.[0] ?? 0;
    const returnMinutes = getTravelMinutes(context, vehicle.currentIndex, 0);
    vehicle.distanceMeters += returnMeters;
    const etaMinutes = Math.round(vehicle.timeMinutes + returnMinutes);
    const distanceKm = Number((vehicle.distanceMeters / 1000).toFixed(3));
    const load = Number(vehicle.load.toFixed(2));
    routes.push({
      vehicleIndex: vehicle.vehicleIndex,
      taskIds: vehicle.sequence,
      distanceKm,
      etaMinutes,
      load,
    });
    totalDistanceMeters += vehicle.distanceMeters;
    totalEtaMinutes += etaMinutes;
    totalLoad += vehicle.load;
  });

  const warnings = unassigned.length
    ? [`Эвристика: не удалось назначить задачи ${unassigned.join(', ')}.`]
    : ['Решение получено эвристикой без VRP движка.'];

  return {
    routes,
    totalDistanceKm: Number((totalDistanceMeters / 1000).toFixed(3)),
    totalEtaMinutes,
    totalLoad: Number(totalLoad.toFixed(2)),
    warnings,
  };
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

  const vehicleCount = Math.max(1, Math.trunc(options.vehicleCount ?? 1));
  const context = await buildSolverContext(validTasks, options);

  let solverResult: OrToolsSolveResult | null = null;
  let solverError: unknown;
  try {
    solverResult = await currentSolver(context.request);
  } catch (error) {
    solverError = error;
  }

  const combinedWarnings: string[] = [];
  if (solverError) {
    combinedWarnings.push(
      solverError instanceof Error
        ? `Падение VRP движка: ${solverError.message}`
        : 'Падение VRP движка: неизвестная ошибка',
    );
  }

  const solverEnabled = Boolean(solverResult?.enabled);
  const hasRoutes = Boolean(solverResult?.routes?.length);

  if (!solverEnabled || !hasRoutes) {
    const incidentDetails = {
      provider: context.matrixProvider,
      tasks: context.solverTasks.length - 1,
      vehicles: vehicleCount,
      solverEnabled,
      solverWarnings: solverResult?.warnings,
    };
    if (solverError) {
      console.error('VRP движок недоступен, используем эвристику', {
        ...incidentDetails,
        error: solverError instanceof Error ? solverError.message : solverError,
      });
    } else {
      console.error('VRP движок вернул пустой результат, используем эвристику', incidentDetails);
    }
    const fallback = buildHeuristicResult(context, options.vehicleCapacity, vehicleCount);
    return {
      ...fallback,
      warnings: mergeWarnings(context.warnings, solverResult?.warnings, combinedWarnings, fallback.warnings),
    };
  }

  const solved = buildSolverResult(context, solverResult as OrToolsSolveResult);
  const warnings = mergeWarnings(context.warnings, solverResult?.warnings, combinedWarnings);
  return {
    ...solved,
    warnings,
  };
}

export const __testing = {
  setOrToolsSolver(solver?: OrToolsSolver): void {
    currentSolver = solver ?? solveWithOrTools;
  },
  setMatrixBuilder(builder?: MatrixBuilder): void {
    currentMatrixBuilder = builder ?? buildTravelMatrix;
  },
  reset(): void {
    currentSolver = solveWithOrTools;
    currentMatrixBuilder = buildTravelMatrix;
  },
};
