// Главная страница администрирования
import React from 'react'
import Breadcrumbs from '../components/Breadcrumbs'
import Tabs from '../components/Tabs'
import RolesPanel from '../components/RolesPanel'
import LogsPanel from '../components/LogsPanel'

export default function Admin() {
  const [tab, setTab] = React.useState('roles')
  const options = [
    { key: 'roles', label: 'Роли' },
    { key: 'logs', label: 'Логи' },
  ]
  return (
    <div className="space-y-6 p-4">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Админ' }]} />
      <Tabs options={options} active={tab} onChange={setTab} />
      {tab === 'roles' ? <RolesPanel /> : <LogsPanel />}
    </div>
  )
}
