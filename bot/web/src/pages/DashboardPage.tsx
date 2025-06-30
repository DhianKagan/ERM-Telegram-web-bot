// Страница Dashboard с KPI и графиком
import React, { useEffect, useState } from 'react'
import { ClipboardDocumentListIcon, ArrowPathIcon, ExclamationTriangleIcon, CalendarDaysIcon } from '@heroicons/react/24/outline'
import authFetch from '../utils/authFetch'
import KpiCard from '../components/KpiCard'
import TasksChart from '../components/TasksChart'
import RecentTasks from '../components/RecentTasks'
import SkeletonCard from '../components/SkeletonCard'
import TableSkeleton from '../components/TableSkeleton'
import Breadcrumbs from '../components/Breadcrumbs'

interface Summary {
  total: number
  inWork: number
  overdue: number
  today: number
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary>({ total: 0, inWork: 0, overdue: 0, today: 0 })
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    authFetch('/api/tasks/report/summary')
      .then(r => (r.ok ? r.json() : { total: 0, inWork: 0, overdue: 0, today: 0 }))
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
      <div className="space-y-4 rounded-lg bg-white p-4 shadow-sm">
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
