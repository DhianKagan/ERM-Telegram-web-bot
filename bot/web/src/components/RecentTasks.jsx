// Таблица последних задач
import React, { useEffect, useState } from 'react'

export default function RecentTasks() {
  const [tasks, setTasks] = useState([])
  useEffect(() => {
    fetch('/api/tasks?limit=5', {
      headers: { Authorization: localStorage.token ? `Bearer ${localStorage.token}` : '' }
    })
      .then(r => (r.ok ? r.json() : []))
      .then(setTasks)
      .catch(() => setTasks([]))
  }, [])

  return (
    <table className="min-w-full divide-y divide-gray-200 text-sm">
      <thead>
        <tr>
          <th className="px-4 py-2 text-left">Название</th>
          <th className="px-4 py-2">Статус</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map(t => (
          <tr key={t._id} className="border-b">
            <td className="px-4 py-2">{t.title}</td>
            <td className="px-4 py-2">{t.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
