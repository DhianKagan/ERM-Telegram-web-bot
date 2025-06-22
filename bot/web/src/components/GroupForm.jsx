// Форма создания проекта (группы задач)
import React from 'react'

export default function GroupForm({ onCreate }) {
  const [name, setName] = React.useState('')
  const submit = async e => {
    e.preventDefault()
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: localStorage.token ? `Bearer ${localStorage.token}` : '' },
      body: JSON.stringify({ name })
    })
    if (res.ok) {
      onCreate && onCreate(await res.json())
      setName('')
    }
  }
  return (
    <form onSubmit={submit} className="space-x-2">
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Название" className="rounded border px-2 py-1" required />
      <button type="submit" className="rounded bg-blue-500 px-3 py-1 text-white">Создать</button>
    </form>
  )
}
