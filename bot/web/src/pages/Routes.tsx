// Страница отображения маршрутов на карте с фильтрами
import React from 'react'
import Breadcrumbs from '../components/Breadcrumbs'
import fetchRoutes from '../services/routes'
import fetchRouteGeometry from '../services/osrm'
import { fetchTasks } from '../services/tasks'
import TaskRangeList from '../components/TaskRangeList'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

interface Route {
  _id: string
  startCoordinates?: { lat: number; lng: number }
  finishCoordinates?: { lat: number; lng: number }
  route_distance_km?: number
  status?: string
  departmentId?: string
  createdAt?: string
}

interface Task {
  _id: string
  title: string
  request_id: string
  createdAt: string
}

export default function RoutesPage() {
  const [routes, setRoutes] = React.useState<Route[]>([])
  const [tasks, setTasks] = React.useState<Task[]>([])
  const [fromDate, setFromDate] = React.useState<Date | null>(null)
  const [toDate, setToDate] = React.useState<Date | null>(null)
  const [status, setStatus] = React.useState('')
  const [department, setDepartment] = React.useState('')

  const format = (d: Date | null) => d ? d.toISOString().slice(0,10) : ''
  const load = React.useCallback(() => {
    const params = {
      from: format(fromDate),
      to: format(toDate),
      status,
      department
    }
    fetchRoutes(params).then(setRoutes)
    fetchTasks(params).then(setTasks)
  }, [fromDate, toDate, status, department])

  React.useEffect(load, [load])

  React.useEffect(() => {
    if (!routes.length) return
    const map = L.map('routes-map').setView([48.3794, 31.1656], 6)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map)
    const group = L.layerGroup().addTo(map)
    ;(async () => {
      for (const r of routes) {
        if (r.startCoordinates && r.finishCoordinates) {
          const coords = await fetchRouteGeometry(r.startCoordinates, r.finishCoordinates)
          if (!coords) continue
          const latlngs = coords.map(c => [c[1], c[0]])
          L.polyline(latlngs, { color: 'blue' }).addTo(group)
          L.marker(latlngs[0]).addTo(group)
          L.marker(latlngs[latlngs.length - 1]).addTo(group)
        }
      }
    })()
    return () => map.remove()
  }, [routes])

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Маршруты' }]} />
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="space-y-4 lg:col-span-3">
          <div id="routes-map" className="h-96 w-full rounded border" />
          <div className="flex flex-wrap gap-2">
            <DatePicker
              selectsRange
              startDate={fromDate}
              endDate={toDate}
              onChange={(d: [Date|null, Date|null]) => {
                setFromDate(d[0])
                setToDate(d[1])
              }}
              dateFormat="yyyy-MM-dd"
              placeholderText="Диапазон дат"
              className="rounded border px-2 py-1"
              renderCustomHeader={() => (
                <div className="mb-2 text-center text-sm font-medium">
                  {fromDate ? fromDate.toLocaleDateString() : '...'} — {toDate ? toDate.toLocaleDateString() : '...'}
                </div>
              )}
            />
            <input
              placeholder="Статус"
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="rounded border px-2 py-1"
            />
            <input
              placeholder="Отдел"
              value={department}
              onChange={e => setDepartment(e.target.value)}
              className="rounded border px-2 py-1"
            />
            <button onClick={load} className="btn-blue rounded px-4">Обновить</button>
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Задачи</h3>
          <TaskRangeList tasks={tasks} />
        </div>
      </div>
    </div>
  )
}
