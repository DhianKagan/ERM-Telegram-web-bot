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
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Название"
        className="w-60 rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-800 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring focus:ring-brand-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        required
      />
      <button
        type="submit"
        className="btn btn-blue"
      >
        Создать
      </button>
    </form>
  )
}
