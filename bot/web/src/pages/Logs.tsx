// Страница просмотра логов
import React from 'react'
import Breadcrumbs from '../components/Breadcrumbs'
import LogsPanel from '../components/LogsPanel'

export default function Logs() {
  return (
    <div className="space-y-6 p-4">
      <Breadcrumbs items={[{ label: 'Задачи', href: '/tasks' }, { label: 'Логи' }]} />
      <LogsPanel />
    </div>
  )
}
