// Форма создания задачи
import React from 'react'

export default function TaskForm({ onCreate }) {
  const [title, setTitle] = React.useState('')
  async function submit(e) {
    e.preventDefault()
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: localStorage.token ? `Bearer ${localStorage.token}` : '' },
      body: JSON.stringify({ title })
    })
    if (res.ok) {
      onCreate(await res.json())
      setTitle('')
    }
  }
  return (
    <form onSubmit={submit} className="space-x-2">
      <input value={title} onChange={e=>setTitle(e.target.value)} className="rounded border px-2 py-1" placeholder="Название" required />
      <button className="rounded bg-blue-500 px-3 py-1 text-white">Создать</button>
    </form>
  )
}
