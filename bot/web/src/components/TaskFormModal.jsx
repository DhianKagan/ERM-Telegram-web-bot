// Модальное окно создания задачи
import React from 'react'

export default function TaskFormModal({ onClose, onCreate }) {
  const [title, setTitle] = React.useState('')

  const submit = async () => {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: localStorage.token ? `Bearer ${localStorage.token}` : '' },
      body: JSON.stringify({ title, status: 'todo' })
    })
    if (res.ok && onCreate) onCreate(await res.json())
    onClose()
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30">
      <div className="w-96 rounded-xl bg-white p-6 shadow-lg dark:bg-gray-800">
        <h3 className="mb-4 text-lg font-semibold">Добавить задачу</h3>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Название"
          className="mb-4 w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-800 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring focus:ring-brand-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
        <div className="flex justify-end space-x-2">
          <button className="btn-gray" onClick={onClose}>Отмена</button>
          <button className="btn-blue" onClick={submit}>Создать</button>
        </div>
      </div>
    </div>
  )
}
