// Модальное окно создания задачи
import React from 'react'

export default function TaskFormModal({ onClose }) {
  const [title, setTitle] = React.useState('')

  const submit = async () => {
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: localStorage.token ? `Bearer ${localStorage.token}` : '' },
      body: JSON.stringify({ title, status: 'todo' })
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30">
      <div className="w-96 rounded bg-white p-6">
        <h3 className="mb-4 text-lg">Добавить задачу</h3>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Название" className="mb-4 w-full border p-2" />
        <div className="flex justify-end space-x-2">
          <button className="btn-gray" onClick={onClose}>Отмена</button>
          <button className="btn-blue" onClick={submit}>Создать</button>
        </div>
      </div>
    </div>
  )
}
