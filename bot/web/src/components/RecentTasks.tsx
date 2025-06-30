// Таблица последних задач
import React, { useEffect, useState } from 'react'
import authFetch from '../utils/authFetch'

interface Task {
  _id: string
  title: string
  status: string
}

export default function RecentTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    authFetch('/api/tasks?limit=5')
      .then(r => (r.ok ? r.json() : []))
      .then(data => {
        setTasks(data)
        setLoading(false)
      })
      .catch(() => {
        setTasks([])
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-4 w-full animate-pulse rounded bg-gray-200" />
        ))}
      </div>
    )
  }

  return (
    <table className="min-w-full divide-y divide-gray-200 text-sm">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-2 text-left">Название</th>
          <th className="px-4 py-2">Статус</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map(t => (
          <tr key={t._id} className="border-b">
            <td className="px-4 py-2">{t.title}</td>
            <td className="px-4 py-2 text-center">{t.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
