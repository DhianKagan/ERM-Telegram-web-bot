// Страница задач: загрузка и добавление через API.
import { useEffect, useState } from 'react'

export default function Tasks() {
  const [list, setList] = useState([])
  const [desc, setDesc] = useState('')

  useEffect(() => {
    fetch('/tasks').then(r => r.json()).then(setList)
  }, [])

  const add = async () => {
    if (!desc) return
    const res = await fetch('/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: desc })
    })
    const t = await res.json()
    setList([...list, t])
    setDesc('')
  }

  return (
    <div>
      <div className="flex space-x-2 mb-4">
        <input value={desc} onChange={e => setDesc(e.target.value)} className="border p-2 flex-1" />
        <button onClick={add} className="px-4 py-2 bg-blue-500 text-white">Добавить</button>
      </div>
      <ul className="space-y-2">
        {list.map(t => (
          <li key={t._id} className="p-2 border rounded">{t.task_description}</li>
        ))}
      </ul>
    </div>
  )
}
