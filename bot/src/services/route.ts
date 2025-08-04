// Назначение: запросы к сервису OSRM
// Модули: fetch, config
import { routingUrl } from '../config';

const base = routingUrl.replace(/\/route$/, '');

const allowed = ['table', 'nearest', 'match', 'trip'] as const;

type Endpoint = (typeof allowed)[number];

/** Проверка формата координат */
export function validateCoords(value: string): string {
  const coordRx = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?(;-?\d+(\.\d+)?,-?\d+(\.\d+)?)*$/;
  if (!coordRx.test(value)) throw new Error('Некорректные координаты');
  return value;
}

async function call<T>(
  endpoint: Endpoint,
  coords: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  if (!allowed.includes(endpoint)) throw new Error('Неизвестный эндпойнт');
  const safeCoords = validateCoords(coords);
  const url = new URL(`${base}/${endpoint}`);
  url.searchParams.append(endpoint === 'nearest' ? 'point' : 'points', safeCoords);
  for (const [k, v] of Object.entries(params)) url.searchParams.append(k, String(v));
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.code || 'Route error');
  return data as T;
}

export interface Point {
  lat: number;
  lng: number;
}

export interface RouteDistance {
  distance: number | undefined;
  waypoints?: unknown;
}

export async function getRouteDistance(
  start: Point,
  end: Point,
): Promise<RouteDistance> {
  const url = `${routingUrl}?start=${start.lng},${start.lat}&end=${end.lng},${end.lat}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.code !== 'Ok') {
    throw new Error(data.message || data.code || 'Route error');
  }
  return {
    distance: data.routes?.[0]?.distance,
    waypoints: data.waypoints,
  };
}

export async function table(
  points: string,
  params: Record<string, string | number> = {},
): Promise<unknown> {
  return call('table', points, params);
}

export async function nearest(
  point: string,
  params: Record<string, string | number> = {},
): Promise<unknown> {
  return call('nearest', point, params);
}

export async function match(
  points: string,
  params: Record<string, string | number> = {},
): Promise<unknown> {
  return call('match', points, params);
}

export async function trip(
  points: string,
  params: Record<string, string | number> = {},
): Promise<unknown> {
  return call('trip', points, params);
}

// Совместимость с CommonJS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(module as any).exports = {
  getRouteDistance,
  table,
  nearest,
  match,
  trip,
};

