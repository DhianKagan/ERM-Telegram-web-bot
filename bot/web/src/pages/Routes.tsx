// Страница отображения маршрутов на карте с фильтрами
import React from 'react'
import Breadcrumbs from '../components/Breadcrumbs'
import fetchRouteGeometry from '../services/osrm'
import { fetchTasks } from '../services/tasks'
import optimizeRoute from '../services/optimizer'
import RoutesTaskTable from '../components/RoutesTaskTable'
import createMultiRouteLink from '../utils/createMultiRouteLink'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'

interface Task {
  _id: string
  title: string
  request_id: string
  createdAt: string
  status?: string
  priority?: string
  task_type?: string
  due_date?: string
  startCoordinates?: { lat: number; lng: number }
  finishCoordinates?: { lat: number; lng: number }
  route_distance_km?: number
}

export default function RoutesPage() {
  const [tasks, setTasks] = React.useState<Task[]>([])
  const [sorted, setSorted] = React.useState<Task[]>([])
  const [vehicles, setVehicles] = React.useState(1)
  const [method, setMethod] = React.useState('angle')
  const [links, setLinks] = React.useState<string[]>([])
  const mapRef = React.useRef<L.Map | null>(null)
  const optLayerRef = React.useRef<L.LayerGroup | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const hasDialog = params.has('task') || params.has('newTask')

  const openTask = React.useCallback((id: string) => {
    const params = new URLSearchParams(location.search)
    params.set('task', id)
    navigate({ search: params.toString() }, { replace: true })
  }, [location, navigate])

  const load = React.useCallback(() => {
    fetchTasks().then(data => {
      setTasks(data)
      setSorted(data)
    })
  }, [])

  const calculate = React.useCallback(() => {
    const ids = sorted.map(t => t._id)
    optimizeRoute(ids, vehicles, method).then(r => {
      if (!r || !mapRef.current) return
      if (optLayerRef.current) {
        optLayerRef.current.remove()
      }
      const group = L.layerGroup().addTo(mapRef.current)
      optLayerRef.current = group
      const colors = ['red', 'green', 'orange']
      const newLinks: string[] = []
      r.routes.forEach((route: string[], idx: number) => {
        const tasksPoints = route
          .map(id => sorted.find(t => t._id === id))
          .filter(Boolean) as Task[]
        const points = tasksPoints.flatMap(t =>
          t.startCoordinates && t.finishCoordinates
            ? [t.startCoordinates, t.finishCoordinates]
            : []
        )
        if (points.length < 2) return
        const latlngs = points.map(p => [p.lat, p.lng]) as [number, number][]
        L.polyline(latlngs, { color: colors[idx % colors.length] }).addTo(group)
        newLinks.push(createMultiRouteLink(points))
      })
      setLinks(newLinks)
    })
  }, [sorted, vehicles, method])

  const reset = React.useCallback(() => {
    if (optLayerRef.current) {
      optLayerRef.current.remove()
      optLayerRef.current = null
    }
  }, [])

  React.useEffect(load, [load])

  React.useEffect(() => {
    if (!sorted.length || hasDialog) return
    const map = L.map('routes-map').setView([48.3794, 31.1656], 6)
    mapRef.current = map
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
    return () => {
      map.remove()
      if (optLayerRef.current) optLayerRef.current.remove()
      mapRef.current = null
    }
  }, [sorted, openTask, hasDialog])

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: 'Задачи', href: '/tasks' }, { label: 'Маршруты' }]} />
      <div id="routes-map" className={`h-96 w-full rounded border ${hasDialog ? 'hidden' : ''}`} />
      <div className="flex justify-end space-x-2">
        <select value={vehicles} onChange={e=>setVehicles(Number(e.target.value))} className="rounded border px-2 py-1">
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>
        <select value={method} onChange={e=>setMethod(e.target.value)} className="rounded border px-2 py-1">
          <option value="angle">angle</option>
          <option value="trip">trip</option>
        </select>
        <button onClick={calculate} className="btn-blue rounded px-4">Просчёт маршрута</button>
        <button onClick={reset} className="btn-blue rounded px-4">Сбросить</button>
        <button onClick={load} className="btn-blue rounded px-4">Обновить</button>
      </div>
      {!!links.length && (
        <div className="flex flex-col items-end space-y-1">
          {links.map((u, i) => (
            <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="text-accentPrimary underline">Маршрут {i + 1}</a>
          ))}
        </div>
      )}
      <div className="space-y-2 max-w-full">
        <h3 className="text-lg font-semibold">Задачи</h3>
        <RoutesTaskTable tasks={tasks} onChange={setSorted} />
      </div>
    </div>
  )
}
