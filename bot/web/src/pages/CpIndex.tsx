// Главная страница панели управления
import React from 'react'
import Breadcrumbs from '../components/Breadcrumbs'

export default function CpIndex() {
  return (
    <div className="space-y-6 p-4">
      <Breadcrumbs items={[{ label: 'Задачи', href: '/tasks' }, { label: 'Админка' }]} />
      <div className="rounded bg-white p-6 shadow">Выберите раздел слева.</div>
    </div>
  )
}
