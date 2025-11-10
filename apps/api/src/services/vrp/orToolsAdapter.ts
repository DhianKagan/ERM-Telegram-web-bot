// Назначение: экспериментальная интеграция OR-Tools для решения VRP в Node.js.
// Модули: child_process, path, services/optimizer, config
import { spawn } from 'child_process';
import path from 'path';
import type { TaskLike } from '../optimizer';
import { vrpOrToolsEnabled } from '../../config';

export interface SolverTask extends TaskLike {
  demand?: number;
  serviceMinutes?: number;
  timeWindowMinutes?: [number, number];
}

export interface OrToolsSolveRequest {
  tasks: Array<{
    id: string;
    demand?: number;
    service_minutes?: number;
    time_window?: [number, number];
  }>;
  distance_matrix: number[][];
  vehicle_capacity?: number;
  vehicle_count?: number;
  depot_index?: number;
  time_windows?: Array<[number, number]>;
  time_limit_seconds?: number;
}

export interface OrToolsSolveResult {
  enabled: boolean;
  routes: string[][];
  totalDistanceKm: number;
  totalDurationMinutes: number;
  warnings: string[];
}

const pythonSolverPath = path.resolve(__dirname, 'or_tools_solver.py');

const parseWarnings = (source: unknown): string[] => {
  if (!Array.isArray(source)) {
    return [];
  }
  return source.filter((item): item is string => typeof item === 'string');
};

const runPythonSolver = async (payload: OrToolsSolveRequest): Promise<OrToolsSolveResult> => {
  if (!vrpOrToolsEnabled) {
    return {
      enabled: false,
      routes: [],
      totalDistanceKm: 0,
      totalDurationMinutes: 0,
      warnings: ['Фича-флаг VRP_ORTOOLS_ENABLED выключен.'],
    };
  }

  const requestJson = JSON.stringify(payload);

  return await new Promise<OrToolsSolveResult>((resolve, reject) => {
    const worker = spawn('python3', [pythonSolverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    worker.stdout.setEncoding('utf8');
    worker.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    worker.stderr.setEncoding('utf8');
    worker.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    worker.on('error', (error) => {
      reject(error);
    });

    worker.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`or_tools_solver.py завершился с кодом ${code}: ${stderr}`));
        return;
      }

      try {
        const parsed = JSON.parse(stdout);
        resolve({
          enabled: true,
          routes: Array.isArray(parsed.routes)
            ? parsed.routes.map((route: unknown[]) =>
                (Array.isArray(route) ? route : []).filter((item): item is string => typeof item === 'string'),
              )
            : [],
          totalDistanceKm: Number(parsed.total_distance_km) || 0,
          totalDurationMinutes: Number(parsed.total_duration_minutes) || 0,
          warnings: parseWarnings(parsed.warnings),
        });
      } catch (error) {
        reject(new Error(`Не удалось разобрать ответ OR-Tools: ${(error as Error).message}`));
      }
    });

    worker.stdin.write(requestJson);
    worker.stdin.end();
  });
};

const EARTH_RADIUS_KM = 6371;

const haversineDistance = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + sinLng * sinLng * Math.cos(lat1) * Math.cos(lat2);
  const distanceKm = 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
  return distanceKm;
};

const buildDistanceMatrix = (tasks: SolverTask[]): number[][] => {
  return tasks.map((fromTask) =>
    tasks.map((toTask) => {
      if (fromTask === toTask) {
        return 0;
      }
      const from = fromTask.startCoordinates;
      const to = toTask.startCoordinates;
      if (!from || !to) {
        return 0;
      }
      return Math.round(haversineDistance(from, to) * 1000);
    }),
  );
};

const buildTimeWindows = (tasks: SolverTask[]): Array<[number, number]> =>
  tasks.map((task) => task.timeWindowMinutes ?? [0, 24 * 60]);

const buildPythonTasks = (tasks: SolverTask[]): OrToolsSolveRequest['tasks'] =>
  tasks.map((task) => ({
    id: task._id.toString(),
    demand: task.demand,
    service_minutes: task.serviceMinutes,
  }));

export const createSampleProblem = (): OrToolsSolveRequest => {
  const sampleTasks: SolverTask[] = [
    {
      _id: { toString: () => 'depot' },
      startCoordinates: { lat: 50.4501, lng: 30.5234 },
      demand: 0,
      serviceMinutes: 0,
      timeWindowMinutes: [8 * 60, 18 * 60],
    },
    {
      _id: { toString: () => 'task-1' },
      startCoordinates: { lat: 50.4547, lng: 30.5166 },
      demand: 1,
      serviceMinutes: 15,
      timeWindowMinutes: [9 * 60, 12 * 60],
    },
    {
      _id: { toString: () => 'task-2' },
      startCoordinates: { lat: 50.4591, lng: 30.5796 },
      demand: 1,
      serviceMinutes: 20,
      timeWindowMinutes: [10 * 60, 14 * 60],
    },
    {
      _id: { toString: () => 'task-3' },
      startCoordinates: { lat: 50.4312, lng: 30.5155 },
      demand: 2,
      serviceMinutes: 25,
      timeWindowMinutes: [11 * 60, 17 * 60],
    },
  ];

  return {
    tasks: buildPythonTasks(sampleTasks),
    distance_matrix: buildDistanceMatrix(sampleTasks),
    vehicle_capacity: 3,
    vehicle_count: 1,
    depot_index: 0,
    time_windows: buildTimeWindows(sampleTasks),
    time_limit_seconds: 2,
  };
};

export const solveSampleRoute = async (): Promise<OrToolsSolveResult> => {
  const request = createSampleProblem();
  return runPythonSolver(request);
};

export const solveWithOrTools = runPythonSolver;
