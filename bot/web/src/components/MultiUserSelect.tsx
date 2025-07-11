// Компонент выбора нескольких пользователей с кнопкой добавления
import React from 'react'

interface Props {
  label: string
  users: { telegram_id: number; name?: string; username?: string }[]
  value: string[]
  onChange: (v: string[]) => void
  disabled?: boolean
}

export default function MultiUserSelect({ label, users, value, onChange, disabled }: Props) {
  const [addId, setAddId] = React.useState('')
  const add = () => {
    if (!disabled && addId && !value.includes(addId)) onChange([...value, addId])
    setAddId('')
  }
  const remove = (id: string) => {
    if (!disabled) onChange(value.filter(v => v !== id))
  }
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <div className="mt-1 flex items-center space-x-2">
        <select value={addId} onChange={e => setAddId(e.target.value)} className="rounded border px-2 py-1" disabled={disabled}>
          <option value="">выбрать</option>
          {users.map(u => (
            <option key={u.telegram_id} value={String(u.telegram_id)}>
              {u.name || u.username}
            </option>
          ))}
        </select>
        <button type="button" onClick={add} className="btn-blue rounded-2xl px-2" disabled={disabled}>
          +
        </button>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {value.map(id => {
          const u = users.find(user => String(user.telegram_id) === id)
          const name = u?.name || u?.username || id
          return (
            <span key={id} className="flex items-center rounded bg-gray-200 px-2 py-0.5 text-sm">
              {name}
              <button type="button" className="ml-1 text-red-600" onClick={() => remove(id)} disabled={disabled}>
                ×
              </button>
            </span>
          )
        })}
      </div>
    </div>
  )
}
