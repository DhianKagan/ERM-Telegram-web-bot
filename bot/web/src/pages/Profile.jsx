import { useContext, useState } from 'react'
import { AuthContext } from '../context/AuthContext'
import Tabs from '../components/Tabs'
import Breadcrumbs from '../components/Breadcrumbs'

export default function Profile() {
  const { user } = useContext(AuthContext)
  const [tab, setTab] = useState('details')
  if (!user) return <div>Загрузка...</div>
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Профиль' }]} />
      <div className="mx-auto max-w-xl rounded bg-white p-8 shadow dark:bg-boxdark">
        <h2 className="mb-4 text-2xl">Личный кабинет</h2>
        <Tabs
          options={[
            { key: 'details', label: 'Детали' },
            { key: 'history', label: 'История' },
          ]}
          active={tab}
          onChange={setTab}
        />
      {tab === 'details' ? (
        <div className="space-y-2">
          <p>
            <b>Имя:</b> {user.name}
          </p>
          <p>
            <b>Email:</b> {user.email}
          </p>
          <p>
            <b>Роль:</b> {user.role}
          </p>
        </div>
      ) : (
        <div className="text-sm text-body">История действий пока пуста.</div>
      )}
      </div>
    </div>
  )
}
