// Назначение: прямое геокодирование адресов в координаты для логистики
// Основные модули: config, fetch
import { geocoderConfig } from '../config';
import type { Coordinates } from '../db/model';

const REQUEST_TIMEOUT_MS = 8000;

const normalizeAddress = (value: string): string => {
  const trimmed = value.trim();
  return trimmed.replace(/\s+/g, ' ');
};

const parseCoordinate = (value: unknown): number | null => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export const geocodeAddress = async (
  address: string,
): Promise<Coordinates | null> => {
  if (!geocoderConfig.enabled || !geocoderConfig.baseUrl) {
    return null;
  }

  const normalized = normalizeAddress(address);
  if (!normalized) {
    return null;
  }

  const url = new URL(geocoderConfig.baseUrl);
  if (!url.searchParams.has('format')) {
    url.searchParams.set('format', 'json');
  }
  if (!url.searchParams.has('limit')) {
    url.searchParams.set('limit', '1');
  }
  url.searchParams.set('q', normalized);
  if (geocoderConfig.email) {
    url.searchParams.set('email', geocoderConfig.email);
  }

  const headers: Record<string, string> = {
    'User-Agent': geocoderConfig.userAgent,
  };
  if (geocoderConfig.email) {
    headers['X-Nominatim-Email'] = geocoderConfig.email;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) {
      return null;
    }
    const payload = await response.json();
    const firstItem = Array.isArray(payload) ? payload[0] : payload;
    if (!firstItem) {
      return null;
    }
    const lat = parseCoordinate(firstItem.lat ?? firstItem.latitude);
    const lng = parseCoordinate(
      firstItem.lon ?? firstItem.lng ?? firstItem.longitude,
    );
    if (lat === null || lng === null) {
      return null;
    }
    return { lat, lng } satisfies Coordinates;
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError';
    const level = isAbort ? 'warn' : 'error';
    console[level](
      'Геокодер не вернул координаты',
      error instanceof Error ? error.message : error,
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

export const geocodeAddresses = async (
  addresses: string[],
): Promise<Coordinates[]> => {
  const results: Coordinates[] = [];
  for (const item of addresses) {
    const coords = await geocodeAddress(item);
    if (coords) {
      results.push(coords);
    }
  }
  return results;
};
