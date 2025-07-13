// Запрос оптимизации маршрута
import authFetch from '../utils/authFetch'

export const optimizeRoute = (taskIds, count, method) =>
  authFetch('/api/v1/optimizer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasks: taskIds, count, method })
  }).then(r => (r.ok ? r.json() : null))

export default optimizeRoute
