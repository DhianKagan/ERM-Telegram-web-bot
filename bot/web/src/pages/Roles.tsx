// Страница управления ролями
import React from 'react'
import Breadcrumbs from '../components/Breadcrumbs'
import RolesPanel from '../components/RolesPanel'

export default function Roles() {
  return (
    <div className="space-y-6 p-4">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Роли' }]} />
      <RolesPanel />
    </div>
  )
}
