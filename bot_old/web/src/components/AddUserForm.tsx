// Форма добавления пользователя в систему
import React from 'react'
import authFetch from '../utils/authFetch'

interface AddUserFormProps {
  onCreate?: (data: unknown) => void
}

export default function AddUserForm({ onCreate }: AddUserFormProps) {
  const [id, setId] = React.useState('')
  const [username, setUsername] = React.useState('')
  const [roleId, setRoleId] = React.useState('')
  const [roles, setRoles] = React.useState([])

  React.useEffect(() => {
    authFetch('/api/roles')
      .then(r => (r.ok ? r.json() : []))
      .then(setRoles)
  }, [])
  const submit = async e => {
    e.preventDefault()
    const res = await authFetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: Number(id), username, roleId })
    })
    if (res.ok) {
      onCreate && onCreate(await res.json())
      setId(''); setUsername(''); setRoleId('')
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <input
        value={id}
        onChange={e => setId(e.target.value)}
        placeholder="Telegram ID"
        className="w-40 rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-800 placeholder-gray-500 focus:border-accentPrimary focus:outline-none focus:ring focus:ring-brand-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        required
      />
      <input
        value={username}
        onChange={e => setUsername(e.target.value)}
        placeholder="Username"
        className="w-40 rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-800 placeholder-gray-500 focus:border-accentPrimary focus:outline-none focus:ring focus:ring-brand-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        required
      />
      <select
        value={roleId}
        onChange={e => setRoleId(e.target.value)}
        className="w-44 rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-800 focus:border-accentPrimary focus:outline-none focus:ring focus:ring-brand-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      >
        <option value="">Роль не выбрана</option>
        {roles.map(r => (
          <option key={r._id} value={r._id}>{r.name}</option>
        ))}
      </select>
      <button type="submit" className="btn btn-blue">Добавить</button>
    </form>
  )
}
