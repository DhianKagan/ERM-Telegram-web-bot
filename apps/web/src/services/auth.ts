/* eslint-env browser */
// Назначение: API запросы для профиля пользователя
// Основные модули: authFetch
import authFetch from '../utils/authFetch';
import type { User } from '../types/user';
import { normalizeUser } from './normalizeUser';

type FetchOptions = Parameters<typeof authFetch>[1];

export const getProfile = async (options?: FetchOptions): Promise<User> => {
  const res = await authFetch('/api/v1/auth/profile', options);
  if (!res.ok) throw new Error('unauthorized');
  const data = await res.json();
  const normalized = normalizeUser(data);
  return { ...normalized, id: String(normalized.telegram_id ?? '') } as User;
};

interface ProfileData {
  name?: string;
  phone?: string;
  mobNumber?: string;
  email?: string;
}

export const updateProfile = async (data: ProfileData): Promise<User> => {
  const res = await authFetch('/api/v1/auth/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (text) {
      try {
        const data = JSON.parse(text) as Record<string, unknown>;
        const detail =
          (typeof data.detail === 'string' && data.detail) ||
          (typeof data.error === 'string' && data.error) ||
          (typeof data.message === 'string' && data.message) ||
          '';
        if (detail) throw new Error(detail);
      } catch {
        /* игнорируем ошибку парсинга */
      }
    }
    throw new Error(text || 'Не удалось обновить профиль');
  }
  const updated = await res.json();
  const normalized = normalizeUser(updated);
  return { ...normalized, id: String(normalized.telegram_id ?? '') } as User;
};

export const logout = () =>
  authFetch('/api/v1/auth/logout', { method: 'POST' }).then(() => undefined);

export const refresh = () =>
  authFetch('/api/v1/auth/refresh', {
    method: 'POST',
    noRedirect: true,
  }).then(() => undefined);
