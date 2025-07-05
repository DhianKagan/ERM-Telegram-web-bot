// Форма создания проекта (группы задач)
import React from 'react'
import authFetch from '../utils/authFetch'

interface GroupFormProps {
  onCreate?: (data: unknown) => void
}

export default function GroupForm({ onCreate }: GroupFormProps) {
  const [name, setName] = React.useState('')
  const submit = async e => {
    e.preventDefault()
    const res = await authFetch('/api/v1/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
        className="w-60 rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-800 placeholder-gray-500 focus:border-accentPrimary focus:outline-none focus:ring focus:ring-brand-200"
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
