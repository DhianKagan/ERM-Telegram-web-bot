// Главная страница администрирования
import React from 'react'
import Breadcrumbs from '../components/Breadcrumbs'
import LogsPanel from '../components/LogsPanel'

export default function Admin() {
  return (
    <div className="space-y-6 p-4">
      <Breadcrumbs items={[{ label: 'Задачи', href: '/tasks' }, { label: 'Админ' }]} />
      <LogsPanel />
    </div>
  )
}
