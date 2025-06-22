// Админ-панель: просмотр пользователей и логов.
import { useEffect, useState } from 'react'

export default function Admin() {
  const [users, setUsers] = useState([])
  const [logs, setLogs] = useState([])

  useEffect(() => {
    fetch('/users').then(r => r.json()).then(setUsers)
    fetch('/logs').then(r => r.json()).then(setLogs)
  }, [])

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Пользователи</h2>
      <ul className="space-y-1">
        {users.map(u => (
          <li key={u._id}>{u.username}</li>
        ))}
      </ul>
      <h2 className="text-xl font-bold">Логи</h2>
      <ul className="space-y-1">
        {logs.map(l => (
          <li key={l._id}>{l.message}</li>
        ))}
      </ul>
    </div>
  )
}
