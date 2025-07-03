// Форма создания задачи
import React from 'react'
import authFetch from '../utils/authFetch'
import fields from '../../shared/taskFields.cjs'

interface TaskFormProps {
  onCreate: (data: unknown) => void
}

export default function TaskForm({ onCreate }: TaskFormProps) {
  const [form, setForm] = React.useState<Record<string, any>>({})

  const handleChange = (name: string, value: any) =>
    setForm(f => ({ ...f, [name]: value }))

  async function submit(e) {
    e.preventDefault()
    const res = await authFetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    if (res.ok) {
      onCreate(await res.json())
      setForm({})
    }
  }

  const renderField = (f: any) => {
    switch (f.type) {
      case 'text':
        return (
          <input
            key={f.name}
            value={form[f.name] || ''}
            onChange={e => handleChange(f.name, e.target.value)}
            placeholder={f.label}
            className="rounded border px-2 py-1 w-full"
            required={f.required}
          />
        )
      case 'select':
        return (
          <select
            key={f.name}
            value={form[f.name] || f.default || ''}
            onChange={e => handleChange(f.name, e.target.value)}
            className="rounded border px-2 py-1 w-full"
          >
            {f.options.map((o: string) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        )
      case 'multiselect':
        return (
          <select
            key={f.name}
            multiple
            value={form[f.name] || []}
            onChange={e =>
              handleChange(
                f.name,
                Array.from(e.target.selectedOptions).map(o => o.value)
              )
            }
            className="rounded border px-2 py-1 w-full"
          >
            {(f.options || []).map((o: string) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        )
      case 'richtext':
        return (
          <textarea
            key={f.name}
            value={form[f.name] || ''}
            onChange={e => handleChange(f.name, e.target.value)}
            placeholder={f.label}
            className="rounded border px-2 py-1 w-full"
          />
        )
      default:
        return null
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      {fields.map(f => renderField(f))}
      <button className="rounded bg-blue-500 px-3 py-1 text-white">Создать</button>
    </form>
  )
}
