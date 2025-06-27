// Форма фильтрации отчётов по диапазону дат
import React from 'react'

interface ReportFilterFormProps {
  onChange?: (period: { from: string; to: string }) => void
}

export default function ReportFilterForm({ onChange }: ReportFilterFormProps) {
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')
  const submit = e => {
    e.preventDefault()
    onChange && onChange({ from, to })
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <input
        type="date"
        value={from}
        onChange={e => setFrom(e.target.value)}
        className="rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-800 focus:border-accentPrimary focus:outline-none focus:ring focus:ring-brand-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      />
      <input
        type="date"
        value={to}
        onChange={e => setTo(e.target.value)}
        className="rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-800 focus:border-accentPrimary focus:outline-none focus:ring focus:ring-brand-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      />
      <button type="submit" className="btn btn-blue">Применить</button>
    </form>
  )
}
