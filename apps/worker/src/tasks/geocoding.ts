// Назначение: фоновые задачи геокодирования адресов
// Основные модули: fetch, logger
import type { Coordinates } from 'shared';
import type { WorkerConfig } from '../config';
import { logger } from '../logger';

const REQUEST_TIMEOUT_MS = 8000;
const MAPS_RESOLVE_TIMEOUT_MS = 3000;

const normalizeAddress = (value: string): string => {
  const trimmed = value.trim();
  return trimmed.replace(/\s+/g, ' ');
};

const parseCoordinate = (value: unknown): number | null => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const isCoordinatePairValid = (
  lat: number | null,
  lng: number | null,
): boolean =>
  lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

const extractCoordinatesFromText = (value: string): Coordinates | null => {
  const coordinatePattern = /(-?\d{1,3}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)/g;
  for (const match of value.matchAll(coordinatePattern)) {
    const lat = parseCoordinate(match[1]);
    const lng = parseCoordinate(match[2]);
    if (isCoordinatePairValid(lat, lng)) {
      return { lat, lng } satisfies Coordinates;
    }
  }
  return null;
};

const parseUrlSafe = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch (error) {
    logger.debug({ error, value }, 'Не удалось разобрать URL адреса');
    return null;
  }
};

const extractPlaceNameFromGoogleUrl = (value: string): string | null => {
  const parsed = parseUrlSafe(value);
  if (!parsed) {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  const isGoogleHost =
    hostname.includes('google') || hostname.includes('goo.gl');
  if (!isGoogleHost) {
    return null;
  }

  const queryName = parsed.searchParams.get('q');
  if (queryName) {
    const normalizedQuery = queryName.trim();
    if (normalizedQuery) {
      return normalizedQuery;
    }
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  const placeIndex = segments.findIndex(
    (segment) => segment.toLowerCase() === 'place',
  );
  if (placeIndex !== -1 && segments[placeIndex + 1]) {
    const placeRaw = decodeURIComponent(segments[placeIndex + 1]).replace(
      /\+/g,
      ' ',
    );
    const normalizedPlace = placeRaw.trim();
    if (normalizedPlace) {
      return normalizedPlace;
    }
  }

  return null;
};

const resolveGoogleMapsUrl = async (value: string): Promise<string | null> => {
  const parsed = parseUrlSafe(value);
  if (!parsed) {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  const isGoogleHost =
    hostname.includes('google') || hostname.includes('goo.gl');
  if (!isGoogleHost) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MAPS_RESOLVE_TIMEOUT_MS);

  try {
    const response = await fetch(parsed, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });
    return response.url;
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError';
    const level = isAbort ? 'debug' : 'warn';
    logger[level](
      {
        address: value,
        error,
      },
      'Не удалось разрешить ссылку Google Maps',
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
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

  const directCoordinates = extractCoordinatesFromText(normalized);
  if (directCoordinates) {
    return directCoordinates;
  }

  let searchQuery =
    extractPlaceNameFromGoogleUrl(normalized) || normalizeAddress(address);

  const resolvedUrl = await resolveGoogleMapsUrl(normalized);
  if (resolvedUrl) {
    const resolvedCoordinates = extractCoordinatesFromText(resolvedUrl);
    if (resolvedCoordinates) {
      return resolvedCoordinates;
    }

    const resolvedPlace = extractPlaceNameFromGoogleUrl(resolvedUrl);
    if (resolvedPlace) {
      searchQuery = resolvedPlace;
    }
  }

  const fallbackQuery = searchQuery || normalized;
  const { url, headers } = prepareRequest(fallbackQuery, config);

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
        address: fallbackQuery,
        error,
      },
      'Геокодер не вернул координаты',
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
};
