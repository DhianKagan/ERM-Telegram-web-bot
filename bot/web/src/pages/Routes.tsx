// Страница отображения маршрутов на карте с фильтрами
import React from 'react'
import Breadcrumbs from '../components/Breadcrumbs'
import fetchRouteGeometry from '../services/osrm'
import { fetchTasks } from '../services/tasks'
import RoutesTaskTable from '../components/RoutesTaskTable'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useNavigate, useLocation } from 'react-router-dom'

interface Task {
  _id: string
  title: string
  request_id: string
  createdAt: string
}

export default function RoutesPage() {
  const [tasks, setTasks] = React.useState<Task[]>([])
  const [sorted, setSorted] = React.useState<Task[]>([])
  const navigate = useNavigate()
  const location = useLocation()

  const openTask = React.useCallback((id: string) => {
    const params = new URLSearchParams(location.search)
    params.set('task', id)
    navigate({ search: params.toString() }, { replace: true })
  }, [location, navigate])

  const load = React.useCallback(() => {
    fetchTasks().then(data => {
      const list = data.filter(t => t.status !== 'new' && t.status !== 'in-progress')
      setTasks(list)
      setSorted(list)
    })
  }, [])

  React.useEffect(load, [load])

  React.useEffect(() => {
    if (!sorted.length) return
    const map = L.map('routes-map').setView([48.3794, 31.1656], 6)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map)
    const group = L.layerGroup().addTo(map)
    const startIcon = L.divIcon({ className: 'start-marker' })
    const finishIcon = L.divIcon({ className: 'finish-marker' })
    ;(async () => {
      for (const t of sorted) {
        if (t.startCoordinates && t.finishCoordinates) {
          const coords = await fetchRouteGeometry(t.startCoordinates, t.finishCoordinates)
          if (!coords) continue
          const latlngs = coords.map(c => [c[1], c[0]])
          L.polyline(latlngs, { color: 'blue' }).addTo(group)
          const startMarker = L.marker(latlngs[0], { icon: startIcon })
            .bindTooltip(`<a href="#" class="text-accentPrimary" data-id="${t._id}">${t.title}</a>`)
          const endMarker = L.marker(latlngs[latlngs.length - 1], { icon: finishIcon })
            .bindTooltip(`<a href="#" class="text-accentPrimary" data-id="${t._id}">${t.title}</a>`)
          startMarker.on('click', () => openTask(t._id))
          endMarker.on('click', () => openTask(t._id))
          startMarker.addTo(group)
          endMarker.addTo(group)
        }
      }
    })()
    return () => map.remove()
  }, [sorted, openTask])

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Маршруты' }]} />
      <div id="routes-map" className="h-96 w-full rounded border" />
      <div className="space-y-2 max-w-full">
        <h3 className="text-lg font-semibold">Задачи</h3>
        <RoutesTaskTable tasks={tasks} onChange={setSorted} />
        <div className="text-right">
          <button onClick={load} className="btn-blue rounded px-4">Обновить</button>
        </div>
      </div>
    </div>
  )
}
