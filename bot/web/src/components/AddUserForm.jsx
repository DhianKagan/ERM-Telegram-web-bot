// Форма добавления пользователя в систему
import React from 'react'

export default function AddUserForm({ onCreate }) {
  const [id, setId] = React.useState('')
  const [username, setUsername] = React.useState('')
  const submit = async e => {
    e.preventDefault()
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: localStorage.token ? `Bearer ${localStorage.token}` : '' },
      body: JSON.stringify({ id: Number(id), username })
    })
    if (res.ok) {
      onCreate && onCreate(await res.json())
      setId(''); setUsername('')
    }
  }
  return (
    <form onSubmit={submit} className="space-x-2">
      <input value={id} onChange={e=>setId(e.target.value)} placeholder="Telegram ID" className="rounded border px-2 py-1" required />
      <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Username" className="rounded border px-2 py-1" required />
      <button type="submit" className="rounded bg-blue-500 px-3 py-1 text-white">Добавить</button>
    </form>
  )
}
