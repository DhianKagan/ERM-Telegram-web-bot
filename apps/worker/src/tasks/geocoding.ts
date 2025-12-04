// Назначение: фоновые задачи геокодирования адресов
// Основные модули: fetch, logger
import type { Coordinates } from 'shared';
import type { WorkerConfig } from '../config';
import { logger } from '../logger';

const REQUEST_TIMEOUT_MS = 8000;

const normalizeAddress = (value: string): string => {
  const trimmed = value.trim();
  return trimmed.replace(/\s+/g, ' ');
};

const parseCoordinate = (value: unknown): number | null => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

type GeocoderProvider = WorkerConfig['geocoder']['provider'];

type OrsGeometry = {
  coordinates?: unknown;
};

type OrsFeature = {
  geometry?: OrsGeometry;
};

type OrsResponse = {
  features?: unknown;
};

const extractNominatimCoordinates = (payload: unknown): Coordinates | null => {
  const firstItem = Array.isArray(payload) ? payload[0] : payload;
  if (!firstItem) {
    return null;
  }
  const lat = parseCoordinate((firstItem as Record<string, unknown>).lat);
  const lng = parseCoordinate(
    (firstItem as Record<string, unknown>).lon ??
      (firstItem as Record<string, unknown>).lng ??
      (firstItem as Record<string, unknown>).longitude,
  );
  if (lat === null || lng === null) {
    return null;
  }
  return { lat, lng } satisfies Coordinates;
};

const extractOrsCoordinates = (payload: unknown): Coordinates | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const features = (payload as OrsResponse).features;
  if (!Array.isArray(features) || features.length === 0) {
    return null;
  }
  const firstFeature = features[0] as OrsFeature | undefined;
  const coordinates = firstFeature?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }
  const lng = parseCoordinate(coordinates[0]);
  const lat = parseCoordinate(coordinates[1]);
  if (lat === null || lng === null) {
    return null;
  }
  return { lat, lng } satisfies Coordinates;
};

const prepareRequest = (
  normalized: string,
  config: WorkerConfig['geocoder'],
): { url: URL; headers: Record<string, string> } => {
  const url = new URL(config.baseUrl);
  const headers: Record<string, string> = {
    'User-Agent': config.userAgent,
  };

  if (config.proxyToken) {
    headers['X-Proxy-Token'] = config.proxyToken;
  }

  if (config.provider === 'openrouteservice') {
    if (!url.searchParams.has('size')) {
      url.searchParams.set('size', '1');
    }
    url.searchParams.set('text', normalized);
    if (config.apiKey) {
      headers.Authorization = config.apiKey;
    }
    return { url, headers };
  }

  if (!url.searchParams.has('format')) {
    url.searchParams.set('format', 'json');
  }
  if (!url.searchParams.has('limit')) {
    url.searchParams.set('limit', '1');
  }
  url.searchParams.set('q', normalized);
  if (config.email) {
    url.searchParams.set('email', config.email);
    headers['X-Nominatim-Email'] = config.email;
  }

  return { url, headers };
};

export const geocodeAddress = async (
  address: string,
  config: WorkerConfig['geocoder'],
): Promise<Coordinates | null> => {
  if (!config.enabled || !config.baseUrl) {
    return null;
  }

  const normalized = normalizeAddress(address);
  if (!normalized) {
    return null;
  }

  const { url, headers } = prepareRequest(normalized, config);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) {
      return null;
    }
    const payload = await response.json();
    const provider: GeocoderProvider = config.provider;
    return provider === 'openrouteservice'
      ? extractOrsCoordinates(payload)
      : extractNominatimCoordinates(payload);
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError';
    const level = isAbort ? 'warn' : 'error';
    logger[level](
      {
        address: normalized,
        error,
      },
      'Геокодер не вернул координаты',
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
};
