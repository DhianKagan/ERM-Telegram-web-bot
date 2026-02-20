// Назначение: запросы к API логов
// Основные модули: authFetch
import authFetch from '../utils/authFetch';

export const createLog = (message: string) =>
  authFetch('/api/v1/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });

export const clearLogs = (target: 'runtime' | 'db' = 'runtime') =>
  authFetch('/api/v1/logs', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target }),
  });
