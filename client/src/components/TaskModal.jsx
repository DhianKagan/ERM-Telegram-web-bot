// Модальное окно создания или редактирования задачи
import { useState, useEffect } from 'react'

export default function TaskModal({ task, onSave, onClose }) {
  const [description, setDescription] = useState('')
  const [due, setDue] = useState('')
  const [priority, setPriority] = useState('low')
  const [status, setStatus] = useState('pending')

  useEffect(() => {
    if (task) {
      setDescription(task.task_description || '')
      setDue(task.due_date ? task.due_date.slice(0, 10) : '')
      setPriority(task.priority || 'low')
      setStatus(task.status || 'pending')
    }
  }, [task])

  const submit = e => {
    e.preventDefault()
    onSave({ description, dueDate: due, priority, status })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <form onSubmit={submit} className="bg-white p-4 rounded flex flex-col gap-2 w-72">
        <input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Описание" className="border p-1" />
        <input type="date" value={due} onChange={e=>setDue(e.target.value)} className="border p-1" />
        <select value={priority} onChange={e=>setPriority(e.target.value)} className="border p-1">
          <option value="low">Низкий</option>
          <option value="medium">Средний</option>
          <option value="high">Высокий</option>
        </select>
        <select value={status} onChange={e=>setStatus(e.target.value)} className="border p-1">
          <option value="pending">Ожидает</option>
          <option value="in-progress">В работе</option>
          <option value="completed">Выполнено</option>
        </select>
        <div className="flex justify-end gap-2 mt-2">
          <button type="button" onClick={onClose}>Отмена</button>
          <button className="bg-blue-500 text-white px-2 rounded" type="submit">Сохранить</button>
        </div>
      </form>
    </div>
  )
}
