// Назначение: запросы к API карт
// Основные модули: authFetch
import authFetch from '../utils/authFetch';

export const expandLink = (url: string) =>
  authFetch('/api/v1/maps/expand', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  }).then((r) => (r.ok ? r.json() : null));

export type AddressSuggestion = {
  id: string;
  label: string;
  description?: string;
  lat: number;
  lng: number;
  source: string;
};

const buildQuery = (params: Record<string, string | number>): string => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

export const searchAddress = async (
  query: string,
  options: { signal?: AbortSignal; limit?: number; language?: string } = {},
): Promise<AddressSuggestion[]> => {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }
  const limit = Math.min(Math.max(options.limit ?? 5, 1), 10);
  const headers: Record<string, string> = {};
  if (options.language && options.language.trim()) {
    headers['Accept-Language'] = options.language;
  }
  const res = await authFetch(
    `/api/v1/maps/search${buildQuery({ q: trimmed, limit })}`,
    {
      signal: options.signal,
      ...(Object.keys(headers).length ? { headers } : {}),
    },
  );
  if (!res.ok) {
    throw new Error('MAPS_SEARCH_FAILED');
  }
  const data = (await res.json().catch(() => null)) as {
    items?: AddressSuggestion[];
  } | null;
  if (!data || !Array.isArray(data.items)) {
    return [];
  }
  return data.items;
};

export const reverseGeocode = async (
  coords: { lat: number; lng: number },
  options: { signal?: AbortSignal; language?: string } = {},
): Promise<AddressSuggestion | null> => {
  if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
    return null;
  }
  const headers: Record<string, string> = {};
  if (options.language && options.language.trim()) {
    headers['Accept-Language'] = options.language;
  }
  const res = await authFetch(
    `/api/v1/maps/reverse${buildQuery({ lat: coords.lat, lng: coords.lng })}`,
    {
      signal: options.signal,
      ...(Object.keys(headers).length ? { headers } : {}),
    },
  );
  if (!res.ok) {
    throw new Error('MAPS_REVERSE_FAILED');
  }
  const data = (await res.json().catch(() => null)) as {
    place?: AddressSuggestion | null;
  } | null;
  if (!data) {
    return null;
  }
  return data.place ?? null;
};
