// Назначение файла: интеграция с Wialon API для получения транспорта
// Основные модули: node-fetch
import fetch, { Response } from 'node-fetch';

export interface WialonLoginResult {
  eid: string;
  sid: string;
  user: { id: number; nm?: string };
}

export interface WialonUnitSensor {
  id: number;
  n: string;
  t?: string;
  m?: string;
  p?: number;
  f?: number;
  clb?: unknown;
  last_update?: number;
  value?: unknown;
}

export interface WialonUnitPositionRaw {
  t: number;
  x: number;
  y: number;
  s?: number;
  c?: number;
}

export interface WialonUnitRaw {
  id: number;
  nm: string;
  pos?: WialonUnitPositionRaw;
  sens?: WialonUnitSensor[];
}

export type WialonTrackPointRaw = WialonUnitPositionRaw;

export interface WialonTrackResponse {
  track: WialonTrackPointRaw[];
}

export interface UnitPosition {
  lat: number;
  lon: number;
  speed?: number;
  course?: number;
  updatedAt?: Date;
}

export interface UnitSensor {
  id: number;
  name: string;
  type?: string;
  value?: unknown;
  updatedAt?: Date;
}

export interface UnitInfo {
  id: number;
  name: string;
  position?: UnitPosition;
  sensors: UnitSensor[];
}

export interface TrackPoint {
  lat: number;
  lon: number;
  speed?: number;
  course?: number;
  timestamp: Date;
}

const DEFAULT_BASE_URL = process.env.WIALON_BASE_URL ?? 'https://hst-api.wialon.com';
const API_PATH = '/wialon/ajax.html';

interface RequestOptions {
  baseUrl?: string;
  sid?: string;
}

interface ErrorResponse {
  error: number;
  message?: string;
}

function buildUrl(baseUrl: string): string {
  const url = new URL(API_PATH, baseUrl);
  return url.toString();
}

function isErrorResponse(data: unknown): data is ErrorResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof (data as { error?: unknown }).error === 'number'
  );
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    const err = error as { message?: string };
    throw new Error(`Не удалось разобрать ответ Wialon: ${err.message ?? 'unknown'}`);
  }
}

async function request<T>(
  svc: string,
  params: Record<string, unknown>,
  options: RequestOptions = {},
): Promise<T> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const url = buildUrl(baseUrl);
  const search = new URLSearchParams();
  search.set('svc', svc);
  search.set('params', JSON.stringify(params));
  if (options.sid) {
    search.set('sid', options.sid);
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: search,
  });
  if (!res.ok) {
    throw new Error(`Wialon запрос ${svc} завершился с ошибкой ${res.status}`);
  }
  const data = await parseJson(res);
  if (isErrorResponse(data)) {
    throw new Error(
      `Wialon вернул ошибку ${data.error}${data.message ? `: ${data.message}` : ''}`,
    );
  }
  return data as T;
}

function normalizePosition(raw?: WialonUnitPositionRaw): UnitPosition | undefined {
  if (!raw) return undefined;
  return {
    lat: raw.y,
    lon: raw.x,
    speed: raw.s,
    course: raw.c,
    updatedAt: raw.t ? new Date(raw.t * 1000) : undefined,
  };
}

function normalizeSensor(sensor: WialonUnitSensor): UnitSensor {
  return {
    id: sensor.id,
    name: sensor.n,
    type: sensor.t,
    value: sensor.value ?? sensor.clb ?? sensor.f ?? sensor.p ?? sensor.m,
    updatedAt:
      typeof sensor.last_update === 'number'
        ? new Date(sensor.last_update * 1000)
        : undefined,
  };
}

function normalizeTrackPoint(point: WialonTrackPointRaw): TrackPoint {
  return {
    lat: point.y,
    lon: point.x,
    speed: point.s,
    course: point.c,
    timestamp: new Date(point.t * 1000),
  };
}

export async function login(token: string, baseUrl?: string): Promise<WialonLoginResult> {
  return request<WialonLoginResult>('token/login', { token }, { baseUrl });
}

export async function loadUnits(
  sid: string,
  baseUrl?: string,
): Promise<UnitInfo[]> {
  const response = await request<{ items?: WialonUnitRaw[] }>(
    'core/search_items',
    {
      spec: {
        itemsType: 'avl_unit',
        propName: 'sys_id',
        propValueMask: '*',
        sortType: 'sys_name',
      },
      force: 1,
      flags: 0x0001 | 0x0002 | 0x0400,
      from: 0,
      to: 0,
    },
    { baseUrl, sid },
  );
  const items = Array.isArray(response.items) ? response.items : [];
  return items.map((item) => ({
    id: item.id,
    name: item.nm,
    position: normalizePosition(item.pos),
    sensors: Array.isArray(item.sens)
      ? item.sens.map((s) => normalizeSensor(s))
      : [],
  }));
}

export async function loadTrack(
  sid: string,
  unitId: number,
  from: Date,
  to: Date,
  baseUrl?: string,
): Promise<TrackPoint[]> {
  const response = await request<WialonTrackResponse>(
    'unit/calc_track',
    {
      unitId,
      timeFrom: Math.floor(from.getTime() / 1000),
      timeTo: Math.floor(to.getTime() / 1000),
      flags: 0,
    },
    { baseUrl, sid },
  );
  return Array.isArray(response.track)
    ? response.track.map((p) => normalizeTrackPoint(p))
    : [];
}
