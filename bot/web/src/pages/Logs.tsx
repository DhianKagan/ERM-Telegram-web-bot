// Страница просмотра логов
import React from 'react'
import Breadcrumbs from '../components/Breadcrumbs'

interface Log { _id: string; message: string; level: string; createdAt: string }

export default function Logs() {
  const [logs, setLogs] = React.useState<Log[]>([])
  React.useEffect(() => {
    fetch('/api/logs', {
      headers: {
        Authorization: localStorage.token ? `Bearer ${localStorage.token}` : '',
      },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then(setLogs)
  }, [])
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Логи' }]} />
      <div className="space-y-4 rounded-lg bg-white p-4 shadow-sm dark:bg-boxdark">
        <h2 className="text-xl font-semibold">Логи</h2>
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {logs.map((l) => (
            <li key={l._id} className="py-2">
              [{new Date(l.createdAt).toLocaleString()}] {l.level}: {l.message}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
