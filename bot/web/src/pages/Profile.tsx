// Назначение: страница профиля пользователя, модули: React, React Router
import { useContext, useEffect, useState } from 'react'
import { AuthContext } from '../context/AuthContext'
import Tabs from '../components/Tabs'
import Breadcrumbs from '../components/Breadcrumbs'
import { fetchMentioned } from '../services/tasks'
import { updateProfile } from '../services/auth'
import userLink from '../utils/userLink'

interface MentionedTask {
  _id: string
  title: string
}

export default function Profile() {
  const { user, token, setUser } = useContext(AuthContext)
  const [tab, setTab] = useState('details')
  const [tasks, setTasks] = useState<MentionedTask[]>([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  useEffect(() => {
    fetchMentioned().then(setTasks)
  }, [])
  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setPhone(user.phone || '')
    }
  }, [user])
  if (!user) return <div>Загрузка...</div>
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Задачи', href: '/tasks' }, { label: 'Профиль' }]} />
      <div className="mx-auto max-w-xl rounded bg-white p-8 shadow">
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
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium">ФИО</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full rounded border px-2 py-1" />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium">Телефон</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full rounded border px-2 py-1" />
            </div>
            <button
              type="button"
              onClick={async () => {
                if (!token) return
                const data = await updateProfile(token, { name, phone })
                setUser(data)
              }}
              className="btn btn-blue"
            >
              Сохранить
            </button>
            <div>
              <b>Telegram ID:</b>{' '}
              <span
                dangerouslySetInnerHTML={{
                  __html: userLink(user.telegram_id, user.name || user.username)
                }}
              />
            </div>
            <div>
              <b>Отдел:</b> {user.departmentId ? user.departmentId.name : 'не задан'}
            </div>
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
