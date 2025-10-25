// Назначение: адаптер для получения матриц расстояний/времени из GraphHopper.
// Основные модули: config, fetch
import { graphhopperConfig } from '../../config';

export interface TravelMatrixOptions {
  averageSpeedKmph: number;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface TravelMatrixResult {
  provider: 'graphhopper' | 'haversine';
  distanceMatrix: number[][];
  timeMatrix: number[][];
  warnings: string[];
}

type GraphhopperFetcher = (input: string, init: RequestInit) => Promise<Response>;

const EARTH_RADIUS_KM = 6371;

const toRadians = (value: number): number => (value * Math.PI) / 180;

const haversineMeters = (
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
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h))) * 1000);
};

const buildHaversineMatrix = (
  points: Array<{ lat: number; lng: number }>,
): number[][] =>
  points.map((from, fromIndex) =>
    points.map((to, toIndex) => {
      if (fromIndex === toIndex) {
        return 0;
      }
      return haversineMeters(from, to);
    }),
  );

const toSecondsFromMeters = (distanceMeters: number, averageSpeedKmph: number): number => {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    return 0;
  }
  const speed = Number.isFinite(averageSpeedKmph) && averageSpeedKmph > 0 ? averageSpeedKmph : 30;
  return Math.max(0, Math.round((distanceMeters * 3.6) / speed));
};

const buildFallbackResult = (
  points: Array<{ lat: number; lng: number }>,
  options: TravelMatrixOptions,
  extraWarnings: string[] = [],
): TravelMatrixResult => {
  const distanceMatrix = buildHaversineMatrix(points);
  const timeMatrix = distanceMatrix.map((row) =>
    row.map((cell) => toSecondsFromMeters(cell, options.averageSpeedKmph)),
  );
  return {
    provider: 'haversine',
    distanceMatrix,
    timeMatrix,
    warnings: extraWarnings,
  };
};

let customFetcher: GraphhopperFetcher | undefined;

const getFetcher = (): GraphhopperFetcher => {
  if (typeof customFetcher === 'function') {
    return customFetcher;
  }
  if (typeof fetch === 'function') {
    return (input, init) => fetch(input, init);
  }
  throw new Error('Глобальный fetch недоступен для вызова GraphHopper');
};

const sanitizeMatrix = (matrix: unknown, size: number): number[][] => {
  if (!Array.isArray(matrix)) {
    return Array.from({ length: size }, () => Array(size).fill(0));
  }
  return matrix.map((row, rowIndex) => {
    if (!Array.isArray(row)) {
      return Array(size).fill(0);
    }
    return row.map((value, columnIndex) => {
      if (rowIndex === columnIndex) {
        return 0;
      }
      const numeric = Number(value);
      return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
    });
  });
};

export async function buildTravelMatrix(
  points: Array<{ lat: number; lng: number }>,
  options: TravelMatrixOptions,
): Promise<TravelMatrixResult> {
  if (!points.length) {
    return {
      provider: 'haversine',
      distanceMatrix: [],
      timeMatrix: [],
      warnings: ['Список точек пуст.'],
    };
  }

  if (!graphhopperConfig.matrixUrl) {
    return buildFallbackResult(points, options, ['GraphHopper отключён. Используем Haversine.']);
  }

  const fetcher = getFetcher();
  const url = new URL(graphhopperConfig.matrixUrl);
  if (graphhopperConfig.apiKey) {
    url.searchParams.set('key', graphhopperConfig.apiKey);
  }
  const controller = options.signal
    ? undefined
    : typeof AbortController === 'function'
    ? new AbortController()
    : undefined;

  let timeoutId: NodeJS.Timeout | undefined;
  if (controller && typeof options.timeoutMs === 'number' && options.timeoutMs > 0) {
    timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);
    timeoutId.unref?.();
  }

  try {
    const response = await fetcher(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile: graphhopperConfig.profile || 'car',
        points: points.map((point) => [point.lng, point.lat]),
        out_arrays: ['distances', 'times'],
      }),
      signal: options.signal ?? controller?.signal,
    });

    if (!response.ok) {
      const message = `GraphHopper вернул статус ${response.status}`;
      return buildFallbackResult(points, options, [message]);
    }

    const payload = (await response.json()) as {
      distances?: unknown;
      times?: unknown;
      info?: { messages?: string[] };
    };
    const size = points.length;
    const distanceMatrix = sanitizeMatrix(payload.distances, size);
    const timeMatrix = sanitizeMatrix(payload.times, size);
    const warnings = Array.isArray(payload.info?.messages)
      ? payload.info.messages.filter((item): item is string => typeof item === 'string')
      : [];
    return {
      provider: 'graphhopper',
      distanceMatrix,
      timeMatrix,
      warnings,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Неизвестная ошибка GraphHopper';
    return buildFallbackResult(points, options, [`GraphHopper недоступен: ${reason}`]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export const __testing = {
  setFetcher(fetcher: GraphhopperFetcher | undefined): void {
    customFetcher = fetcher;
  },
};
