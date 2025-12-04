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

  const url = new URL(config.baseUrl);
  if (!url.searchParams.has('format')) {
    url.searchParams.set('format', 'json');
  }
  if (!url.searchParams.has('limit')) {
    url.searchParams.set('limit', '1');
  }
  url.searchParams.set('q', normalized);
  if (config.email) {
    url.searchParams.set('email', config.email);
  }

  const headers: Record<string, string> = {
    'User-Agent': config.userAgent,
  };
  if (config.email) {
    headers['X-Nominatim-Email'] = config.email;
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
