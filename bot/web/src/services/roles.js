// Запросы к API ролей
import authFetch from '../utils/authFetch'

export const fetchRoles = () =>
  authFetch('/api/v1/roles').then(r => (r.ok ? r.json() : []))

export const updateRole = (id, permissions) =>
  authFetch(`/api/v1/roles/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissions })
  }).then(r => r.json())
