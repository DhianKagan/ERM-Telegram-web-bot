// Панель логов админки
import React from 'react'
import authFetch from '../utils/authFetch'

interface Log { _id: string; message: string; level: string; createdAt: string }

export default function LogsPanel() {
  const [logs, setLogs] = React.useState<Log[]>([])

  const loadLogs = React.useCallback(() => {
    authFetch('/api/v1/logs')
      .then(r => (r.ok ? r.json() : []))
      .then(setLogs)
  }, [])

  React.useEffect(() => {
    loadLogs()
    const id = setInterval(loadLogs, 5000)
    return () => clearInterval(id)
  }, [loadLogs])

  const colors: Record<string, string> = {
    info: 'bg-success-100 text-success-700',
    warn: 'bg-warning-100 text-warning-700',
    error: 'bg-error-100 text-error-700'
  }

  return (
    <div className="space-y-4 rounded-lg bg-white p-4 shadow-sm">
      <h2 className="text-xl font-semibold">Логи</h2>
      <ul className="space-y-2">
        {logs.map(l => (
          <li key={l._id} className="flex gap-2 border-b pb-2 last:border-b-0">
            <span
              className={`rounded px-2 py-0.5 text-sm ${colors[l.level] ||
                'bg-gray-100 text-gray-700'}`}
            >
              {l.level.toUpperCase()}
            </span>
            <span>{new Date(l.createdAt).toLocaleString()}</span>
            <span className="flex-1">{l.message}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
