// Страница управления задачами
import React from 'react'
import TaskForm from '../components/TaskForm'
import KPIOverview from '../components/KPIOverview'

export default function TasksPage() {
  const [tasks, setTasks] = React.useState([])
  const [selected, setSelected] = React.useState([])
  const [kpi, setKpi] = React.useState({ count: 0, time: 0 })

  const load = () => {
    fetch('/api/tasks', { headers: { Authorization: localStorage.token ? `Bearer ${localStorage.token}` : '' } })
      .then(r => r.ok ? r.json() : [])
      .then(data => setTasks(data))
    fetch('/api/tasks/report/summary', { headers: { Authorization: localStorage.token ? `Bearer ${localStorage.token}` : '' } })
      .then(r => r.ok ? r.json() : { count:0, time:0 })
      .then(setKpi)
  }

  React.useEffect(load, [])

  const add30 = async id => {
    await fetch(`/api/tasks/${id}/time`, { method:'PATCH', headers:{'Content-Type':'application/json', Authorization: localStorage.token ? `Bearer ${localStorage.token}` : ''}, body: JSON.stringify({ minutes: 30 }) })
    load()
  }

  const changeStatus = async () => {
    await fetch('/api/tasks/bulk', { method:'POST', headers:{'Content-Type':'application/json', Authorization: localStorage.token ? `Bearer ${localStorage.token}` : ''}, body: JSON.stringify({ ids:selected, status:'done' }) })
    setSelected([]); load()
  }

  return (
    <div className="space-y-4">
      <KPIOverview count={kpi.count} time={kpi.time} />
      <TaskForm onCreate={task=>{ setTasks([...tasks, task]); load() }} />
      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <tr>
            <th></th>
            <th className="px-4 py-2 text-left">Название</th>
            <th className="px-4 py-2">Статус</th>
            <th className="px-4 py-2">Время</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(t => (
            <tr key={t._id} className="border-b">
              <td><input type="checkbox" checked={selected.includes(t._id)} onChange={e=>setSelected(e.target.checked? [...selected,t._id] : selected.filter(id=>id!==t._id))} /></td>
              <td className="px-4 py-2">{t.title}</td>
              <td className="px-4 py-2">{t.status}</td>
              <td className="px-4 py-2">{t.time_spent}</td>
              <td><button onClick={()=>add30(t._id)} className="text-sm text-blue-500">+30 мин</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {selected.length > 0 && (
        <button onClick={changeStatus} className="rounded bg-green-500 px-3 py-1 text-white">Сменить статус</button>
      )}
    </div>
  )
}
