// Страница Dashboard с KPI и графиком
import React, { useEffect, useState } from 'react'
import { ClipboardDocumentListIcon, ArrowPathIcon, ExclamationTriangleIcon, CalendarDaysIcon } from '@heroicons/react/24/outline'
import KpiCard from '../components/KpiCard'
import TasksChart from '../components/TasksChart'
import RecentTasks from '../components/RecentTasks'

export default function DashboardPage() {
  const [summary, setSummary] = useState({ total: 0, inWork: 0, overdue: 0, today: 0 })
  useEffect(() => {
    fetch('/api/tasks/report/summary', {
      headers: { Authorization: localStorage.token ? `Bearer ${localStorage.token}` : '' }
    })
      .then(r => (r.ok ? r.json() : summary))
      .then(setSummary)
      .catch(() => {})
  }, [])

  const cards = [
    { title: 'Всего задач', value: summary.total, icon: ClipboardDocumentListIcon },
    { title: 'В работе', value: summary.inWork, icon: ArrowPathIcon },
    { title: 'Просрочено', value: summary.overdue, icon: ExclamationTriangleIcon },
    { title: 'Сегодня', value: summary.today, icon: CalendarDaysIcon }
  ]

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-2xl font-semibold">Dashboard</h2>
      <div className="grid gap-4 sm:grid-cols-4">
        {cards.map(c => (
          <KpiCard key={c.title} title={c.title} value={c.value} icon={c.icon} />
        ))}
      </div>
      <TasksChart />
      <h3 className="text-xl font-semibold">Последние задачи</h3>
      <RecentTasks />
    </div>
  )
}
