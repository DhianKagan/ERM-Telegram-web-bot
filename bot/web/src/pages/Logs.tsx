// Страница просмотра логов
import React from 'react'

interface Log { _id: string; message: string; level: string; createdAt: string }

export default function Logs() {
  const [logs, setLogs] = React.useState<Log[]>([])
  React.useEffect(() => {
    fetch('/api/logs', { headers:{ Authorization: localStorage.token ? `Bearer ${localStorage.token}` : '' } })
      .then(r=>r.ok?r.json():[]).then(setLogs)
  }, [])
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Логи</h2>
      <ul className="space-y-1">
        {logs.map(l=> (
          <li key={l._id} className="rounded border p-2">[{new Date(l.createdAt).toLocaleString()}] {l.level}: {l.message}</li>
        ))}
      </ul>
    </div>
  )
}
