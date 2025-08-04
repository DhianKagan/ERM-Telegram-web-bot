/* eslint-env browser */
// Назначение: API запросы для профиля пользователя
// Основные модули: authFetch
import authFetch from '../utils/authFetch'

export const getProfile = (options?: RequestInit) =>
  authFetch('/api/v1/auth/profile', options).then((r) => r.json())

interface ProfileData {
  name?: string
  mobNumber?: string
}

export const updateProfile = (data: ProfileData) =>
  authFetch('/api/v1/auth/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  }).then((r) => r.json())
