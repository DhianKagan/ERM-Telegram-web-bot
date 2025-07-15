// Таблица задач со сортировкой и фильтрами для страницы маршрутов
import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import parseJwt from '../utils/parseJwt'

interface Task {
  _id: string
  title: string
  due_date?: string
  priority?: string
  task_type?: string
  status?: string
  startCoordinates?: { lat: number; lng: number }
  finishCoordinates?: { lat: number; lng: number }
  route_distance_km?: number
  request_id?: string
  createdAt?: string
}

interface Filters {
  title: string
  due_date: string
  priority: string
  task_type: string
  status: string
  start: string
  finish: string
  distance: string
}

export default function RoutesTaskTable({ tasks, onChange }: { tasks: Task[]; onChange?: (t: Task[]) => void }) {
  const [sortBy, setSortBy] = React.useState<keyof Task>('due_date')
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc')
  const [filters, setFilters] = React.useState<Filters>({
    title: '',
    due_date: '',
    priority: '',
    task_type: '',
    status: '',
    start: '',
    finish: '',
    distance: ''
  })
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin = React.useMemo(() => {
    const token = localStorage.getItem('token')
    const data = token ? parseJwt(token) : null
    return data?.role === 'admin'
  }, [])
  const openTask = (id: string) => {
    if (!isAdmin) return
    const params = new URLSearchParams(location.search)
    params.set('task', id)
    navigate({ search: params.toString() }, { replace: true })
  }
  const handleSort = (col: keyof Task) => {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(col)
      setSortDir('asc')
    }
  }
  const changeFilter = (field: keyof Filters, value: string) => {
    setFilters({ ...filters, [field]: value })
  }
  const filtered = React.useMemo(() => {
    return tasks.filter(t => {
      const name = t.title?.toLowerCase() || ''
      const due = t.due_date?.slice(0,10) || ''
      const start = t.startCoordinates ? `${t.startCoordinates.lat},${t.startCoordinates.lng}` : ''
      const finish = t.finishCoordinates ? `${t.finishCoordinates.lat},${t.finishCoordinates.lng}` : ''
      const dist = t.route_distance_km?.toString() || ''
      return (
        (!filters.title || name.includes(filters.title.toLowerCase())) &&
        (!filters.due_date || due.includes(filters.due_date)) &&
        (!filters.priority || (t.priority || '').includes(filters.priority)) &&
        (!filters.task_type || (t.task_type || '').includes(filters.task_type)) &&
        (!filters.status || (t.status || '').includes(filters.status)) &&
        (!filters.start || start.includes(filters.start)) &&
        (!filters.finish || finish.includes(filters.finish)) &&
        (!filters.distance || dist.includes(filters.distance))
      )
    })
  }, [tasks, filters])
  const sorted = React.useMemo(() => {
    const list = [...filtered]
    list.sort((a, b) => {
      const v1 = (a[sortBy] as any) || ''
      const v2 = (b[sortBy] as any) || ''
      if (v1 > v2) return sortDir === 'asc' ? 1 : -1
      if (v1 < v2) return sortDir === 'asc' ? -1 : 1
      return 0
    })
    return list
  }, [filtered, sortBy, sortDir])
  React.useEffect(() => { if (onChange) onChange(sorted) }, [sorted, onChange])
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-2 py-1 cursor-pointer" onClick={() => handleSort('title')}>Название {sortBy==='title'?(sortDir==='asc'?'▲':'▼'):''}</th>
            <th className="px-2 py-1 cursor-pointer" onClick={() => handleSort('due_date')}>Срок {sortBy==='due_date'?(sortDir==='asc'?'▲':'▼'):''}</th>
            <th className="px-2 py-1 cursor-pointer" onClick={() => handleSort('priority')}>Приоритет {sortBy==='priority'?(sortDir==='asc'?'▲':'▼'):''}</th>
            <th className="px-2 py-1 cursor-pointer" onClick={() => handleSort('status')}>Статус {sortBy==='status'?(sortDir==='asc'?'▲':'▼'):''}</th>
            <th className="px-2 py-1 cursor-pointer" onClick={() => handleSort('task_type')}>Тип {sortBy==='task_type'?(sortDir==='asc'?'▲':'▼'):''}</th>
            <th className="px-2 py-1 cursor-pointer" onClick={() => handleSort('startCoordinates')}>Старт {sortBy==='startCoordinates'?(sortDir==='asc'?'▲':'▼'):''}</th>
            <th className="px-2 py-1 cursor-pointer" onClick={() => handleSort('finishCoordinates')}>Финиш {sortBy==='finishCoordinates'?(sortDir==='asc'?'▲':'▼'):''}</th>
            <th className="px-2 py-1 cursor-pointer" onClick={() => handleSort('route_distance_km')}>Км {sortBy==='route_distance_km'?(sortDir==='asc'?'▲':'▼'):''}</th>
          </tr>
          <tr>
            <th className="px-2 py-1"><input value={filters.title} onChange={e=>changeFilter('title',e.target.value)} className="w-full rounded border px-1"/></th>
            <th className="px-2 py-1"><input value={filters.due_date} onChange={e=>changeFilter('due_date',e.target.value)} className="w-full rounded border px-1"/></th>
            <th className="px-2 py-1"><input value={filters.priority} onChange={e=>changeFilter('priority',e.target.value)} className="w-full rounded border px-1"/></th>
            <th className="px-2 py-1"><input value={filters.status} onChange={e=>changeFilter('status',e.target.value)} className="w-full rounded border px-1"/></th>
            <th className="px-2 py-1"><input value={filters.task_type} onChange={e=>changeFilter('task_type',e.target.value)} className="w-full rounded border px-1"/></th>
            <th className="px-2 py-1"><input value={filters.start} onChange={e=>changeFilter('start',e.target.value)} className="w-full rounded border px-1"/></th>
            <th className="px-2 py-1"><input value={filters.finish} onChange={e=>changeFilter('finish',e.target.value)} className="w-full rounded border px-1"/></th>
            <th className="px-2 py-1"><input value={filters.distance} onChange={e=>changeFilter('distance',e.target.value)} className="w-full rounded border px-1"/></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {sorted.map(t => {
            const name = t.title.replace(/^ERM_\d+\s*/, '')
            const created = t.createdAt?.slice(0,10) || ''
            return (
              <tr key={t._id} className="hover:bg-gray-50">
                <td className="px-2 py-1">
                  {isAdmin ? (
                    <button className="text-accentPrimary underline" onClick={()=>openTask(t._id)}>
                      {`${t.request_id || ''} ${created} ${name}`}
                    </button>
                  ) : (
                    `${t.request_id || ''} ${created} ${name}`
                  )}
                </td>
                <td className="px-2 py-1 text-center">{t.due_date?.slice(0,10)}</td>
                <td className="px-2 py-1 text-center">{t.priority}</td>
                <td className="px-2 py-1 text-center">{t.status}</td>
                <td className="px-2 py-1 text-center">{t.task_type}</td>
                <td className="px-2 py-1 text-center">
                  {t.startCoordinates ? `${t.startCoordinates.lat}, ${t.startCoordinates.lng}` : ''}
                </td>
                <td className="px-2 py-1 text-center">
                  {t.finishCoordinates ? `${t.finishCoordinates.lat}, ${t.finishCoordinates.lng}` : ''}
                </td>
                <td className="px-2 py-1 text-center">{t.route_distance_km}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
