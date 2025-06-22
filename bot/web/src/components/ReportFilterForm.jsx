// Форма фильтрации отчётов по диапазону дат
import React from 'react'

export default function ReportFilterForm({ onChange }) {
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')
  const submit = e => {
    e.preventDefault()
    onChange && onChange({ from, to })
  }
  return (
    <form onSubmit={submit} className="space-x-2">
      <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="rounded border px-2 py-1" />
      <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="rounded border px-2 py-1" />
      <button type="submit" className="rounded bg-blue-500 px-3 py-1 text-white">Применить</button>
    </form>
  )
}
