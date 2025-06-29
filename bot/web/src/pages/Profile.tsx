import { useContext, useEffect, useState } from 'react'
import { AuthContext } from '../context/AuthContext'
import Tabs from '../components/Tabs'
import Breadcrumbs from '../components/Breadcrumbs'
import { fetchMentioned } from '../services/tasks'

interface MentionedTask {
  _id: string
  title: string
}

export default function Profile() {
  const { user } = useContext(AuthContext)
  const [tab, setTab] = useState('details')
  const [tasks, setTasks] = useState<MentionedTask[]>([])
  useEffect(() => {
    fetchMentioned().then(setTasks)
  }, [])
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
            <p><b>ФИО:</b> {user.username || user.name}</p>
            <p><b>Телефон:</b> {user.phone || 'не указан'}</p>
            <p><b>Telegram ID:</b> {user.telegram_id}</p>
            <p><b>Отдел:</b> {user.departmentId ? user.departmentId.name : 'не задан'}</p>
            <div>
              <b>Упоминания:</b>
              <ul className="list-disc pl-5">
                {tasks.map(t => (
                  <li key={t._id}>{t.title}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="text-sm text-body">История действий пока пуста.</div>
        )}
      </div>
    </div>
  )
}
