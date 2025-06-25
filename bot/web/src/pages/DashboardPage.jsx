// Страница Dashboard с KPI и графиком
import React, { useEffect, useState } from 'react'
import { ClipboardDocumentListIcon, ArrowPathIcon, ExclamationTriangleIcon, CalendarDaysIcon } from '@heroicons/react/24/outline'
import KpiCard from '../components/KpiCard'
import TasksChart from '../components/TasksChart'
import RecentTasks from '../components/RecentTasks'
import SkeletonCard from '../components/SkeletonCard'
import TableSkeleton from '../components/TableSkeleton'
import Breadcrumbs from '../components/Breadcrumbs'

export default function DashboardPage() {
  const [summary, setSummary] = useState({ total: 0, inWork: 0, overdue: 0, today: 0 })
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/api/tasks/report/summary', {
      headers: { Authorization: localStorage.token ? `Bearer ${localStorage.token}` : '' }
    })
      .then(r => (r.ok ? r.json() : summary))
      .then(data => {
        setSummary(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const cards = [
    { title: 'Всего задач', value: summary.total, icon: ClipboardDocumentListIcon },
    { title: 'В работе', value: summary.inWork, icon: ArrowPathIcon },
    { title: 'Просрочено', value: summary.overdue, icon: ExclamationTriangleIcon },
    { title: 'Сегодня', value: summary.today, icon: CalendarDaysIcon }
  ]

  return (
    <div className="space-y-6 p-4">
      <Breadcrumbs items={[{ label: 'Dashboard' }]} />
      <div className="space-y-4 rounded-lg bg-white p-4 shadow-sm dark:bg-boxdark">
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : cards.map(c => (
                <KpiCard key={c.title} title={c.title} value={c.value} icon={c.icon} />
              ))}
        </div>
        {loading ? (
          <TableSkeleton rows={5} />
        ) : (
          <>
            <TasksChart />
            <h3 className="text-xl font-semibold">Последние задачи</h3>
            <RecentTasks />
          </>
        )}
      </div>
    </div>
  )
}
