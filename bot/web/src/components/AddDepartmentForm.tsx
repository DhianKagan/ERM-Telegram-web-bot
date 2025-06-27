// Форма добавления отдела
import React from 'react'
import authFetch from '../utils/authFetch'

interface AddDepartmentFormProps {
  onCreate?: (data: unknown) => void
}

export default function AddDepartmentForm({ onCreate }: AddDepartmentFormProps) {
  const [name, setName] = React.useState('')
  const submit = async e => {
    e.preventDefault()
    const res = await authFetch('/api/departments', {
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
    <form onSubmit={submit} className="flex items-end gap-2">
      <input value={name} onChange={e=>setName(e.target.value)} required placeholder="Название" className="rounded border px-2 py-1" />
      <button type="submit" className="btn btn-blue">Создать</button>
    </form>
  )
}
